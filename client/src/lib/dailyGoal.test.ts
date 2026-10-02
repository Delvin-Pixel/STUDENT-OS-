import { describe, expect, it } from "vitest";
import { getDailyGoalProgress } from "./dailyGoal";
import { emptyState } from "./storage";

describe("getDailyGoalProgress", () => {
  it("counts completed study sessions and focus blocks for only the selected local date", () => {
    const state = emptyState();
    state.dailyGoal.targetMinutes = 60;
    state.sessions.push(
      {
        id: "done",
        subject: "Math",
        topic: "Algebra",
        date: "2026-08-13",
        startTime: "09:00",
        duration: 25,
        difficulty: "medium",
        priority: "medium",
        notes: "",
        status: "completed",
      },
      {
        id: "planned",
        subject: "Math",
        topic: "Geometry",
        date: "2026-08-13",
        startTime: "10:00",
        duration: 20,
        difficulty: "medium",
        priority: "medium",
        notes: "",
        status: "planned",
      },
      {
        id: "other-day",
        subject: "Math",
        topic: "Graphs",
        date: "2026-08-14",
        startTime: "10:00",
        duration: 35,
        difficulty: "medium",
        priority: "medium",
        notes: "",
        status: "completed",
      }
    );
    state.focusSessions.push({
      id: "focus",
      subject: "Science",
      duration: 35,
      date: "2026-08-13",
    });

    expect(getDailyGoalProgress(state, "2026-08-13")).toMatchObject({
      completedMinutes: 60,
      targetMinutes: 60,
      remainingMinutes: 0,
      percent: 100,
      complete: true,
    });
  });

  it("prefers a learner-confirmed actual duration over the original planned duration", () => {
    const state = emptyState();
    state.dailyGoal.targetMinutes = 30;
    state.sessions.push({
      id: "actual",
      subject: "Physics",
      topic: "Waves",
      date: "2026-08-24",
      startTime: "16:00",
      duration: 45,
      actualDuration: 20,
      difficulty: "medium",
      priority: "medium",
      notes: "",
      status: "completed",
    });
    state.focusSessions.push({
      id: "focus",
      subject: "Physics",
      duration: 10,
      date: "2026-08-24",
    });
    expect(getDailyGoalProgress(state, "2026-08-24")).toMatchObject({
      completedMinutes: 30,
      remainingMinutes: 0,
      complete: true,
    });
  });
});
