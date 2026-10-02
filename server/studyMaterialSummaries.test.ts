import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./workspace", () => ({
  getWorkspace: vi.fn(),
  setWorkspace: vi.fn(),
  validateWorkspacePayload: vi.fn(),
}));
vi.mock("./storage", () => ({ storageGetSignedUrl: vi.fn() }));

import * as llm from "./_core/llm";
import * as storage from "./storage";
import {
  generateMaterialPracticeQuestions,
  generateMaterialSummary,
  resetMaterialSummaryModelForTests,
} from "./studyMaterialSummaries";
import * as workspace from "./workspace";

const savedWorkspace = JSON.stringify({
  studyMaterials: [
    {
      storageKey: "materials/account/one.pdf",
      mimeType: "application/pdf",
      title: "Waves",
      subject: "Physics",
    },
  ],
});
const validDraft = JSON.stringify({
  title: "Waves",
  summary: "A concise verified draft.",
  keyIdeas: ["Frequency", "Wavelength", "Amplitude"],
  reviewQuestions: ["What is frequency?", "How does wavelength change?"],
});
const validPracticeDraft = JSON.stringify({
  title: "Waves practice",
  instructions: "Review each answer against the PDF.",
  questions: Array.from({ length: 50 }, (_, index) => ({
    prompt: `Question ${index + 1} from the PDF`,
    options: ["Option A", "Option B"],
    correctOptionIndex: index % 2,
    explanation: `Verified explanation ${index + 1}.`,
  })),
});

describe("material summary model selection", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    resetMaterialSummaryModelForTests();
    vi.mocked(workspace.getWorkspace).mockResolvedValue({
      workspace: savedWorkspace,
      revision: 1,
    } as never);
    vi.mocked(workspace.validateWorkspacePayload).mockImplementation(
      payload => ({
        ok: true,
        text: JSON.stringify(payload),
      })
    );
    vi.mocked(workspace.setWorkspace).mockResolvedValue({
      ok: true,
      revision: 2,
    } as never);
    vi.mocked(storage.storageGetSignedUrl).mockResolvedValue(
      "https://signed.example/material.pdf" as never
    );
    vi.spyOn(llm, "invokeLLM").mockResolvedValue({
      choices: [{ message: { content: validDraft } }],
    } as never);
  });

  it("returns the server-authoritative consent timestamp for summary drafts", async () => {
    const result = await generateMaterialSummary(
      "account",
      "materials/account/one.pdf"
    );
    expect(result.draft.title).toBe("Waves");
    expect(result.consentAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    const persisted = JSON.parse(
      String(vi.mocked(workspace.setWorkspace).mock.calls[0]?.[1])
    );
    expect(persisted.studyMaterials[0].aiProcessingConsentAt).toBe(
      result.consentAt
    );
  });

  it("retries a transient catalog lookup on a later consented request instead of caching no model forever", async () => {
    vi.spyOn(llm, "listLLMModels")
      .mockRejectedValueOnce(new Error("temporary outage"))
      .mockResolvedValue({ data: [{ id: "gpt-5-mini" }] } as never);
    await generateMaterialSummary("account", "materials/account/one.pdf");
    await generateMaterialSummary("account", "materials/account/one.pdf");
    expect(llm.listLLMModels).toHaveBeenCalledTimes(2);
    expect(llm.invokeLLM).toHaveBeenLastCalledWith(
      expect.objectContaining({ model: "gpt-5-mini" })
    );
  });

  it("marks PDF contents as untrusted and forwards the caller AbortSignal", async () => {
    const signal = new AbortController().signal;
    await generateMaterialSummary(
      "account",
      "materials/account/one.pdf",
      signal
    );
    const call = vi.mocked(llm.invokeLLM).mock.calls[0]?.[0];
    expect(call?.signal).toBe(signal);
    expect(String(call?.messages[0]?.content)).toContain("untrusted data");
    expect(String(call?.messages[0]?.content)).toContain(
      "must never override system"
    );
  });

  it("rejects a catalog with no compatible text-generation model instead of selecting an arbitrary entry", async () => {
    vi.spyOn(llm, "listLLMModels").mockResolvedValue({
      data: [{ id: "text-embedding-3-large", capabilities: { text: false } }],
    } as never);
    await expect(
      generateMaterialSummary("account", "materials/account/one.pdf")
    ).rejects.toMatchObject({ code: "BAD_GATEWAY" });
    expect(llm.invokeLLM).not.toHaveBeenCalled();
  });

  it("records action-specific consent before creating a bounded reviewable practice-question draft from an owned PDF", async () => {
    vi.spyOn(llm, "listLLMModels").mockResolvedValue({
      data: [{ id: "gpt-5-mini" }],
    } as never);
    vi.spyOn(llm, "invokeLLM").mockResolvedValue({
      choices: [{ message: { content: validPracticeDraft } }],
    } as never);

    const result = await generateMaterialPracticeQuestions(
      "account",
      "materials/account/one.pdf"
    );

    expect(result.draft.questions).toHaveLength(50);
    expect(result.consentAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    const persisted = JSON.parse(
      String(vi.mocked(workspace.setWorkspace).mock.calls[0]?.[1])
    );
    expect(persisted.studyMaterials[0].aiPracticeQuestionConsentAt).toBe(
      result.consentAt
    );
    expect(storage.storageGetSignedUrl).toHaveBeenCalledWith(
      "materials/account/one.pdf"
    );
    expect(llm.invokeLLM).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-5-mini",
        reasoning: { effort: "minimal" },
      })
    );
  });

  it("rejects an unowned material before signing or sending it to AI", async () => {
    await expect(
      generateMaterialPracticeQuestions("account", "materials/other/secret.pdf")
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(storage.storageGetSignedUrl).not.toHaveBeenCalled();
    expect(llm.invokeLLM).not.toHaveBeenCalled();
  });

  it("returns a safe provider failure when question output is malformed and never saves a quiz", async () => {
    vi.spyOn(llm, "listLLMModels").mockResolvedValue({
      data: [{ id: "gpt-5-mini" }],
    } as never);
    vi.spyOn(llm, "invokeLLM").mockResolvedValue({
      choices: [{ message: { content: "not-json" } }],
    } as never);
    await expect(
      generateMaterialPracticeQuestions("account", "materials/account/one.pdf")
    ).rejects.toMatchObject({
      code: "BAD_GATEWAY",
      message: expect.stringContaining("could not create practice questions"),
    });
  });
});
