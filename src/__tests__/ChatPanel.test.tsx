import React from "react";
import { render, fireEvent, act } from "@testing-library/react";
import { ChatPanel } from "../components/ChatPanel";
import { useChat } from "../hooks/useChat";
import { fetchLLMStatus } from "../api/chatClient";

// Mock the dependencies
jest.mock("@k8slens/extensions", () => ({
  Renderer: {
    Catalog: {
      activeCluster: {
        metadata: {
          name: "test-cluster",
        },
        spec: {
          kubeconfigContext: "test-context",
        },
      },
    },
  },
}));

jest.mock("../hooks/useChat");
jest.mock("../api/chatClient");

describe("ChatPanel Component", () => {
  const mockSendMessage = jest.fn();
  const mockClearHistory = jest.fn();
  const mockClearContext = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (fetchLLMStatus as jest.Mock).mockResolvedValue({
      provider: "Gemini",
      model: "gemini-2.5-flash",
    });
  });

  const setupMockUseChat = (overrides = {}) => {
    (useChat as jest.Mock).mockReturnValue({
      messages: [],
      isLoading: false,
      error: null,
      sendMessage: mockSendMessage,
      clearHistory: mockClearHistory,
      clearContext: mockClearContext,
      llmStatus: null,
      ...overrides,
    });
  };

  const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

  const renderChatPanel = async (overrides = {}) => {
    setupMockUseChat(overrides);
    let result: any;
    await act(async () => {
      result = render(<ChatPanel />);
      await flushPromises();
    });
    return result;
  };

  it("should render chat panel and fetch LLM status on mount", async () => {
    const { getByText } = await renderChatPanel();
    expect(getByText("Kube Chat")).toBeInTheDocument();
    expect(getByText("test-cluster")).toBeInTheDocument();
    expect(fetchLLMStatus).toHaveBeenCalledTimes(1);
  });

  it("should disable Clear Context button when conversation is empty", async () => {
    const { getByRole } = await renderChatPanel({ messages: [] });
    const clearContextBtn = getByRole("button", { name: /clear api context/i });
    expect(clearContextBtn).toBeDisabled();
  });

  it("should disable Clear Context button when last message is a system message", async () => {
    const { getByRole } = await renderChatPanel({
      messages: [
        { id: "1", role: "user", content: "hello", timestamp: new Date() },
        { id: "2", role: "system", content: "Context cleared", timestamp: new Date() },
      ],
    });

    const clearContextBtn = getByRole("button", { name: /clear api context/i });
    expect(clearContextBtn).toBeDisabled();
  });

  it("should enable Clear Context button when there are messages and last is not system", async () => {
    const { getByRole } = await renderChatPanel({
      messages: [
        { id: "1", role: "user", content: "hello", timestamp: new Date() },
      ],
    });

    const clearContextBtn = getByRole("button", { name: /clear api context/i });
    expect(clearContextBtn).not.toBeDisabled();
  });

  it("should call clearContext when Clear Context button is clicked", async () => {
    const { getByRole } = await renderChatPanel({
      messages: [
        { id: "1", role: "user", content: "hello", timestamp: new Date() },
      ],
    });

    const clearContextBtn = getByRole("button", { name: /clear api context/i });
    
    await act(async () => {
      fireEvent.click(clearContextBtn);
    });
    expect(mockClearContext).toHaveBeenCalledTimes(1);
  });

  it("should call clearHistory when Clear button is clicked", async () => {
    const { getByRole } = await renderChatPanel();
    const clearBtn = getByRole("button", { name: /clear conversation history/i });
    
    await act(async () => {
      fireEvent.click(clearBtn);
    });
    expect(mockClearHistory).toHaveBeenCalledTimes(1);
  });

  it("should handle sending a query", async () => {
    mockSendMessage.mockResolvedValue(undefined);
    const { getByPlaceholderText } = await renderChatPanel();
    const input = getByPlaceholderText(/ask about your cluster/i);
    
    await act(async () => {
      fireEvent.change(input, { target: { value: "how many deployments?" } });
    });

    await act(async () => {
      fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
      await flushPromises();
    });

    expect(mockSendMessage).toHaveBeenCalledWith("how many deployments?");
  });
});
