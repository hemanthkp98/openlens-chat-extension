const http = require("http");
const https = require("https");
const { exec } = require("child_process");

const PORT = 8000;

// Helper to execute shell commands securely
function runKubectl(args) {
  return new Promise((resolve) => {
    // Sanitize arguments to prevent command injection, allowing brackets and commas for custom-columns
    const sanitizedArgs = args.filter(arg => /^[a-zA-Z0-9\-\.\=\_\/\:\@\*\[\]\,\(\)]+$/.test(arg));
    // Wrap arguments containing * or [ in double quotes to prevent shell expansion
    const commandArgs = sanitizedArgs.map(arg => {
      if (arg.includes("*") || arg.includes("[") || arg.includes("]")) {
        return `"${arg}"`;
      }
      return arg;
    });
    const command = `kubectl ${commandArgs.join(" ")}`;
    
    exec(command, (error, stdout, stderr) => {
      if (error) {
        resolve({ success: false, error: stderr || error.message });
      } else {
        resolve({ success: true, stdout });
      }
    });
  });
}

// Helper to make HTTPS requests without external dependencies
function makeHttpsRequest(url, headers, body) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: "POST",
      headers: headers
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => data += chunk);
      res.on("end", () => {
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          json: async () => JSON.parse(data),
          text: async () => data
        });
      });
    });

    req.on("error", (err) => reject(err));
    if (body) {
      req.write(body);
    }
    req.end();
  });
}

async function gatherClusterState(kubeContext) {
  const contextFlag = kubeContext ? [`--context=${kubeContext}`] : [];

  const [nodesRes, nsRes, podsRes] = await Promise.all([
    runKubectl(["get", "nodes", "-o", "wide", ...contextFlag]),
    runKubectl(["get", "namespaces", ...contextFlag]),
    runKubectl(["get", "pods", "-A", "-o", "custom-columns=NAMESPACE:.metadata.namespace,NAME:.metadata.name,STATUS:.status.phase,REASON:.status.containerStatuses[*].state.waiting.reason,IMAGE:.spec.containers[*].image", ...contextFlag])
  ]);

  let contextString = "=== LIVE KUBERNETES CLUSTER STATE ===\n\n";

  if (nodesRes.success) {
    contextString += "--- NODES ---\n" + nodesRes.stdout.trim() + "\n\n";
  }
  if (nsRes.success) {
    contextString += "--- NAMESPACES ---\n" + nsRes.stdout.trim() + "\n\n";
  }
  if (podsRes.success) {
    contextString += "--- PODS WITH IMAGES (ALL NAMESPACES) ---\n" + podsRes.stdout.trim() + "\n\n";
  }

  return contextString;
}

