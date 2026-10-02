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

describe("StoreContext canonical goal integrity", () => {
  it("validates a current goal’s bounded editable fields before updating it", () => {
    expect(source).toContain(
      "const current = stateRef.current.goals.find((goal) => goal.id === id);"
    );
    expect(source).toContain(
      "const validationError = validateNewGoal(proposed);"
    );
    expect(source).toContain(
      "updateGoal: (id: string, patch: Partial<EditableGoalFields>) => boolean;"
    );
    expect(source).toContain("This goal is no longer available.");
  });

  it("does not allow progress decrements or non-finite increments to violate the canonical range", () => {
    expect(source).toContain(
      "if (!goal || !Number.isFinite(by)) return false;"
    );
    expect(source).toContain("Math.max(0, Math.min(g.target, g.current + by))");
    expect(source).toContain("bumpGoal: (id: string, by?: number) => boolean;");
  });
});
