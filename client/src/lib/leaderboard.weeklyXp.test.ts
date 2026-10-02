import { describe, expect, it } from "vitest";
import { buildBoard, learnerWeeklyXp } from "./leaderboard";
import { emptyState } from "./storage";

describe("leaderboard weekly XP", () => {
  it("counts only dated canonical rewards in the selected local week", () => {
    const state = emptyState();
    state.xp = 9_999;
    state.sessions = [
      {
        id: "session-current",
        subject: "Maths",
        topic: "Algebra",
        date: "2026-08-24",
        startTime: "16:00",
        duration: 30,
        difficulty: "medium",
        priority: "medium",
        notes: "",
        status: "completed",
        finishedAt: "2026-08-24T18:00:00.000Z",
      },
      {
        id: "session-old",
        subject: "Maths",
        topic: "Geometry",
        date: "2026-08-10",
        startTime: "16:00",
        duration: 30,
        difficulty: "medium",
        priority: "medium",
        notes: "",
        status: "completed",
      },
    ];
    state.focusSessions = [
      { id: "focus", subject: "Maths", duration: 25, date: "2026-08-24" },
    ];
    state.tasks = [
      {
        id: "task",
        title: "Submit",
        description: "",
        subject: "Maths",
        dueDate: "",
        priority: "medium",
        status: "completed",
        createdAt: "2026-08-20",
        xpAwardedAt: "2026-08-24T10:00:00.000Z",
      },
    ];
    state.goals = [
      {
        id: "goal",
        name: "Revise",
        target: 1,
        current: 1,
        deadline: "",
        category: "study",
        completed: true,
        xpAwarded: true,
        xpAwardedAt: "2026-08-24T10:00:00.000Z",
        unit: "session",
      },
      {
        id: "legacy",
        name: "Legacy",
        target: 1,
        current: 1,
        deadline: "",
        category: "study",
        completed: true,
        xpAwarded: true,
        unit: "session",
      },
    ];
    state.quizAttempts = [
      {
        id: "quiz",
        quizId: "quiz-source",
        subject: "Maths",
        score: 80,
        correctCount: 4,
        questionCount: 5,
        completedAt: "2026-08-24T10:00:00.000Z",
      },
    ];
    state.dailyLessonCompletions = ["2026-08-24:maths:algebra"];
    state.habits = [
      { id: "habit", name: "Recall", emoji: "📚", createdAt: "2026-08-24" },
    ];
    state.habitLog = { "2026-08-24": ["habit"] };

    const dates = ["2026-08-18", "2026-08-24"];
    expect(learnerWeeklyXp(state, dates)).toBe(20 + 3 + 10 + 50 + 16 + 15 + 5);
    expect(buildBoard(state, dates).find(row => row.isYou)?.xp).toBe(119);
  });
});
