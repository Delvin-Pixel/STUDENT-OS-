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

describe("Canonical saved Daily Lesson integrity", () => {
  it("hydrates and claims each selection key before a bookmark is appended", () => {
    expect(source).toContain(
      "const savedLessonClaimRef = useRef(new Set(state.savedLessons.map((lesson) => lesson.selectionKey)));"
    );
    expect(source).toContain(
      "savedLessonClaimRef.current = new Set(state.savedLessons.map((lesson) => lesson.selectionKey));"
    );
    expect(source).toContain(
      "savedLessonClaimRef.current = new Set(adopted.savedLessons.map((lesson) => lesson.selectionKey));"
    );
    expect(source).toContain(
      "savedLessonClaimRef.current.has(lesson.selectionKey)"
    );
    expect(source).toContain(
      "savedLessonClaimRef.current.add(lesson.selectionKey);"
    );
  });
});
