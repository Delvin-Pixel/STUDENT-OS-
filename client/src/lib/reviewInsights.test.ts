import { describe, expect, it } from "vitest";
import { buildDailyReview, buildWeeklyReview } from "./reviewInsights";
import { emptyState } from "./storage";

describe("review insights", () => {
  it("summarizes direct daily activity without treating a future plan as completed work", () => {
    const state = emptyState();
    state.sessions = [
      {
        id: "done",
        subject: "Maths",
        topic: "Algebra",
        date: "2026-08-22",
        startTime: "10:00",
        duration: 30,
        difficulty: "medium",
        priority: "medium",
        notes: "",
        status: "completed",
      },
      {
        id: "planned",
        subject: "Maths",
        topic: "Geometry",
        date: "2026-08-22",
        startTime: "12:00",
        duration: 60,
        difficulty: "medium",
        priority: "medium",
        notes: "",
        status: "planned",
      },
    ];
    state.quizAttempts = [
      {
        id: "attempt",
        quizId: "quiz",
        subject: "Maths",
        score: 80,
        correctCount: 4,
        questionCount: 5,
        completedAt: "2026-08-22T10:00:00.000Z",
      },
    ];
    const review = buildDailyReview(state, "2026-08-22");
    expect(review.completedStudyMinutes).toBe(30);
    expect(review.quizAttempts).toHaveLength(1);
  });

  it("calculates an explicit weekly quiz average only when direct checks exist", () => {
    const state = emptyState();
    state.quizAttempts = [
      {
        id: "one",
        quizId: "quiz",
        subject: "Maths",
        score: 60,
        correctCount: 3,
        questionCount: 5,
        completedAt: "2026-08-18T10:00:00.000Z",
      },
      {
        id: "two",
        quizId: "quiz",
        subject: "Maths",
        score: 80,
        correctCount: 4,
        questionCount: 5,
        completedAt: "2026-08-19T10:00:00.000Z",
      },
    ];
    expect(
      buildWeeklyReview(state, ["2026-08-18", "2026-08-19"]).averageQuizScore
    ).toBe(70);
  });

  it("attributes timestamped task and quiz completion to the learner-local review date", () => {
    const state = emptyState();
    state.tasks = [
      {
        id: "task",
        title: "Practice",
        description: "",
        subject: "Maths",
        dueDate: "",
        priority: "medium",
        status: "completed",
        createdAt: "2026-08-22T08:00:00.000Z",
        completedAt: "2026-08-22T10:00:00.000Z",
      },
    ];
    state.quizAttempts = [
      {
        id: "attempt",
        quizId: "quiz",
        subject: "Maths",
        score: 80,
        correctCount: 4,
        questionCount: 5,
        completedAt: "2026-08-22T10:00:00.000Z",
      },
    ];

    const daily = buildDailyReview(state, "2026-08-22");
    const weekly = buildWeeklyReview(state, ["2026-08-22"]);

    expect(daily.completedTasks).toBe(1);
    expect(daily.quizAttempts).toHaveLength(1);
    expect(weekly.completedTasks).toBe(1);
    expect(weekly.attempts).toHaveLength(1);
  });
});
