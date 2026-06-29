/**
 * api/chatClient.ts
 *
 * Thin fetch-based client for the AI chat backend.
 * No axios — uses native fetch + AbortController for timeout.
 * Base URL is read from the CHAT_API_URL env var, falling back to localhost.
 */

export interface KubeContext {
  clusterName: string;
  server: string;
  namespace: string;
}

/** A single turn from the conversation history sent to the backend. */
export interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatPayload {
  message: string;
  context: KubeContext;
  /** Up to the last 20 non-error messages, oldest first. */
  history: HistoryMessage[];
}

export interface ChatResponse {
  reply: string;
}

/** Non-2xx responses are surfaced as a typed error. */
export class ChatApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string
  ) {
    super(`Chat API error ${status}: ${body}`);
    this.name = "ChatApiError";
  }
}

const BASE_URL: string =
  // process.env is replaced by webpack DefinePlugin / ts-loader at build time.
  // The env var must be set before building, or the fallback is used.
  (typeof process !== "undefined" && process.env["CHAT_API_URL"]) ||
  "http://localhost:8000";

const TIMEOUT_MS = 30_000;

export async function sendChatMessage(
  payload: ChatPayload
): Promise<ChatResponse> {
  const controller = new AbortController();
  const timerId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (err: unknown) {
    clearTimeout(timerId);
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Request timed out after 30 seconds.");
    }
    throw err;
  } finally {
    clearTimeout(timerId);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "(no body)");
    throw new ChatApiError(response.status, body);
  }

  const data = (await response.json()) as ChatResponse;
  return data;
}
