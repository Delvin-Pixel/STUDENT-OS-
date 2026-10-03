import { afterEach, describe, expect, it, vi } from "vitest";
import * as llmModule from "./_core/llm";
import { answerStudyAssistantQuestion } from "./studyAssistant";
import { callNexaProvider } from "./nexaProvider";

vi.mock("./nexaProvider", async () => {
  const actual =
    await vi.importActual<typeof import("./nexaProvider")>("./nexaProvider");
  return {
    ...actual,
    callNexaProvider: vi.fn(),
  };
});

describe("Study Assistant NEXA integration", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("uses NEXA first for a text tutoring request with server-owned academic context", async () => {
    vi.mocked(callNexaProvider).mockResolvedValue({
      ok: true,
      answer: "Factorisation rewrites an expression as a product of factors.",
      requestId: "nexa-request-1",
      capability: "explain",
    });
    const llmSpy = vi.spyOn(llmModule, "invokeLLM");

    const academicContext = {
      authority: "student-os-learning-intelligence" as const,
      snapshotId: "workspace:12",
      evidence: ["Canonical readiness is 48/100."],
      constraints: ["Do not change readiness."],
    };

    const result = await answerStudyAssistantQuestion(
      { question: "Explain factorisation" },
      undefined,
      {
        userId: "student-1",
        academicContext,
      }
    );

    expect(result).toEqual({
      answer: "Factorisation rewrites an expression as a product of factors.",
      source: "nexa",
    });
    expect(callNexaProvider).toHaveBeenCalledWith({
      userId: "student-1",
      question: "Explain factorisation",
      academicContext,
      signal: undefined,
    });
    expect(llmSpy).not.toHaveBeenCalled();
  });
});
