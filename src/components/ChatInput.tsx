/**
 * components/ChatInput.tsx
 *
 * Auto-resizing textarea:
 *  - Grows from 1 to 5 rows as user types
 *  - Enter to send, Shift+Enter for newline
 *  - Disabled + spinner while loading
 *  - Guards against empty submission
 *  - 2000 character limit with live counter
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import styles from "../styles/ChatInput.module.css";

const MAX_CHARS = 2_000;
const MIN_ROWS = 1;
const MAX_ROWS = 5;

interface ChatInputProps {
  onSend: (text: string) => Promise<void>;
  isLoading: boolean;
  userQueries: string[];
}

export const ChatInput: React.FC<ChatInputProps> = ({ onSend, isLoading, userQueries }) => {
  const [value, setValue] = useState("");
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [draftValue, setDraftValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize the textarea height based on content
  const resize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;

    el.style.height = "auto";
    const lineHeight = parseInt(getComputedStyle(el).lineHeight, 10) || 20;
    const minHeight = lineHeight * MIN_ROWS;
    const maxHeight = lineHeight * MAX_ROWS;
    el.style.height = `${Math.min(Math.max(el.scrollHeight, minHeight), maxHeight)}px`;
  }, []);

  useEffect(() => {
    resize();
  }, [value, resize]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (e.target.value.length <= MAX_CHARS) {
        setValue(e.target.value);
        setHistoryIndex(-1); // Reset history scroll on manual edit
      }
    },
    []
  );

  const handleSubmit = useCallback(async () => {
    const trimmed = value.trim();
    if (!trimmed || isLoading) return;
    setValue("");
    setHistoryIndex(-1);
    await onSend(trimmed);
  }, [value, isLoading, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const el = textareaRef.current;
      if (!el) return;

      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void handleSubmit();
      }
      else if (e.key === "ArrowUp") {
        // Recall older queries if cursor is at the very beginning of the input
        if (el.selectionStart === 0 && userQueries.length > 0) {
          const nextIndex = historyIndex + 1;
          if (nextIndex < userQueries.length) {
            e.preventDefault();
            if (historyIndex === -1) {
              setDraftValue(value);
            }
            setHistoryIndex(nextIndex);
            const recalled = userQueries[userQueries.length - 1 - nextIndex];
            setValue(recalled);
            
            // Put cursor at the start of the recalled text (so arrow navigation feels natural)
            requestAnimationFrame(() => {
              el.setSelectionRange(0, 0);
            });
          }
        }
      }
      else if (e.key === "ArrowDown") {
        // Recall newer queries/draft if cursor is at the very end of the input
        if (el.selectionStart === el.value.length && historyIndex > -1) {
          e.preventDefault();
          const nextIndex = historyIndex - 1;
          setHistoryIndex(nextIndex);
          if (nextIndex === -1) {
            setValue(draftValue);
          } else {
            const recalled = userQueries[userQueries.length - 1 - nextIndex];
            setValue(recalled);
          }
        }
      }
    },
    [value, historyIndex, draftValue, userQueries, handleSubmit]
  );

  const charsLeft = MAX_CHARS - value.length;
  const isNearLimit = charsLeft <= 200;
  const isOverLimit = charsLeft < 0;

  return (
    <div className={styles.container}>
      <div className={styles.inputRow}>
        <textarea
          ref={textareaRef}
          className={styles.textarea}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your cluster… (Enter to send)"
          disabled={isLoading}
          rows={MIN_ROWS}
          aria-label="Chat message"
          aria-describedby="char-counter"
          maxLength={MAX_CHARS}
        />
        <button
          className={styles.sendButton}
          onClick={() => void handleSubmit()}
          disabled={isLoading || !value.trim() || isOverLimit}
          aria-label="Send message"
          title="Send (Enter)"
        >
          {isLoading ? (
            <span className={styles.spinner} aria-hidden="true" />
          ) : (
            <span aria-hidden="true">↑</span>
          )}
        </button>
      </div>

      <div className={styles.meta}>
        <span className={styles.hint}>
          Shift+Enter for new line
        </span>
        <span
          id="char-counter"
          className={[
            styles.counter,
            isNearLimit ? styles.counterWarn : "",
            isOverLimit ? styles.counterError : "",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-live="polite"
        >
          {value.length} / {MAX_CHARS}
        </span>
      </div>
    </div>
  );
};
