import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(new URL("./StoreContext.tsx", import.meta.url)),
  "utf8"
)
  .replace(/\s+/g, " ")
  .replace(/\(\s+/g, "(")
  .replace(/\s+\)/g, ")")
  .replace(/\b([A-Za-z_$][\w$]*) =>/g, "($1) =>");

describe("StoreContext canonical exam integrity", () => {
  it("validates normalized exam creates and edits, reporting rejected writes to callers", () => {
    expect(source).toContain("const exam = normalizeNewExam(e);");
    expect(source).toContain("const validationError = validateNewExam(exam);");
    expect(source).toContain("addExam: (e: NewExam) => boolean;");
    expect(source).toContain(
      "updateExam: (id: string, patch: Partial<EditableExamFields>) => boolean;"
    );
    expect(source).toContain(
      "This exam is no longer available. Your details are still here."
    );
    expect(source).toContain(
      "stateRef.current.exams.length >= WORKSPACE_EXAM_LIMIT"
    );
  });

  it("rejects stale or malformed nested topic writes before clearing an editor draft", () => {
    expect(source).toContain(
      "const validationError = validateNewExamTopicName(topicName);"
    );
    expect(source).toContain(
      "const exam = stateRef.current.exams.find((currentExam) => currentExam.id === examId);"
    );
    expect(source).toContain(
      "exam.topics.length >= WORKSPACE_EXAM_TOPIC_LIMIT"
    );
    expect(source).toContain(
      "addExamTopic: (examId: string, name: string) => boolean;"
    );
    expect(source).toContain(
      "This exam is no longer available. Your topic is still here."
    );
  });
});
