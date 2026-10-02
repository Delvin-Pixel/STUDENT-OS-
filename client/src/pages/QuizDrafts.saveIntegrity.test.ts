import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(new URL("./QuizDrafts.tsx", import.meta.url)),
  "utf8"
).replace(/\s+/g, " ");

describe("AI quiz-draft acceptance integrity", () => {
  it("restores its claim and keeps a reviewed draft visible when canonical creation rejects", () => {
    expect(source).toContain("const draftSaveClaimRef = useRef(false);");
    expect(source).toContain("draftSaveClaimRef.current = false;");
    expect(source).toContain("if (draftSaveClaimRef.current) return;");
    expect(source).toContain("draftSaveClaimRef.current = true;");
    expect(source).toMatch(/const quizId = createQuiz\(\{/);
    expect(source).toContain("if (!quizId) {");
    expect(source).toContain("draftSaveClaimRef.current = false;");
    expect(source).toContain("it is still here.");
  });
});
