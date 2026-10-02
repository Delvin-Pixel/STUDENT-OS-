import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(new URL("./Quizzes.tsx", import.meta.url)),
  "utf8"
).replace(/\s+/g, " ");

describe("practice quiz answer selection accessibility", () => {
  it("marks the currently selected keyboard-operable answer for assistive technology", () => {
    expect(source).toContain('role="group" aria-label="Answer options"');
    expect(source).toContain(
      'type="button" key={option} aria-pressed={answers[question.id] === optionIndex}'
    );
  });
});
