import { describe, expect, it } from "vitest";
import { normalizeNoteDraft, validateNoteDraft } from "./noteValidation";

const validDraft = {
  title: "Newton’s laws",
  subject: "Physics",
  topicId: "topic-1",
  content: "Inertia, force, and action-reaction.",
  pinned: false,
};

describe("noteValidation", () => {
  it("normalizes and accepts a bounded note draft", () => {
    const normalized = normalizeNoteDraft({
      ...validDraft,
      title: " Newton’s laws ",
      content: " Inertia ",
    });
    expect(normalized).toMatchObject({
      title: "Newton’s laws",
      content: "Inertia",
    });
    expect(validateNoteDraft(normalized)).toBeNull();
  });

  it("rejects empty and schema-exceeding editable note fields", () => {
    expect(validateNoteDraft({ ...validDraft, title: " " })).toContain(
      "Give the note"
    );
    expect(
      validateNoteDraft({ ...validDraft, subject: "s".repeat(1_001) })
    ).toContain("note subject");
    expect(
      validateNoteDraft({ ...validDraft, content: "c".repeat(20_001) })
    ).toContain("20,000");
  });
});
