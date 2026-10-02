import { describe, expect, it, vi } from "vitest";

// Stable hoisted mock factory — each test assigns its own implementation
// before importing the module under test, matching the project pattern
// used in server/studyAssistant.test.ts.
vi.mock("./_core/llm", async importOriginal => {
  const actual = await importOriginal<typeof import("./_core/llm")>();
  return {
    ...actual,
    invokeLLM: vi.fn(),
  };
});

import { invokeLLM } from "./_core/llm";

describe("mediaPrompt defensive parser", () => {
  it("parses clean JSON with a prompt", async () => {
    vi.mocked(invokeLLM).mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: '{"prompt": "a diagram of solid, liquid and gas"}',
          },
        },
      ],
    } as never);
    const { parseMediaPrompt } = await import("./mediaPrompt");
    const prompt = await parseMediaPrompt(
      "Create a diagram of the states of matter",
      "",
      "stub"
    );
    expect(prompt).toContain("solid");
  });

  it("tolerates prose after the JSON object (unterminated-string failure mode)", async () => {
    vi.mocked(invokeLLM).mockResolvedValueOnce({
      choices: [
        {
          message: {
            content:
              '{"prompt": "educational diagram of the three states of matter"} extra prose from the model "and more text',
          },
        },
      ],
    } as never);
    const { parseMediaPrompt } = await import("./mediaPrompt");
    const prompt = await parseMediaPrompt(
      "Create a diagram of the states of matter",
      "",
      "stub"
    );
    expect(prompt).toContain("states of matter");
  });

  it("retries with JSON-only demand when the object slice cannot be parsed", async () => {
    vi.mocked(invokeLLM).mockResolvedValueOnce({
      choices: [{ message: { content: '{"prompt": "first diagram' } }],
    } as never);
    vi.mocked(invokeLLM).mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: '{"prompt": "retry diagram of states of matter"}',
          },
        },
      ],
    } as never);
    const { parseMediaPrompt } = await import("./mediaPrompt");
    const prompt = await parseMediaPrompt(
      "Create a diagram of the states of matter",
      "",
      "stub"
    );
    expect(prompt).toContain("retry diagram");
    expect(vi.mocked(invokeLLM).mock.calls.length).toBeGreaterThanOrEqual(2);
    // The retry must demand JSON-only output — find it among the recorded calls.
    const retryCall = vi
      .mocked(invokeLLM)
      .mock.calls.find(
        call =>
          (call[0] as { response_format?: { type: string } })?.response_format
            ?.type === "json_object"
      );
    expect(retryCall).toBeTruthy();
  });

  it("throws when even the retry yields no prompt", async () => {
    vi.mocked(invokeLLM).mockResolvedValue({
      choices: [{ message: { content: "no json at all here" } }],
    } as never);
    const { parseMediaPrompt } = await import("./mediaPrompt");
    await expect(
      parseMediaPrompt("Create a diagram", "", "stub")
    ).rejects.toThrow();
    // Both the initial call and the JSON-only retry must have been attempted.
    const retryCall = vi
      .mocked(invokeLLM)
      .mock.calls.find(
        call =>
          (call[0] as { response_format?: { type: string } })?.response_format
            ?.type === "json_object"
      );
    expect(retryCall).toBeTruthy();
  });
});