// LLM completions handler — returns { reply, provider, model }
async function getLLMResponse(message, context, history = []) {
  const geminiKey = process.env.GEMINI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  const clusterName = context.clusterName && context.clusterName !== "unknown" ? context.clusterName : null;
  const namespace = context.namespace || "default";

  // Gather live cluster status to inject into LLM context
  const liveClusterState = await gatherClusterState(clusterName);

  // If a Gemini API key is configured, let's call the real Gemini API!
  if (geminiKey) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;
      const headers = { "Content-Type": "application/json" };
      const systemPrompt = 
        `You are an expert Kubernetes AI assistant running inside the OpenLens chat sidebar panel.\n` +
        `You help the user inspect, debug, and understand their active cluster resources.\n\n` +
        `Active Cluster Context: ${clusterName || "default"}\n` +
        `Active Namespace in UI: ${namespace}\n\n` +
        liveClusterState + "\n" +
        `Using the live cluster state above, answer the user's question accurately. \n` +
        `- If they ask about resources in a specific namespace (e.g. kube-system), check the data for that namespace.\n` +
        `- If they ask to "set" or "switch" namespace, acknowledge it and explain that you will focus on that namespace for their future questions, and show the resources currently running in it.\n` +
        `- Keep responses concise, clean, and use Markdown formatting where appropriate. Highlight any failing/restarting pods.`;

      const body = JSON.stringify({
        contents: [
          // First turn: system prompt with live cluster state
          {
            role: "user",
            parts: [{ text: systemPrompt }]
          },
          // Required model acknowledgement to open the conversation
          {
            role: "model",
            parts: [{ text: "Understood. I have reviewed the live cluster state and I am ready to help." }]
          },
          // Inject prior conversation turns (alternating user / model)
          ...history.map(m => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }]
          })),
          // Final user message
          {
            role: "user",
            parts: [{ text: `User Query: ${message}` }]
          }
        ]
      });

      const response = await makeHttpsRequest(url, headers, body);
      if (response.ok) {
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "No response text received from Gemini.";
        return { reply: text, provider: "Gemini", model: "gemini-2.5-flash" };
      } else {
        const text = await response.text();
        // 503 = overloaded — surface a friendlier message
        const parsed = JSON.parse(text);
        const isOverloaded = response.status === 503 || parsed?.error?.status === "UNAVAILABLE";
        if (isOverloaded) {
          return {
            reply: `### ⏳ Gemini is busy\n\nThe model is experiencing high demand right now. Please wait a moment and try again.`,
            provider: "Gemini",
            model: "gemini-2.5-flash"
          };
        }
        console.error("Gemini API returned error status:", response.status, text);
        return { reply: `### ❌ Gemini API Error (${response.status})\n\`\`\`json\n${text}\n\`\`\``, provider: "Gemini", model: "gemini-2.5-flash" };
      }
    } catch (e) {
      console.error("Gemini API call failed:", e);
      return { reply: `### ❌ Gemini Connection Failed\n\`\`\`text\n${e.message}\n\`\`\``, provider: "Gemini", model: "gemini-2.5-flash" };
    }
  }

  // If an OpenAI API key is configured, let's call the real OpenAI API!
  if (openaiKey) {
    try {
      const url = "https://api.openai.com/v1/chat/completions";
      const headers = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiKey}`
      };
      const body = JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are an expert Kubernetes AI assistant running inside the OpenLens chat sidebar panel.\n` +
                     `You help the user inspect, debug, and understand their active cluster resources.\n\n` +
                     `Active Cluster Context: ${clusterName || "default"}\n` +
                     `Active Namespace in UI: ${namespace}\n\n` +
                     liveClusterState + "\n" +
                     `Using the live cluster state above, answer the user's question accurately.`
          },
          // Inject prior conversation turns so the model can resolve references
          ...history.map(m => ({ role: m.role, content: m.content })),
          {
            role: "user",
            content: message
          }
        ]
      });

      const response = await makeHttpsRequest(url, headers, body);
      if (response.ok) {
        const data = await response.json();
        const text = data.choices?.[0]?.message?.content || "No response text received from OpenAI.";
        return { reply: text, provider: "OpenAI", model: "gpt-4o-mini" };
      } else {
        const text = await response.text();
        console.error("OpenAI API returned error status:", response.status, text);
        return { reply: `### ❌ OpenAI API Error (${response.status})\n\`\`\`json\n${text}\n\`\`\``, provider: "OpenAI", model: "gpt-4o-mini" };
      }
    } catch (e) {
      console.error("OpenAI API call failed:", e);
      return { reply: `### ❌ OpenAI Connection Failed\n\`\`\`text\n${e.message}\n\`\`\``, provider: "OpenAI", model: "gpt-4o-mini" };
    }
  }

  // Standard LLM fallback if no keys are provided
  return {
    reply: `### 💡 Assistant Response\n` +
      `I received your question: "${message}"\n\n` +
      `To get **real AI-generated responses** using an LLM, please set one of these environment variables before starting the backend server:\n` +
      `- \`GEMINI_API_KEY\` (Gemini 2.5 Flash)\n` +
      `- \`OPENAI_API_KEY\` (GPT-4o mini)\n\n` +
      `Example command to start with LLM:\n` +
      `\`\`\`bash\n` +
      `GEMINI_API_KEY="your-key-here" node server.js\n` +
      `\`\`\`\n` +
      `*Currently running in offline helper mode.*`,
    provider: "Offline",
    model: "none"
  };
}

const server = http.createServer(async (req, res) => {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "POST" && req.url === "/chat") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });

    req.on("end", async () => {
      try {
        const payload = JSON.parse(body);
        const userMessage = payload.message || "";
        const context = payload.context || {};
        const history = Array.isArray(payload.history) ? payload.history : [];

        console.log(`[Query] ${userMessage} (${context.clusterName}) | history: ${history.length} turns`);

        // Forward straight to LLM with gathered cluster context and conversation history
        const result = await getLLMResponse(userMessage, context, history);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ reply: result.reply, provider: result.provider, model: result.model }));
      } catch (err) {
        console.error(err);
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid JSON or server error" }));
      }
    });
    return;
  }

  if (req.method === "GET" && req.url === "/status") {
    const geminiKey = process.env.GEMINI_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    let provider, model;
    if (geminiKey) {
      provider = "Gemini";
      model = "gemini-2.5-flash";
    } else if (openaiKey) {
      provider = "OpenAI";
      model = "gpt-4o-mini";
    } else {
      provider = "Offline";
      model = "none";
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ provider, model }));
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not Found" }));
});

server.listen(PORT, () => {
  console.log(`AI Backend listening on http://localhost:${PORT}`);
});
