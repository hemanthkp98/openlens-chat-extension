const request = require("supertest");
const https = require("https");
const { server, runKubectl, getLLMResponse } = require("../server");

// Mock child_process.exec
const cp = require("child_process");
jest.mock("child_process", () => ({
  exec: jest.fn()
}));

// Mock https.request
jest.mock("https", () => ({
  request: jest.fn()
}));

describe("Backend server.js", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    jest.clearAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe("runKubectl argument sanitization", () => {
    it("should allow safe alphanumeric characters and normal punctuation", async () => {
      cp.exec.mockImplementation((cmd, cb) => cb(null, "nodes list", ""));
      
      const res = await runKubectl(["get", "pods", "-n", "default", "--context=colima"]);
      expect(res.success).toBe(true);
      expect(res.stdout).toBe("nodes list");
      expect(cp.exec).toHaveBeenCalledWith(
        "kubectl get pods -n default --context=colima",
        expect.any(Function)
      );
    });

    it("should filter out shell injection attempt characters", async () => {
      cp.exec.mockImplementation((cmd, cb) => cb(null, "", ""));
      
      // Injecting a ";" shell bypass
      await runKubectl(["get", "pods", ";", "rm", "-rf", "/"]);
      expect(cp.exec).toHaveBeenCalledWith(
        "kubectl get pods rm -rf /",
        expect.any(Function)
      );
      // Notice that ";" got filtered out because it failed the sanitization regex!
    });

    it("should handle custom column brackets/commas safely", async () => {
      cp.exec.mockImplementation((cmd, cb) => cb(null, "custom cols", ""));
      
      await runKubectl(["get", "pods", "-o", "custom-columns=NAME:.metadata.name,IMAGE:.spec.containers[*].image"]);
      expect(cp.exec).toHaveBeenCalledWith(
        'kubectl get pods -o "custom-columns=NAME:.metadata.name,IMAGE:.spec.containers[*].image"',
        expect.any(Function)
      );
    });
  });

  describe("getLLMResponse completions provider flows", () => {
    it("should fall back to Offline helper response when no key is set", async () => {
      delete process.env.GEMINI_API_KEY;
      delete process.env.OPENAI_API_KEY;

      const res = await getLLMResponse("How to troubleshoot?", { clusterName: "test" });
      expect(res.provider).toBe("Offline");
      expect(res.model).toBe("none");
      expect(res.reply).toContain("offline helper mode");
    });

    it("should trigger Gemini API if GEMINI_API_KEY is present", async () => {
      process.env.GEMINI_API_KEY = "mock-gemini-key";
      
      const mockResponseBody = JSON.stringify({
        candidates: [{
          content: {
            parts: [{ text: "Gemini response text" }]
          }
        }]
      });

      https.request.mockImplementation((options, callback) => {
        const res = {
          statusCode: 200,
          on: (event, cb) => {
            if (event === "data") cb(Buffer.from(mockResponseBody));
            if (event === "end") cb();
          }
        };
        callback(res);
        return {
          on: jest.fn(),
          write: jest.fn(),
          end: jest.fn()
        };
      });

      const res = await getLLMResponse("show pods", { clusterName: "colima" });
      expect(res.provider).toBe("Gemini");
      expect(res.model).toBe("gemini-2.5-flash");
      expect(res.reply).toBe("Gemini response text");
    });

    it("should handle Gemini overloaded 503 error gracefully", async () => {
      process.env.GEMINI_API_KEY = "mock-gemini-key";
      
      const mockErrorResponse = JSON.stringify({
        error: {
          code: 503,
          status: "UNAVAILABLE",
          message: "This model is currently experiencing high demand."
        }
      });

      https.request.mockImplementation((options, callback) => {
        const res = {
          statusCode: 503,
          on: (event, cb) => {
            if (event === "data") cb(Buffer.from(mockErrorResponse));
            if (event === "end") cb();
          }
        };
        callback(res);
        return {
          on: jest.fn(),
          write: jest.fn(),
          end: jest.fn()
        };
      });

      const res = await getLLMResponse("show pods", { clusterName: "colima" });
      expect(res.provider).toBe("Gemini");
      expect(res.reply).toContain("Gemini is busy");
    });

    it("should trigger OpenAI API if OPENAI_API_KEY is present and Gemini is not", async () => {
      delete process.env.GEMINI_API_KEY;
      process.env.OPENAI_API_KEY = "mock-openai-key";

      const mockResponseBody = JSON.stringify({
        choices: [{
          message: { content: "OpenAI response text" }
        }]
      });

      https.request.mockImplementation((options, callback) => {
        const res = {
          statusCode: 200,
          on: (event, cb) => {
            if (event === "data") cb(Buffer.from(mockResponseBody));
            if (event === "end") cb();
          }
        };
        callback(res);
        return {
          on: jest.fn(),
          write: jest.fn(),
          end: jest.fn()
        };
      });

      const res = await getLLMResponse("show pods", { clusterName: "colima" });
      expect(res.provider).toBe("OpenAI");
      expect(res.model).toBe("gpt-4o-mini");
      expect(res.reply).toBe("OpenAI response text");
    });

    it("should handle OpenAI API error response gracefully", async () => {
      delete process.env.GEMINI_API_KEY;
      process.env.OPENAI_API_KEY = "mock-openai-key";

      https.request.mockImplementation((options, callback) => {
        const res = {
          statusCode: 400,
          on: (event, cb) => {
            if (event === "data") cb(Buffer.from("Bad Request details"));
            if (event === "end") cb();
          }
        };
        callback(res);
        return {
          on: jest.fn(),
          write: jest.fn(),
          end: jest.fn()
        };
      });

      const res = await getLLMResponse("show pods", { clusterName: "colima" });
      expect(res.provider).toBe("OpenAI");
      expect(res.reply).toContain("OpenAI API Error (400)");
    });

    it("should handle OpenAI request exception gracefully", async () => {
      delete process.env.GEMINI_API_KEY;
      process.env.OPENAI_API_KEY = "mock-openai-key";

      https.request.mockImplementation(() => {
        throw new Error("OpenAI API socket closed");
      });

      const res = await getLLMResponse("show pods", { clusterName: "colima" });
      expect(res.provider).toBe("OpenAI");
      expect(res.reply).toContain("OpenAI Connection Failed");
    });

    it("should handle Gemini request exception gracefully", async () => {
      process.env.GEMINI_API_KEY = "mock-gemini-key";

      https.request.mockImplementation(() => {
        throw new Error("Gemini API DNS lookup failed");
      });

      const res = await getLLMResponse("show pods", { clusterName: "colima" });
      expect(res.provider).toBe("Gemini");
      expect(res.reply).toContain("Gemini Connection Failed");
    });
  });

  describe("runKubectl error execution", () => {
    it("should return success: false and the error message on command failure", async () => {
      cp.exec.mockImplementation((cmd, cb) => cb(new Error("kubectl not found"), "", "stderr error details"));

      const res = await runKubectl(["get", "nodes"]);
      expect(res.success).toBe(false);
      expect(res.error).toBe("stderr error details");
    });
  });

  describe("API Server Routes", () => {
    it("should support OPTIONS requests (CORS preflight)", async () => {
      const response = await request(server).options("/chat");
      expect(response.status).toBe(204);
      expect(response.headers["access-control-allow-origin"]).toBe("*");
      expect(response.headers["access-control-allow-methods"]).toBe("POST, GET, OPTIONS");
    });

    it("should return OpenAI status on GET /status when only OpenAI key is present", async () => {
      delete process.env.GEMINI_API_KEY;
      process.env.OPENAI_API_KEY = "openai-key";
      
      const response = await request(server).get("/status");
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        provider: "OpenAI",
        model: "gpt-4o-mini"
      });
    });

    it("should return Gemini status on GET /status when both keys are present", async () => {
      process.env.GEMINI_API_KEY = "gemini-key";
      process.env.OPENAI_API_KEY = "openai-key";
      
      const response = await request(server).get("/status");
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        provider: "Gemini",
        model: "gemini-2.5-flash"
      });
    });

    it("should return Offline status on GET /status when no keys are present", async () => {
      delete process.env.GEMINI_API_KEY;
      delete process.env.OPENAI_API_KEY;
      
      const response = await request(server).get("/status");
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        provider: "Offline",
        model: "none"
      });
    });

    it("should support POST /chat and parse payload and history", async () => {
      delete process.env.GEMINI_API_KEY;
      delete process.env.OPENAI_API_KEY;

      const response = await request(server)
        .post("/chat")
        .send({
          message: "test query",
          context: { clusterName: "test-cluster" },
          history: [{ role: "user", content: "old message" }]
        });
      
      expect(response.status).toBe(200);
      expect(response.body.provider).toBe("Offline");
      expect(response.body.reply).toContain("offline helper mode");
    });

    it("should return 400 Bad Request on invalid request body", async () => {
      const response = await request(server)
        .post("/chat")
        .set("Content-Type", "application/json")
        .send("invalid-json");

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Invalid JSON or server error");
    });

    it("should return 404 Not Found on unknown paths", async () => {
      const response = await request(server).get("/unknown");
      expect(response.status).toBe(404);
      expect(response.body.error).toBe("Not Found");
    });
  });
});
