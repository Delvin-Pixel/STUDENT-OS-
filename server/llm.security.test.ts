import { describe, expect, it } from "vitest";
import { safeLlmUpstreamError, validatedAiApiKey } from "./_core/llm";

describe("shared LLM security boundary", () => {
  it("rejects blank credentials without naming an unrelated provider secret", () => {
    expect(() => validatedAiApiKey("  ")).toThrow("AI service configuration");
  });

  it("does not disclose upstream response bodies in learner-safe errors", () => {
    const error = safeLlmUpstreamError("invoke", 502);
    expect(error.message).toContain("HTTP 502");
    expect(error.message).not.toContain("Bearer");
    expect(error.message).not.toContain("upstream body");
  });
});
