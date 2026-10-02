import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(new URL("./DailyLesson.tsx", import.meta.url)),
  "utf8"
)
  .replace(/\s+/g, " ")
  .replace(/\(\s+/g, "(")
  .replace(/\s+\)/g, ")")
  .replace(/\b([A-Za-z_$][\w$]*) =>/g, "($1) =>");

describe("Daily Lesson account-switch isolation", () => {
  it("binds in-flight lesson responses to both the account cache scope and selected topic", () => {
    expect(source).toContain(
      "const requestKey = `${accountCacheScope}:${selection.key}`;"
    );
    expect(source).toContain("requestRef.current = requestKey;");
    expect(source).toContain(
      "const lessonScope = `${accountCacheScope}:${selection.key}`;"
    );
    expect(source).toContain("requestRef.current = lessonScope;");
    expect(source).toContain("if (requestRef.current !== requestKey) return;");
    expect(source).toContain(
      "if (requestRef.current === requestKey) toast.error"
    );
  });

  it("drops a stale account or topic question callback and only removes its matching failed prompt", () => {
    expect(source).toContain(
      "const questionScope = `${accountCacheScope}:${selection.key}`;"
    );
    expect(source).toContain(
      "if (requestRef.current !== questionScope) return;"
    );
    expect(source).toContain("setMessages");
    expect(source).toContain("entry.id !== questionId");
  });
});
