import "@shared/sourceAssertions";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(new URL("./MaterialSummary.tsx", import.meta.url)),
  "utf8"
);

describe("reviewed material quiz saves", () => {
  it("restores manual and AI-derived claims while preserving reviewed drafts when canonical creation rejects", () => {
    expect(source).toContainSource(
      "if (manualQuizSaveClaimRef.current) return;"
    );
    expect(source).toContainSource("manualQuizSaveClaimRef.current = true;");
    expect(source).toContainSource(
      "const accepted = createQuiz({ title: `${draft.title} — reviewed practice`"
    );
    expect(source).toContainSource("manualQuizSaveClaimRef.current = false;");
    expect(source).toContainSource("Your prompts are still here.");
    expect(source).toContainSource(
      "if (generatedQuizSaveClaimRef.current) return;"
    );
    expect(source).toContainSource("generatedQuizSaveClaimRef.current = true;");
    expect(source).toContainSource(
      "const accepted = createQuiz({ title: `${materialQuestionDraft.title} — reviewed material practice`"
    );
    expect(source).toContainSource(
      "generatedQuizSaveClaimRef.current = false;"
    );
    expect(source).toContainSource("It is still here for you to review.");
  });

  it("releases each claim only after its draft is cleared", () => {
    expect(source).toContainSource(
      "if (!practicePrompts) manualQuizSaveClaimRef.current = false;"
    );
    expect(source).toContainSource(
      "if (!materialQuestionDraft) generatedQuizSaveClaimRef.current = false;"
    );
  });

  it("resolves reviewed material quiz links against manual and exam canonical topics before claiming a save", () => {
    expect(source).toContainSource(
      "...state.exams.flatMap((exam) => exam.topics.map((topic) => [topic.id, { id: topic.id, subject: exam.subject, name: topic.name }] as const))"
    );
    expect(source).toContainSource(
      "const currentTopic = draft.material.topicId ? canonicalTopics.find((topic) => topic.id === draft.material.topicId) : undefined;"
    );
    expect(source).toContainSource(
      "const currentTopic = materialQuestionDraft.material.topicId ? canonicalTopics.find((topic) => topic.id === materialQuestionDraft.material.topicId) : undefined;"
    );
    expect(source).toContainSource(
      "if (draft.material.topicId && !currentTopic)"
    );
    expect(source).toContainSource(
      "if (materialQuestionDraft.material.topicId && !currentTopic)"
    );
  });
});
