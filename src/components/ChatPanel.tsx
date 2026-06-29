/**
 * components/ChatPanel.tsx
 *
 * Top-level panel rendered inside the Lens cluster page area.
 * Reads the active cluster context and passes it down to children.
 *
 * NOTE on Renderer.Catalog.activeCluster:
 *   This is the correct API for cluster pages in OpenLens 6.5.x.
 *   Common.Catalog.activeEntity is unreliable inside clusterPages and
 *   should NOT be used here.
 */

import { Renderer } from "@k8slens/extensions";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useChat } from "../hooks/useChat";
import { fetchLLMStatus, type LLMStatus } from "../api/chatClient";
import { ChatInput } from "./ChatInput";
import { MessageList } from "./MessageList";
import styles from "../styles/ChatPanel.module.css";

function getClusterContext() {
  // Always null-check — activeCluster is null when no cluster is open
  const cluster = Renderer.Catalog.activeCluster;
  return {
    clusterName: cluster?.metadata?.name ?? "unknown",
    server: cluster?.spec?.kubeconfigContext ?? "",
    namespace: "default",
  };
}

export const ChatPanel: React.FC = () => {
  const context = getClusterContext();
  const { messages, isLoading, sendMessage, clearHistory, llmStatus: llmStatusFromChat } = useChat(context);
  const listRef = useRef<HTMLDivElement>(null);
  const [llmStatus, setLlmStatus] = useState<LLMStatus | null>(null);

  // Try GET /status on mount for immediate badge display
  useEffect(() => {
    console.log("[KubeChat] ChatPanel mounted, fetching status...");
    fetchLLMStatus().then((s) => {
      console.log("[KubeChat] fetchLLMStatus returned:", s);
      if (s.provider !== "Offline") {
        console.log("[KubeChat] Setting llmStatus from mount fetch:", s);
        setLlmStatus(s);
      }
    });
  }, []);

  // Also update from chat responses (reliable fallback inside Electron)
  useEffect(() => {
    console.log("[KubeChat] llmStatusFromChat updated:", llmStatusFromChat);
    if (llmStatusFromChat) setLlmStatus(llmStatusFromChat);
  }, [llmStatusFromChat]);

  const handleSend = useCallback(
    async (text: string) => {
      await sendMessage(text);
      // Scroll to bottom after the state update renders
      requestAnimationFrame(() => {
        if (listRef.current) {
          listRef.current.scrollTop = listRef.current.scrollHeight;
        }
      });
    },
    [sendMessage]
  );

  return (
    <div className={styles.panel}>
      {/* ── Header ── */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.headerIcon} aria-hidden="true">
            💬
          </span>
          <h1 className={styles.title}>Kube Chat</h1>
          {context.clusterName !== "unknown" && (
            <span className={styles.clusterBadge}>{context.clusterName}</span>
          )}
          {/* LLM badge — shown in header so it's always visible */}
          {llmStatus && (
            <span
              className={[
                styles.llmBadge,
                llmStatus.provider === "Gemini"  ? styles.llmGemini  : "",
                llmStatus.provider === "OpenAI"  ? styles.llmOpenAI  : "",
                llmStatus.provider === "Offline" ? styles.llmOffline : "",
              ].filter(Boolean).join(" ")}
              title={`LLM: ${llmStatus.provider} — ${llmStatus.model}`}
            >
              <span className={styles.llmDot} aria-hidden="true" />
              {llmStatus.provider === "Gemini"  && "✦ "}
              {llmStatus.provider === "OpenAI"  && "⬡ "}
              {llmStatus.provider === "Offline" && "○ "}
              {llmStatus.model !== "none" ? llmStatus.model : "Offline"}
            </span>
          )}
        </div>
        <button
          className={styles.clearButton}
          onClick={clearHistory}
          title="Clear conversation history"
          aria-label="Clear conversation history"
          disabled={isLoading}
        >
          Clear
        </button>
      </header>

      {/* ── Message list ── */}
      <div className={styles.body} ref={listRef}>
        <MessageList messages={messages} isLoading={isLoading} />
      </div>

      {/* ── Input ── */}
      <footer className={styles.footer}>
        <ChatInput 
          onSend={handleSend} 
          isLoading={isLoading} 
          userQueries={messages.filter(m => m.role === "user").map(m => m.content)}
        />
      </footer>
    </div>
  );
};
