/**
 * components/MessageBubble.tsx
 *
 * Renders a single chat message with:
 *  - Right-aligned accent bubble for user messages
 *  - Left-aligned muted bubble for assistant messages (with markdown-lite)
 *  - Left-aligned red-tinted bubble with warning icon for error messages
 *  - Relative timestamp visible on hover
 *  - Copy button for fenced code blocks
 */

import React, { useCallback, useState } from "react";
import { type ChatMessage } from "../hooks/useChat";
import styles from "../styles/MessageBubble.module.css";

interface MessageBubbleProps {
  message: ChatMessage;
}

// ──────────────────────────────────────────────────────────────────────────────
// Relative timestamp
// ──────────────────────────────────────────────────────────────────────────────

function relativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.round(diffMs / 1_000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return date.toLocaleDateString();
}

// ──────────────────────────────────────────────────────────────────────────────
// Code block with copy button
// ──────────────────────────────────────────────────────────────────────────────

interface CodeBlockProps {
  code: string;
}

function fallbackCopyText(text: string): boolean {
  try {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.width = "2em";
    textArea.style.height = "2em";
    textArea.style.padding = "0";
    textArea.style.border = "none";
    textArea.style.outline = "none";
    textArea.style.boxShadow = "none";
    textArea.style.background = "transparent";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand("copy");
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error("Fallback clipboard copy failed:", err);
    return false;
  }
}

const CodeBlock: React.FC<CodeBlockProps> = ({ code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      navigator.clipboard.writeText(code)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2_000);
        })
        .catch((err) => {
          console.warn("navigator.clipboard failed, trying fallback copy:", err);
          const success = fallbackCopyText(code);
          if (success) {
            setCopied(true);
            setTimeout(() => setCopied(false), 2_000);
          }
        });
    } else {
      const success = fallbackCopyText(code);
      if (success) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2_000);
      }
    }
  }, [code]);

  return (
    <div className={styles.codeBlock}>
      <button
        className={styles.copyButton}
        onClick={handleCopy}
        aria-label="Copy code"
        title="Copy to clipboard"
      >
        {copied ? "✓ Copied" : "Copy"}
      </button>
      <pre className={styles.pre}>
        <code>{code}</code>
      </pre>
    </div>
  );
};

// ──────────────────────────────────────────────────────────────────────────────
// Markdown-lite renderer (bold, inline code, fenced code blocks)
// ──────────────────────────────────────────────────────────────────────────────

interface MarkdownProps {
  text: string;
}

const MarkdownLite: React.FC<MarkdownProps> = ({ text }) => {
  // Split on fenced code blocks first
  const fencePattern = /```[\s\S]*?```/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = fencePattern.exec(text)) !== null) {
    const before = text.slice(lastIndex, match.index);
    if (before) {
      parts.push(<InlineMarkdown key={`text-${match.index}`} text={before} />);
    }

    // Strip the opening/closing backticks (and optional language tag)
    const raw = match[0].replace(/^```[^\n]*\n?/, "").replace(/```$/, "");
    parts.push(<CodeBlock key={`code-${match.index}`} code={raw} />);
    lastIndex = match.index + match[0].length;
  }

  const remaining = text.slice(lastIndex);
  if (remaining) {
    parts.push(<InlineMarkdown key="text-end" text={remaining} />);
  }

  return <>{parts}</>;
};

/** Renders **bold** and `inline code` within a single text segment. */
const InlineMarkdown: React.FC<{ text: string }> = ({ text }) => {
  // Split on **bold** and `code` markers
  const inlinePattern = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  const segments: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let idx = 0;

  while ((match = inlinePattern.exec(text)) !== null) {
    const before = text.slice(lastIndex, match.index);
    if (before) segments.push(before);

    const token = match[0];
    if (token.startsWith("**")) {
      segments.push(
        <strong key={idx++}>{token.slice(2, -2)}</strong>
      );
    } else {
      segments.push(
        <code className={styles.inlineCode} key={idx++}>
          {token.slice(1, -1)}
        </code>
      );
    }
    lastIndex = match.index + token.length;
  }

  const remaining = text.slice(lastIndex);
  if (remaining) segments.push(remaining);

  // Preserve newlines as line breaks
  const withBreaks: React.ReactNode[] = [];
  segments.forEach((seg, i) => {
    if (typeof seg === "string") {
      const lines = seg.split("\n");
      lines.forEach((line, li) => {
        withBreaks.push(line);
        if (li < lines.length - 1) withBreaks.push(<br key={`br-${i}-${li}`} />);
      });
    } else {
      withBreaks.push(seg);
    }
  });

  return <>{withBreaks}</>;
};

// ──────────────────────────────────────────────────────────────────────────────
// MessageBubble
// ──────────────────────────────────────────────────────────────────────────────

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const isUser = message.role === "user";
  const isError = message.role === "error";

  const rowClass = [
    styles.row,
    isUser ? styles.rowUser : styles.rowAssistant,
  ].join(" ");

  const bubbleClass = [
    styles.bubble,
    isUser ? styles.bubbleUser : styles.bubbleAssistant,
    isError ? styles.bubbleError : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rowClass}>
      <div className={bubbleClass}>
        {isError && (
          <span className={styles.errorIcon} aria-label="Error">
            ⚠️{" "}
          </span>
        )}
        {isUser ? (
          message.content
        ) : (
          <MarkdownLite text={message.content} />
        )}
        <span className={styles.timestamp} aria-hidden="true">
          {relativeTime(message.timestamp)}
        </span>
      </div>
    </div>
  );
};
