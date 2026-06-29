import React from "react";
import { render, fireEvent } from "@testing-library/react";
import { MessageBubble } from "../components/MessageBubble";

describe("MessageBubble Component", () => {
  const mockTimestamp = new Date("2026-06-29T12:00:00Z");

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders user messages as plain text without markdown parsing", () => {
    const message = {
      id: "1",
      role: "user" as const,
      content: "Hello **world** with `code` block",
      timestamp: mockTimestamp,
    };

    const { getByText, queryByText } = render(<MessageBubble message={message} />);
    
    // User messages render content directly as a string
    expect(getByText("Hello **world** with `code` block")).toBeInTheDocument();
    // No formatting wrappers should be parsed
    expect(queryByText("world")).not.toBeInTheDocument();
  });

  it("renders assistant messages with parsed markdown-lite", () => {
    const message = {
      id: "2",
      role: "assistant" as const,
      content: "This is **bold** text and `inline code` block.",
      timestamp: mockTimestamp,
    };

    const { getByText } = render(<MessageBubble message={message} />);
    
    // Check parsed bold element
    const boldEl = getByText("bold");
    expect(boldEl.tagName).toBe("STRONG");

    // Check parsed inline code element
    const codeEl = getByText("inline code");
    expect(codeEl.tagName).toBe("CODE");
  });

  it("renders fenced code blocks with a Copy button", () => {
    const message = {
      id: "3",
      role: "assistant" as const,
      content: "Here is your code:\n```bash\nkubectl get pods -n kube-system\n```",
      timestamp: mockTimestamp,
    };

    const { getByText } = render(<MessageBubble message={message} />);
    
    expect(getByText("kubectl get pods -n kube-system")).toBeInTheDocument();
    expect(getByText("Copy")).toBeInTheDocument();
  });

  describe("Clipboard Copy Logic", () => {
    const originalClipboard = navigator.clipboard;
    const originalExecCommand = document.execCommand;

    beforeEach(() => {
      // Mock navigator.clipboard
      Object.defineProperty(navigator, "clipboard", {
        value: {
          writeText: jest.fn(),
        },
        writable: true,
        configurable: true,
      });
      // Mock document.execCommand
      document.execCommand = jest.fn();
    });

    afterAll(() => {
      Object.defineProperty(navigator, "clipboard", {
        value: originalClipboard,
        writable: true,
        configurable: true,
      });
      document.execCommand = originalExecCommand;
    });

    it("uses navigator.clipboard.writeText if available", async () => {
      const writeTextMock = jest.fn().mockResolvedValue(undefined);
      (navigator.clipboard.writeText as jest.Mock) = writeTextMock;

      const message = {
        id: "4",
        role: "assistant" as const,
        content: "```javascript\nconst a = 1;\n```",
        timestamp: mockTimestamp,
      };

      const { getByText, findByText } = render(<MessageBubble message={message} />);
      const copyBtn = getByText("Copy");

      fireEvent.click(copyBtn);

      expect(writeTextMock).toHaveBeenCalledWith("const a = 1;\n");
      
      // Wait for React state update of copied feedback
      await findByText("✓ Copied");
    });

    it("falls back to execCommand('copy') when navigator.clipboard fails", async () => {
      // Make clipboard API throw to test fallback
      const writeTextMock = jest.fn().mockRejectedValue(new Error("Permission Denied"));
      (navigator.clipboard.writeText as jest.Mock) = writeTextMock;

      const execMock = jest.fn().mockReturnValue(true);
      document.execCommand = execMock;

      const message = {
        id: "5",
        role: "assistant" as const,
        content: "```javascript\nconst a = 2;\n```",
        timestamp: mockTimestamp,
      };

      const { getByText, findByText } = render(<MessageBubble message={message} />);
      const copyBtn = getByText("Copy");

      fireEvent.click(copyBtn);

      expect(writeTextMock).toHaveBeenCalledWith("const a = 2;\n");
      
      // Await the state change first, which happens in the catch microtask
      await findByText("✓ Copied");
      expect(execMock).toHaveBeenCalledWith("copy");
    });

    it("falls back to execCommand('copy') when navigator.clipboard is undefined", async () => {
      // Delete clipboard API
      Object.defineProperty(navigator, "clipboard", {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const execMock = jest.fn().mockReturnValue(true);
      document.execCommand = execMock;

      const message = {
        id: "6",
        role: "assistant" as const,
        content: "```bash\nclear\n```",
        timestamp: mockTimestamp,
      };

      const { getByText, findByText } = render(<MessageBubble message={message} />);
      const copyBtn = getByText("Copy");

      fireEvent.click(copyBtn);

      await findByText("✓ Copied");
      expect(execMock).toHaveBeenCalledWith("copy");
    });
  });

  it("renders error messages with error styling and icon", () => {
    const message = {
      id: "7",
      role: "error" as const,
      content: "Something went wrong",
      timestamp: mockTimestamp,
    };

    const { getByText } = render(<MessageBubble message={message} />);
    
    expect(getByText("Something went wrong")).toBeInTheDocument();
    expect(getByText("⚠️")).toBeInTheDocument();
    
    const bubble = getByText("Something went wrong").closest("div");
    expect(bubble).toHaveClass("bubbleError");
  });
});
