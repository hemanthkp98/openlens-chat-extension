/**
 * components/MessageList.tsx
 *
 * Renders the scrollable list of chat messages.
 * Shows a "typing…" indicator while a response is in flight.
 * Shows an empty-state prompt when there are no messages yet.
 */

import React from "react";
import { type ChatMessage } from "../hooks/useChat";
import { MessageBubble } from "./MessageBubble";
import styles from "../styles/MessageList.module.css";

interface MessageListProps {
  messages: ChatMessage[];
  isLoading: boolean;
}

const EmptyState: React.FC = () => (
  <div className={styles.emptyState}>
    <span className={styles.emptyIcon} aria-hidden="true">
      🤖
    </span>
    <p className={styles.emptyTitle}>Ask me anything about your cluster</p>
    <p className={styles.emptyHint}>
      Try: <em>"How many pods are running?"</em> or{" "}
      <em>"Show me failing deployments"</em>
    </p>
  </div>
);

const TypingIndicator: React.FC = () => (
  <div className={styles.typingRow} role="status" aria-live="polite">
    <div className={styles.typingBubble}>
      <span className={styles.dot} />
      <span className={styles.dot} />
      <span className={styles.dot} />
    </div>
  </div>
);

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  isLoading,
}) => {
  if (messages.length === 0 && !isLoading) {
    return <EmptyState />;
  }

  return (
    <div className={styles.list} role="log" aria-label="Chat messages">
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
      {isLoading && <TypingIndicator />}
    </div>
  );
};
