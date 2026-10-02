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

describe("StoreContext canonical quiz integrity", () => {
  it("validates normalized quiz data and reports an accepted write to callers", () => {
    expect(source).toContain("const normalizedQuiz = normalizeNewQuiz(quiz);");
    expect(source).toContain(
      "const validationError = validateNewQuiz(normalizedQuiz);"
    );
    expect(source).toContain("createQuiz: (quiz: NewQuiz) => string | null;");
  });

  it("resolves linked quiz topic subject and name from the current canonical workspace", () => {
    expect(source).toContain("const linkedTopic = normalizedQuiz.topicId ? [");
    expect(source).toContain(
      "This quiz topic is no longer available. Your reviewed draft is still here."
    );
    expect(source).toContain(
      "subject: linkedTopic.subject, topic: linkedTopic.name"
    );
  });
});
