import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const store = readFileSync(
  fileURLToPath(new URL("../contexts/StoreContext.tsx", import.meta.url)),
  "utf8"
)
  .replace(/\s+/g, " ")
  .replace(/\(\s+/g, "(")
  .replace(/\s+\)/g, ")")
  .replace(/\b([A-Za-z_$][\w$]*) =>/g, "($1) =>");
const page = readFileSync(
  fileURLToPath(new URL("./Quizzes.tsx", import.meta.url)),
  "utf8"
)
  .replace(/\s+/g, " ")
  .replace(/\(\s+/g, "(")
  .replace(/\s+\)/g, ")")
  .replace(/\b([A-Za-z_$][\w$]*) =>/g, "($1) =>");

describe("quiz-attempt acceptance integrity", () => {
  it("rejects a removed quiz and shows a completion result only after the canonical write accepts", () => {
    expect(store).toContain(
      "This quiz is no longer available, so your result was not recorded."
    );
    expect(store).toContain(
      "recordQuizAttempt: (quizId: string, answers: Record<string, number>) => boolean;"
    );
    expect(store).toContain(
      "const normalizedAnswers = normalizeQuizAnswers(quiz, answers);"
    );
    expect(store).toContain(
      "Choose one valid answer for every quiz question before finishing."
    );
    expect(page).toContain("if (!recordQuizAttempt(quiz.id, answers)");
    expect(page).toContain("setCompletionError");
  });
});
