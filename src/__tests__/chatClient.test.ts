import { sendChatMessage, fetchLLMStatus } from "../api/chatClient";

describe("chatClient", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  describe("sendChatMessage", () => {
    it("should send POST request and return response on 200 OK", async () => {
      const mockResponse = { reply: "mock reply", provider: "Gemini", model: "gemini-2.5-flash" };
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse),
      });

      const payload = {
        message: "hello",
        context: { clusterName: "test-cluster", server: "test-server", namespace: "default" },
        history: [],
      };

      const result = await sendChatMessage(payload);
      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:8000/chat",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      );
    });

    it("should throw ChatApiError on non-200 response", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: jest.fn().mockResolvedValue("Internal Server Error"),
      });

      const payload = {
        message: "hello",
        context: { clusterName: "test-cluster", server: "test-server", namespace: "default" },
        history: [],
      };

      await expect(sendChatMessage(payload)).rejects.toThrow("Chat API error 500: Internal Server Error");
    });

    it("should handle timeout correctly via AbortController", async () => {
      jest.useFakeTimers();
      
      const mockAbort = jest.fn();
      const mockController = {
        signal: {} as AbortSignal,
        abort: mockAbort,
      };

      const originalAbortController = global.AbortController;
      global.AbortController = jest.fn().mockImplementation(() => mockController) as any;

      const fetchPromise = jest.fn().mockImplementation(() => {
        return new Promise((_, reject) => {
          const err = new Error("Request timed out after 30 seconds.");
          err.name = "AbortError";
          reject(err);
        });
      });
      global.fetch = fetchPromise;

      const payload = {
        message: "hello",
        context: { clusterName: "test", server: "test", namespace: "default" },
        history: [],
      };

      const promise = sendChatMessage(payload);
      
      // Fast forward the 30s timeout timer
      jest.advanceTimersByTime(30000);

      await expect(promise).rejects.toThrow("Request timed out after 30 seconds.");
      expect(mockAbort).toHaveBeenCalled();

      global.AbortController = originalAbortController;
      jest.useRealTimers();
    });
  });

  describe("fetchLLMStatus", () => {
    it("should return status metadata on success", async () => {
      const mockStatus = { provider: "Gemini", model: "gemini-2.5-flash" };
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockStatus),
      });

      const result = await fetchLLMStatus();
      expect(result).toEqual(mockStatus);
      expect(global.fetch).toHaveBeenCalledWith("http://localhost:8000/status");
    });

    it("should return Offline fallback on non-ok status response", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
      });

      const result = await fetchLLMStatus();
      expect(result).toEqual({ provider: "Offline", model: "none" });
    });

    it("should return Offline fallback on fetch exception", async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error("network error"));

      const result = await fetchLLMStatus();
      expect(result).toEqual({ provider: "Offline", model: "none" });
    });
  });
});
