/**
 * hooks/useChat.ts
 *
 * Manages message history, loading state, and communication with the
 * chat backend. History is persisted to localStorage keyed by cluster name
 * so each cluster gets independent conversation history.
 */

import { useCallback, useEffect, useState } from "react";
import { sendChatMessage, type KubeContext, type HistoryMessage, type LLMStatus } from "../api/chatClient";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "error" | "system";
  content: string;
  timestamp: Date;
}

interface UseChatReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  sendMessage: (text: string) => Promise<void>;
  clearHistory: () => void;
  clearContext: () => void;
  llmStatus: LLMStatus | null;
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

function storageKey(clusterName: string): string {
  return `kube-chat:${clusterName}`;
}

function generateId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Revive Date objects that JSON.parse turns into strings. */
function hydrateMessages(raw: unknown[]): ChatMessage[] {
  return raw.map((m) => {
    const msg = m as Record<string, unknown>;
    return {
      id: msg["id"] as string,
      role: msg["role"] as ChatMessage["role"],
      content: msg["content"] as string,
      timestamp: new Date(msg["timestamp"] as string),
    };
  });
}

function loadMessages(clusterName: string): ChatMessage[] {
  try {
    const raw = localStorage.getItem(storageKey(clusterName));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown[];
    return hydrateMessages(parsed);
  } catch {
    return [];
  }
}

function saveMessages(clusterName: string, messages: ChatMessage[]): void {
  try {
    localStorage.setItem(storageKey(clusterName), JSON.stringify(messages));
  } catch {
    // Ignore storage quota errors — UI still works, just won't persist.
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Hook
// ──────────────────────────────────────────────────────────────────────────────

export function useChat(context: KubeContext): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    loadMessages(context.clusterName)
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [llmStatus, setLlmStatus] = useState<LLMStatus | null>(null);

  // Re-load history when the active cluster changes
  useEffect(() => {
    setMessages(loadMessages(context.clusterName));
    setError(null);
  }, [context.clusterName]);

  // Persist whenever messages change
  useEffect(() => {
    saveMessages(context.clusterName, messages);
  }, [context.clusterName, messages]);

  const sendMessage = useCallback(
    async (text: string): Promise<void> => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;

      const userMessage: ChatMessage = {
        id: generateId(),
        role: "user",
        content: trimmed,
        timestamp: new Date(),
      };

      // Find the last index of context clear boundary
      const lastClearIndex = messages.map(m => m.role === "system" && m.content === "Context cleared").lastIndexOf(true);
      const messagesForHistory = lastClearIndex !== -1 ? messages.slice(lastClearIndex + 1) : messages;

      // Build conversation history (last 20 non-error turns, oldest first)
      // so the LLM can resolve pronoun references like "it" or "that pod".
      const MAX_HISTORY = 20;
      const history: HistoryMessage[] = messagesForHistory
        .filter((m) => m.role === "user" || m.role === "assistant")
        .slice(-MAX_HISTORY)
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

      // Optimistic UI: show user message immediately
      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);
      setError(null);

      try {
        const response = await sendChatMessage({
          message: trimmed,
          context,
          history,
        });

        const assistantMessage: ChatMessage = {
          id: generateId(),
          role: "assistant",
          content: response.reply,
          timestamp: new Date(),
        };

        // Update the LLM badge from the response metadata
        console.log("[KubeChat] chatClient response:", response);
        if (response.provider && response.model) {
          console.log("[KubeChat] Setting llmStatus in hook state:", { provider: response.provider, model: response.model });
          setLlmStatus({ provider: response.provider, model: response.model });
        }

        setMessages((prev) => [...prev, assistantMessage]);
      } catch (err: unknown) {
        const errorText =
          err instanceof Error ? err.message : "An unknown error occurred.";

        setError(errorText);

        const errorMessage: ChatMessage = {
          id: generateId(),
          role: "error",
          content: errorText,
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsLoading(false);
      }
    },
    [context, isLoading, messages]
  );

  const clearHistory = useCallback((): void => {
    setMessages([]);
    setError(null);
    try {
      localStorage.removeItem(storageKey(context.clusterName));
    } catch {
      // ignore
    }
  }, [context.clusterName]);

  const clearContext = useCallback((): void => {
    const systemMessage: ChatMessage = {
      id: generateId(),
      role: "system",
      content: "Context cleared",
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, systemMessage]);
  }, []);

  return { messages, isLoading, error, sendMessage, clearHistory, clearContext, llmStatus };
}
