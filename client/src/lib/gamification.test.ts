import { describe, expect, it } from "vitest";
import { awardXpState, recordDailyLessonCompletion } from "./gamification";
import { emptyState } from "./storage";

describe("gamification bookkeeping", () => {
  it("applies exactly the requested XP reward without mutating the prior state", () => {
    const before = emptyState();
    const after = awardXpState(before, 20);

    expect(before.xp).toBe(0);
    expect(after.xp).toBe(20);
  });

  it("records a Daily Lesson and rewards it exactly once", () => {
    const first = recordDailyLessonCompletion(
      emptyState(),
      "2026-08-12:math",
      15
    );
    const repeated = recordDailyLessonCompletion(
      first.state,
      "2026-08-12:math",
      15
    );

    expect(first.recorded).toBe(true);
    expect(first.state.dailyLessonCompletions).toEqual(["2026-08-12:math"]);
    expect(first.state.xp).toBe(15);
    expect(repeated.recorded).toBe(false);
    expect(repeated.state.xp).toBe(15);
  });

  it("never reduces an XP balance below zero when a reward is reversed", () => {
    expect(awardXpState(emptyState(), -5).xp).toBe(0);
  });
});
