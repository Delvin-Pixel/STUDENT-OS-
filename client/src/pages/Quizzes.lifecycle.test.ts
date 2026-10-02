import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(new URL("./Quizzes.tsx", import.meta.url)),
  "utf8"
);

describe("Practice quiz completion integrity", () => {
  it("guards the canonical attempt recording path from repeated finish activation", () => {
    expect(source).toContain("const completingRef = useRef(false);");
    expect(source).toContain(
      "if (completingRef.current || result !== null) return;"
    );
    expect(source).toContain("completingRef.current = true;");
    expect(source).toContain("if (!recordQuizAttempt(quiz.id, answers))");
  });

  it("validates before claiming and preserves the manual builder draft when canonical creation rejects", () => {
    expect(source).toContain("const saveClaimRef = useRef(false);");
    expect(source).toContain("if (!open) saveClaimRef.current = false;");
    expect(source).toContain("const validationError = validateNewQuiz(quiz);");
    expect(source).toContain("if (saveClaimRef.current) return;");
    expect(source).toContain("saveClaimRef.current = true;");
    expect(source).toContain("const accepted = createQuiz(quiz);");
    expect(source).toContain("Your details are still here.");
  });
});
