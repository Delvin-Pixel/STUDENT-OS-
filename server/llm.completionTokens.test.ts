import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./_core/env", () => ({
  ENV: {
    openAiApiBaseUrl: "https://api.example.test",
    openAiApiKey: "test-key",
  },
}));

import { invokeLLM } from "./_core/llm";

describe("invokeLLM completion-token forwarding", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("forwards GPT completion tokens without replacing the normal token parameter", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "test",
          created: 0,
          model: "gpt-5-mini",
          choices: [
            {
              index: 0,
              message: { role: "assistant", content: "Ready." },
              finish_reason: "stop",
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    await invokeLLM({
      model: "gpt-5-mini",
      maxCompletionTokens: 900,
      reasoning: { effort: "minimal" },
      messages: [{ role: "user", content: "Hello" }],
    });

    const payload = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(payload).toMatchObject({
      model: "gpt-5-mini",
      max_completion_tokens: 900,
      reasoning: { effort: "minimal" },
    });
    expect(payload).not.toHaveProperty("max_tokens");
  });
});
