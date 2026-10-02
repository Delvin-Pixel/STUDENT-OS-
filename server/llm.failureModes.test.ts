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
});
