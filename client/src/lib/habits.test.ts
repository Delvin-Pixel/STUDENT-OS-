import { describe, expect, it } from "vitest";
import { toggleHabitCompletion } from "./habits";
import { emptyState } from "./storage";
import { XP_RULES } from "./utils";

describe("atomic habit completion", () => {
  it("uses each preceding state so two rapid toggles leave no habit completion and no net XP", () => {
    const state = emptyState();
    state.habits = [
      { id: "habit", name: "Recall", emoji: "📚", createdAt: "2026-08-24" },
    ];
    const completed = toggleHabitCompletion(state, "habit", "2026-08-24");
    const undone = toggleHabitCompletion(completed, "habit", "2026-08-24");
    expect(completed.xp).toBe(XP_RULES.habit);
    expect(undone.xp).toBe(0);
    expect(undone.habitLog["2026-08-24"]).not.toContain("habit");
  });
});
