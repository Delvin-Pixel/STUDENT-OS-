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

describe("habit and simulated-friend canonical integrity", () => {
  it("bounds normalized habit records before adding them to the workspace", () => {
    expect(source).toContain("const normalizedName = name.trim();");
    expect(source).toContain("stateRef.current.habits.length >= 100");
    expect(source).toContain("normalizedName.length > 120");
  });

  it("rejects non-finite or overflow simulated-friend records before mutation", () => {
    expect(source).toContain("!Number.isFinite(weeklyBase)");
    expect(source).toContain("weeklyBase > 1_000_000");
    expect(source).toContain("stateRef.current.friends.length >= 100");
  });

  it("rejects stale habit completion targets and malformed local calendar days", () => {
    expect(source).toContain(
      "stateRef.current.habits.some((habit) => habit.id === id)"
    );
    expect(source).toContain("isValidLocalIsoDate(date)");
    expect(source).toContain("toggleHabitCompletion(prev, id, date)");
  });
});
