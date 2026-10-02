import { describe, expect, it } from "vitest";

describe("OpenAI credential", () => {
  it("authenticates against the official models endpoint", async () => {
    const apiKey = process.env.OPENAI_API_KEY;
    expect(apiKey).toBeTruthy();

    const response = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10_000),
    });

    expect(
      response.ok,
      `OpenAI credential validation failed with ${response.status}`
    ).toBe(true);
  }, 15_000);
});
