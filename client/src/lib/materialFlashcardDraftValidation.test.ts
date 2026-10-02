import { describe, expect, it } from "vitest";
import { admitMaterialFlashcardDraft } from "./materialFlashcardDraftValidation";

const draft = {
  title: "Waves",
  subject: "Physics",
  topicId: "waves",
  keyIdeas: [
    "Waves transfer energy.",
    "Frequency is measured in hertz.",
    "Amplitude affects energy.",
  ],
};
const context = {
  deckCount: 0,
  deckLimit: 500,
  topics: [
    {
      id: "waves",
      subject: "Physics",
      name: "Waves",
      source: "manual" as const,
      createdAt: "",
      updatedAt: "",
    },
  ],
  exams: [],
};

describe("reviewed material flashcard draft admission", () => {
  it("admits a bounded reviewed draft with a current canonical topic", () => {
    expect(admitMaterialFlashcardDraft(draft, context)).toEqual(
      expect.objectContaining({ accepted: true })
    );
  });

  it("rejects a removed topic, malformed ideas, and a full deck collection before a deck can be created", () => {
    expect(
      admitMaterialFlashcardDraft(draft, { ...context, topics: [] })
    ).toEqual({ accepted: false, reason: "stale_topic" });
    expect(
      admitMaterialFlashcardDraft(
        { ...draft, keyIdeas: ["", "Valid", "Also valid"] },
        context
      )
    ).toEqual({ accepted: false, reason: "invalid" });
    expect(
      admitMaterialFlashcardDraft(draft, { ...context, deckCount: 500 })
    ).toEqual({ accepted: false, reason: "deck_capacity" });
  });
});
