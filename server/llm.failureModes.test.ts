import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./_core/env", () => ({
  ENV: {
    openAiApiBaseUrl: "https://api.example.test",
    openAiApiKey: "test-key",
  },
}));

import { invokeLLM, listLLMModels, StudentOsAiError } from "./_core/llm";

describe("LLM failure-mode hardening", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("classifies rate limits without leaking provider text", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("quota", { status: 429 }))
    );
    await expect(
      invokeLLM({ messages: [{ role: "user", content: "Hi" }] })
    ).rejects.toMatchObject({
      name: "StudentOsAiError",
      kind: "rate_limited",
      status: 429,
    } satisfies Partial<StudentOsAiError>);
  });

  it("rejects HTML or other non-JSON upstream bodies safely", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("<html>error</html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        })
      )
    );
    await expect(
      invokeLLM({ messages: [{ role: "user", content: "Hi" }] })
    ).rejects.toMatchObject({
      kind: "malformed_response",
    });
  });

  it("rejects structurally incomplete JSON instead of passing it downstream", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ choices: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      )
    );
    await expect(
      invokeLLM({ messages: [{ role: "user", content: "Hi" }] })
    ).rejects.toMatchObject({
      kind: "malformed_response",
    });
  });

  it("applies the same safe JSON contract to model discovery", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: [{ nope: true }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      )
    );
    await expect(listLLMModels()).rejects.toMatchObject({
      kind: "malformed_response",
    });
  });

  it("cancels an oversized streaming response before consuming its remainder", async () => {
    const cancel = vi.fn();
    let reads = 0;
    const body = new ReadableStream<Uint8Array>(
      {
        pull(controller) {
          reads += 1;
          controller.enqueue(new Uint8Array(1_000_001));
        },
        cancel,
      },
      { highWaterMark: 0 }
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(body, {
          headers: { "content-type": "application/json" },
        })
      )
    );
    await expect(listLLMModels()).rejects.toMatchObject({
      kind: "malformed_response",
      retryable: false,
    });
    expect(reads).toBe(2);
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("preserves UTF-8 characters split across response chunks", async () => {
    const bytes = new TextEncoder().encode(
      JSON.stringify({ data: [{ id: "model-ɛ" }] })
    );
    const split = bytes.indexOf(0xc9) + 1;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, split));
        controller.enqueue(bytes.slice(split));
        controller.close();
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(body, {
          headers: { "content-type": "application/json" },
        })
      )
    );
    await expect(listLLMModels()).resolves.toMatchObject({
      data: [{ id: "model-ɛ" }],
    });
  });
});
