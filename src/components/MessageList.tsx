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
  onSelectPrompt?: (prompt: string) => void;
}

interface EmptyStateProps {
  onSelectPrompt?: (prompt: string) => void;
}

const PRESET_PROMPTS = [
  { text: "Show failing pods", icon: "🔍" },
  { text: "List cluster nodes", icon: "📋" },
  { text: "View recent events", icon: "⚠️" },
  { text: "List system services", icon: "🌐" },
];

const EmptyState: React.FC<EmptyStateProps> = ({ onSelectPrompt }) => (
  <div className={styles.emptyState}>
    <span className={styles.emptyIcon} aria-hidden="true">
      🤖
    </span>
    <p className={styles.emptyTitle}>Ask me anything about your cluster</p>
    <div className={styles.suggestionsGrid}>
      {PRESET_PROMPTS.map((prompt, idx) => (
        <button
          key={idx}
          className={styles.suggestionCard}
          onClick={() => onSelectPrompt?.(prompt.text)}
          title={`Click to ask: "${prompt.text}"`}
        >
          <span className={styles.suggestionIcon}>{prompt.icon}</span>
          <span className={styles.suggestionText}>{prompt.text}</span>
        </button>
      ))}
    </div>
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
  onSelectPrompt,
}) => {
  if (messages.length === 0 && !isLoading) {
    return <EmptyState onSelectPrompt={onSelectPrompt} />;
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
