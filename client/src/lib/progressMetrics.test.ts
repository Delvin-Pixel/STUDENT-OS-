import { describe, expect, it } from "vitest";
import {
  completedSessionMinutes,
  learningMetrics,
  weeklyLearningMinutes,
} from "./progressMetrics";

describe("Progress learning-time metrics", () => {
  it("uses the learner-recorded completed duration while retaining planned duration for legacy sessions", () => {
    expect(completedSessionMinutes({ duration: 60, actualDuration: 25 })).toBe(
      25
    );
    expect(completedSessionMinutes({ duration: 60 })).toBe(60);
  });

  it("separates planned, completed planner, Focus, and academic-evidence minutes", () => {
    expect(
      learningMetrics(
        [
          {
            date: "2026-08-24",
            duration: 60,
            actualDuration: 25,
            status: "completed",
          },
          { date: "2026-08-24", duration: 45, status: "planned" },
        ],
        [{ date: "2026-08-24", duration: 15 }],
        [{ recordedAt: "2026-08-24T12:00:00.000Z", minutes: 5 }],
        ["2026-08-24"]
      )
    ).toMatchObject({
      scheduledMinutes: 45,
      completedSessionMinutes: 25,
      focusMinutes: 15,
      academicEvidenceMinutes: 5,
      totalRecordedMinutes: 40,
    });
  });

  it("includes canonical Focus work and actual completed-session time in the weekly total", () => {
    expect(
      weeklyLearningMinutes(
        [
          {
            date: "2026-08-24",
            duration: 60,
            actualDuration: 25,
            status: "completed",
          },
          { date: "2026-08-24", duration: 45, status: "planned" },
          { date: "2026-08-17", duration: 30, status: "completed" },
        ],
        [
          { date: "2026-08-24", duration: 15 },
          { date: "2026-08-17", duration: 20 },
        ],
        ["2026-08-18", "2026-08-24"]
      )
    ).toBe(40);
  });
});
