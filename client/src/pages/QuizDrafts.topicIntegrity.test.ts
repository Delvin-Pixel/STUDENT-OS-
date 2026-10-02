import "@shared/sourceAssertions";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(new URL("./QuizDrafts.tsx", import.meta.url)),
  "utf8"
)
  .replace(/\s+/g, " ")
  .replace(/\(\s+/g, "(")
  .replace(/\s+\)/g, ")")
  .replace(/\b([A-Za-z_$][\w$]*) =>/g, "($1) =>");

describe("AI Quiz academic-selection integrity", () => {
  it("uses only onboarding-selected subjects or courses, requires a typed topic, drops stale responses, and launches the reviewed quiz", () => {
    expect(source).toContainSource(
      "const profileSelections = useMemo(() => state.profile?.subjects ?? [], [state.profile?.subjects]);"
    );
    expect(source).toContain("academicSelectionLabelFor(");
    expect(source).toContain("Choose your {selectionLabel}");
    expect(source).toContain("Type your topic");
    expect(source).toContain("const requestKey = `${subject}\\u0000${topic}`;");
    expect(source).toContain(
      "if (draftRequestTopicRef.current !== requestKey) return;"
    );
    expect(source).toMatch(
      /disabled=\{\s*!selectedSubject \|\| !typedTopic\.trim\(\) \|\| generate\.isPending\s*\}/
    );
    expect(source).toContain(
      "navigate(`/ai-quiz/library?quizId=${encodeURIComponent(quizId)}`);"
    );
  });
});
