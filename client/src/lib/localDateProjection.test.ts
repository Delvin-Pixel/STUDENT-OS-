import { describe, expect, it } from "vitest";
import { isoDate } from "./utils";

describe("local calendar date projections", () => {
  it("formats a local Date from its local calendar fields rather than UTC serialization", () => {
    const evening = new Date(2026, 0, 2, 23, 30);
    expect(isoDate(evening)).toBe("2026-01-02");
  });

  it("keeps learner-facing calendar projections on the shared local formatter", async () => {
    const [habits, focus, progress, savedLessons, planner] = await Promise.all([
      import("../components/HabitsTracker?raw"),
      import("../pages/Focus?raw"),
      import("../pages/Progress?raw"),
      import("../components/SavedLessons?raw"),
      import("./planner?raw"),
    ]);
    expect(habits.default).toContain("return isoDate(d);");
    expect(focus.default).toContain("return isoDate(d);");
    expect(progress.default).toContain(
      "const completedDay = isoDate(new Date(t.completedAt!));"
    );
    expect(progress.default).toContain("const cutoffStr = isoDate(cutoff);");
    expect(savedLessons.default).toContain(
      "formatDateHuman(isoDate(new Date(lesson.savedAt)))"
    );
    expect(planner.default).toContain("const iso = isoDate(d);");
  });
});
