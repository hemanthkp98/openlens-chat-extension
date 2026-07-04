import { renderHook, act } from "@testing-library/react-hooks";
import { useChat } from "../hooks/useChat";
import { sendChatMessage } from "../api/chatClient";

jest.mock("../api/chatClient", () => ({
  sendChatMessage: jest.fn(),
}));

describe("useChat hook", () => {
  const mockContext = {
    clusterName: "test-cluster",
    server: "test-server",
    namespace: "default",
  };

  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  it("should initialize with empty messages if localStorage is empty", () => {
    const { result } = renderHook(() => useChat(mockContext));
    expect(result.current.messages).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("should load history from localStorage on mount", () => {
    const mockHistory = [
      { id: "1", role: "user", content: "hello", timestamp: new Date().toISOString() },
      { id: "2", role: "assistant", content: "hi", timestamp: new Date().toISOString() },
    ];
    localStorage.setItem("kube-chat:test-cluster", JSON.stringify(mockHistory));

    const { result } = renderHook(() => useChat(mockContext));
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0].content).toBe("hello");
    expect(result.current.messages[1].content).toBe("hi");
  });

  it("should reload history when context.clusterName changes", () => {
    const mockHistoryCluster1 = [
      { id: "1", role: "user", content: "hello c1", timestamp: new Date().toISOString() },
    ];
    const mockHistoryCluster2 = [
      { id: "2", role: "user", content: "hello c2", timestamp: new Date().toISOString() },
    ];
    localStorage.setItem("kube-chat:c1", JSON.stringify(mockHistoryCluster1));
    localStorage.setItem("kube-chat:c2", JSON.stringify(mockHistoryCluster2));

    const { result, rerender } = renderHook(
      ({ context }: { context: typeof mockContext }) => useChat(context),
      { initialProps: { context: { ...mockContext, clusterName: "c1" } } }
    );

    expect(result.current.messages[0].content).toBe("hello c1");

    rerender({ context: { ...mockContext, clusterName: "c2" } });

    expect(result.current.messages[0].content).toBe("hello c2");
  });

  it("should send message, update loading state, and append response", async () => {
    const mockResponse = { reply: "mock reply", provider: "Gemini", model: "gemini-2.5-flash" };
    (sendChatMessage as jest.Mock).mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useChat(mockContext));

    let sendPromise: Promise<void>;
    act(() => {
      sendPromise = result.current.sendMessage("test query");
    });

    // Optimistic UI updates
    expect(result.current.isLoading).toBe(true);
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].role).toBe("user");
    expect(result.current.messages[0].content).toBe("test query");

    await act(async () => {
      await sendPromise;
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[1].role).toBe("assistant");
    expect(result.current.messages[1].content).toBe("mock reply");
    expect(result.current.llmStatus).toEqual({ provider: "Gemini", model: "gemini-2.5-flash" });

    // Verify localStorage has persisted
    const raw = localStorage.getItem("kube-chat:test-cluster");
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed).toHaveLength(2);
  });

  it("should append error bubble and set error message on API failure", async () => {
    (sendChatMessage as jest.Mock).mockRejectedValue(new Error("API connection failed"));

    const { result } = renderHook(() => useChat(mockContext));

    let sendPromise: Promise<void>;
    act(() => {
      sendPromise = result.current.sendMessage("test query");
    });

    await act(async () => {
      await sendPromise;
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe("API connection failed");
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[1].role).toBe("error");
    expect(result.current.messages[1].content).toBe("API connection failed");
  });

  it("should clear history correctly", () => {
    const mockHistory = [
      { id: "1", role: "user", content: "hello", timestamp: new Date().toISOString() },
    ];
    localStorage.setItem("kube-chat:test-cluster", JSON.stringify(mockHistory));

    const { result } = renderHook(() => useChat(mockContext));
    expect(result.current.messages).toHaveLength(1);

    act(() => {
      result.current.clearHistory();
    });

    expect(result.current.messages).toHaveLength(0);
    expect(localStorage.getItem("kube-chat:test-cluster")).toBe("[]");
  });

  it("should append a system message when clearContext is called", () => {
    const mockHistory = [
      { id: "1", role: "user", content: "hello", timestamp: new Date().toISOString() },
    ];
    localStorage.setItem("kube-chat:test-cluster", JSON.stringify(mockHistory));

    const { result } = renderHook(() => useChat(mockContext));
    expect(result.current.messages).toHaveLength(1);

    act(() => {
      result.current.clearContext();
    });

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[1].role).toBe("system");
    expect(result.current.messages[1].content).toBe("Context cleared");

    // Verify localStorage has persisted with system message
    const raw = localStorage.getItem("kube-chat:test-cluster");
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed).toHaveLength(2);
    expect(parsed[1].role).toBe("system");
    expect(parsed[1].content).toBe("Context cleared");
  });

  it("should only send history after the last context clear marker when sending a message", async () => {
    (sendChatMessage as jest.Mock).mockResolvedValue({ reply: "reply" });

    const mockHistory = [
      { id: "1", role: "user", content: "pre-clear 1", timestamp: new Date().toISOString() },
      { id: "2", role: "assistant", content: "pre-clear 2", timestamp: new Date().toISOString() },
      { id: "3", role: "system", content: "Context cleared", timestamp: new Date().toISOString() },
      { id: "4", role: "user", content: "post-clear 1", timestamp: new Date().toISOString() },
    ];
    localStorage.setItem("kube-chat:test-cluster", JSON.stringify(mockHistory));

    const { result } = renderHook(() => useChat(mockContext));
    expect(result.current.messages).toHaveLength(4);

    (sendChatMessage as jest.Mock).mockClear();

    await act(async () => {
      await result.current.sendMessage("new query");
    });

    expect(sendChatMessage).toHaveBeenCalledTimes(1);
    const lastCallArg = (sendChatMessage as jest.Mock).mock.calls[0][0];

    // The history should only include messages after the system marker
    expect(lastCallArg.history).toHaveLength(1);
    expect(lastCallArg.history[0].content).toBe("post-clear 1");
    expect(lastCallArg.message).toBe("new query");
  });

  it("should truncate history to last 20 messages when sending", async () => {
    (sendChatMessage as jest.Mock).mockResolvedValue({ reply: "reply" });

    // Seed localStorage directly with 25 turns (alternating user / assistant)
    const seededMessages = [];
    for (let i = 0; i < 25; i++) {
      seededMessages.push({
        id: `${i}`,
        role: i % 2 === 0 ? "user" : "assistant",
        content: `message ${i}`,
        timestamp: new Date().toISOString(),
      });
    }
    localStorage.setItem("kube-chat:test-cluster", JSON.stringify(seededMessages));

    const { result } = renderHook(() => useChat(mockContext));
    expect(result.current.messages).toHaveLength(25);

    // Clear call history to check exact payload of the next send
    (sendChatMessage as jest.Mock).mockClear();

    await act(async () => {
      await result.current.sendMessage("new query");
    });

    expect(sendChatMessage).toHaveBeenCalledTimes(1);
    const lastCallArg = (sendChatMessage as jest.Mock).mock.calls[0][0];
    
    // Check that history array sent to backend is capped at MAX_HISTORY = 20
    expect(lastCallArg.history).toHaveLength(20);
    // Should be the last 20 messages from the seeded array (index 5 to 24)
    expect(lastCallArg.history[0].content).toBe("message 5");
    expect(lastCallArg.history[19].content).toBe("message 24");
    expect(lastCallArg.message).toBe("new query");
  });
});
