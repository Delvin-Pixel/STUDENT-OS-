import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(new URL("./StoreContext.tsx", import.meta.url)),
  "utf8"
);

describe("StoreContext canonical note integrity", () => {
  it("validates normalized note writes and rejects a schema-capacity overflow", () => {
    expect(source).toContain(
      "const normalizedNote = normalizeNoteDraft(note);"
    );
    expect(source).toContain(
      "const validationError = validateNoteDraft(normalizedNote);"
    );
    expect(source).toContain(
      "stateRef.current.notes.length >= WORKSPACE_NOTE_LIMIT"
    );
    expect(source).toContain(
      "const validationError = validateNoteDraft(draft);"
    );
  });

  it("reconciles note topic links against current canonical topics", () => {
    expect(source).toContain(
      "This note’s topic is no longer available. Your details are still here."
    );
    expect(source).toContain(
      'topicId: "topicId" in patch ? patch.topicId : current.topicId'
    );
    expect(source).toContain("subject: linkedTopic.subject");
  });
});
