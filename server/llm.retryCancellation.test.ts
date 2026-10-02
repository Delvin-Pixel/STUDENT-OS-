import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./_core/env", () => ({
  ENV: {
    openAiApiBaseUrl: "https://api.example.test",
    openAiApiKey: "test-key",
  },
}));

import { invokeLLM } from "./_core/llm";

describe("LLM retry and cancellation policy", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("does not retry permanent client errors", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("invalid request", {
        status: 400,
        statusText: "Bad Request",
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      invokeLLM({ messages: [{ role: "user", content: "Hello" }] })
    ).rejects.toThrow("HTTP 400");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("forwards AbortSignal and stops before retry backoff when cancelled", async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn().mockImplementation(async (_url, init) => {
      // The transport combines caller cancellation with its own timeout signal.
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      expect(init.signal.aborted).toBe(false);
      controller.abort();
      expect(init.signal.aborted).toBe(true);
      throw new DOMException("aborted", "AbortError");
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      invokeLLM({
        signal: controller.signal,
        messages: [{ role: "user", content: "Hello" }],
      })
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
