import React from "react";
import { render, fireEvent, act } from "@testing-library/react";
import { ChatInput } from "../components/ChatInput";

describe("ChatInput Component", () => {
  const mockOnSend = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const setup = (overrides = {}) => {
    return render(
      <ChatInput
        onSend={mockOnSend}
        isLoading={false}
        userQueries={[]}
        {...overrides}
      />
    );
  };

  it("should render textarea and send button", () => {
    const { getByPlaceholderText, getByRole } = setup();
    expect(getByPlaceholderText(/Ask about your cluster/i)).toBeInTheDocument();
    expect(getByRole("button", { name: /send message/i })).toBeInTheDocument();
  });

  it("should update character count as user types", () => {
    const { getByPlaceholderText, getByText } = setup();
    const textarea = getByPlaceholderText(/Ask about your cluster/i);

    fireEvent.change(textarea, { target: { value: "hello cluster" } });
    expect(getByText("13 / 2000")).toBeInTheDocument();
  });

  it("should call onSend and clear input when send button is clicked", async () => {
    mockOnSend.mockResolvedValue(undefined);
    const { getByPlaceholderText, getByRole } = setup();
    const textarea = getByPlaceholderText(/Ask about your cluster/i);
    const sendBtn = getByRole("button", { name: /send message/i });

    fireEvent.change(textarea, { target: { value: "reboot cluster" } });
    
    await act(async () => {
      fireEvent.click(sendBtn);
    });

    expect(mockOnSend).toHaveBeenCalledWith("reboot cluster");
    expect(textarea.textContent).toBe("");
  });

  it("should call onSend when Enter is pressed without Shift", async () => {
    mockOnSend.mockResolvedValue(undefined);
    const { getByPlaceholderText } = setup();
    const textarea = getByPlaceholderText(/Ask about your cluster/i);

    fireEvent.change(textarea, { target: { value: "show pods" } });
    
    await act(async () => {
      fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });
    });

    expect(mockOnSend).toHaveBeenCalledWith("show pods");
  });

  it("should not call onSend when Enter is pressed with Shift", async () => {
    const { getByPlaceholderText } = setup();
    const textarea = getByPlaceholderText(/Ask about your cluster/i);

    fireEvent.change(textarea, { target: { value: "new line text" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });

    expect(mockOnSend).not.toHaveBeenCalled();
  });

  it("should disable input and show spinner when loading", () => {
    const { getByPlaceholderText, getByRole, container } = setup({ isLoading: true });
    const textarea = getByPlaceholderText(/Ask about your cluster/i);
    const sendBtn = getByRole("button", { name: /send message/i });

    expect(textarea).toBeDisabled();
    expect(sendBtn).toBeDisabled();
    expect(container.querySelector(".spinner")).toBeInTheDocument();
  });

  it("should recall queries using ArrowUp and ArrowDown keys", async () => {
    const userQueries = ["first query", "second query", "third query"];
    const { getByPlaceholderText } = setup({ userQueries });
    const textarea = getByPlaceholderText(/Ask about your cluster/i) as HTMLTextAreaElement;

    // Simulate typing a draft message
    await act(async () => {
      fireEvent.change(textarea, { target: { value: "my draft" } });
    });
    
    // Set selectionStart to 0 to simulate cursor at the beginning
    textarea.selectionStart = 0;
    
    // Press ArrowUp to recall "third query" (last query in list)
    await act(async () => {
      fireEvent.keyDown(textarea, { key: "ArrowUp" });
    });
    expect(textarea.value).toBe("third query");

    // Keep selectionStart at 0
    textarea.selectionStart = 0;

    // Press ArrowUp again to recall "second query"
    await act(async () => {
      fireEvent.keyDown(textarea, { key: "ArrowUp" });
    });
    expect(textarea.value).toBe("second query");

    // Keep selectionStart at 0
    textarea.selectionStart = 0;

    // Press ArrowUp again to recall "first query"
    await act(async () => {
      fireEvent.keyDown(textarea, { key: "ArrowUp" });
    });
    expect(textarea.value).toBe("first query");

    // Set selectionStart to end of value for ArrowDown
    textarea.selectionStart = textarea.value.length;

    // Press ArrowDown to recall "second query"
    await act(async () => {
      fireEvent.keyDown(textarea, { key: "ArrowDown" });
    });
    expect(textarea.value).toBe("second query");

    // Set selectionStart to end of value for ArrowDown
    textarea.selectionStart = textarea.value.length;

    // Press ArrowDown to recall "third query"
    await act(async () => {
      fireEvent.keyDown(textarea, { key: "ArrowDown" });
    });
    expect(textarea.value).toBe("third query");

    // Set selectionStart to end of value for ArrowDown
    textarea.selectionStart = textarea.value.length;

    // Press ArrowDown to restore draft "my draft"
    await act(async () => {
      fireEvent.keyDown(textarea, { key: "ArrowDown" });
    });
    expect(textarea.value).toBe("my draft");
  });
});
