import { describe, expect, it } from "vitest";
import { getTransitionAdaptiveExecutionPlan } from "./transitionAdaptiveExecution";
import type { TransitionLearningPlan } from "./transitionLearningPlan";
import type { StudyState } from "./types";

function state(): StudyState {
  return {
    foundationChecks: [],
    profile: {
      name: "A",
      studentType: "Secondary School",
      educationLevel: "Secondary",
      classLevel: "SHS 3",
      subjects: ["Mathematics"],
      goals: [],
      hoursPerDay: "1 hour",
    },
    onboarded: true,
    tasks: [],
    sessions: [],
    topics: [
      {
        id: "algebra",
        subject: "Mathematics",
        name: "Algebra",
        source: "manual",
        createdAt: "2026-01-01",
        updatedAt: "2026-01-01",
      },
    ],
    learningEvidence: [],
    studyPlans: [],
    quizzes: [],
    quizAttempts: [],
    studyMaterials: [],
    decks: [],
    exams: [],
    events: [],
    transactions: [],
    goals: [],
    focusSessions: [],
    notes: [],
    achievements: [],
    notifications: [],
    xp: 0,
    lastActiveDay: "",
    streakDays: 0,
    streakStart: "",
    longestStreak: 0,
    dailyGoal: { targetMinutes: 30 },
    customReminders: [],
    aiAnswerRatings: [],
    settings: {
      theme: "system",
      currency: "GHS",
      timerPrefs: { focus: 25, breakLen: 5, preset: "25/5" },
      notifications: false,
      notificationPreferences: {} as any,
    },
    habits: [],
    habitLog: {},
    friends: [],
    dailyLessonCompletions: [],
    savedLessons: [],
    syncTombstones: [],
  } as StudyState;
}

const plan: TransitionLearningPlan = {
  status: "ready",
  summary: "ready",
  steps: [
    {
      id: "learn-algebra",
      title: "Learn Algebra",
      description: "Build the foundation.",
      subject: "Mathematics",
      topicId: "algebra",
      topic: "Algebra",
      action: "learn",
      route: "/study",
      duration: 25,
      priority: "high",
      sourceRef: "transition-learning:foundation:algebra:target-algebra",
    },
    {
      id: "practice-algebra",
      title: "Practice Algebra",
      description: "Targeted practice.",
      subject: "Mathematics",
      topicId: "algebra",
      topic: "Algebra",
      action: "practice",
      route: "/quizzes",
      duration: 20,
      priority: "high",
      sourceRef:
        "transition-learning:foundation:algebra:target-algebra-practice",
    },
  ],
};

describe("transition adaptive execution", () => {
  it("fits ordered work into daily capacity without mutating state", () => {
    const current = state();
    const result = getTransitionAdaptiveExecutionPlan(
      current,
      plan,
      30,
      "2026-09-04"
    );
    expect(result.status).toBe("ready");
    expect(result.steps).toHaveLength(2);
    expect(result.steps[0].date).toBe("2026-09-04");
    expect(result.steps[1].date).toBe("2026-09-05");
    expect(result.steps[1].dependsOnStepId).toBe(result.steps[0].id);
    expect(current.tasks).toHaveLength(0);
  });

  it("does not schedule when there is no capacity", () => {
    const result = getTransitionAdaptiveExecutionPlan(
      state(),
      plan,
      0,
      "2026-09-04"
    );
    expect(result.status).toBe("no_capacity");
    expect(result.steps).toHaveLength(0);
  });

  it("does not exceed a sub-minimum daily capacity", () => {
    const result = getTransitionAdaptiveExecutionPlan(
      state(),
      plan,
      5,
      "2026-09-04"
    );
    expect(result.status).toBe("no_capacity");
    expect(result.steps).toHaveLength(0);
    expect(result.notes[0]).toContain("Less than 10 minutes");
  });

  it("puts separately fitted oversized steps on separate days", () => {
    const oversized: TransitionLearningPlan = {
      ...plan,
      steps: plan.steps.map(step => ({ ...step, duration: 45 })),
    };
    const result = getTransitionAdaptiveExecutionPlan(
      state(),
      oversized,
      20,
      "2026-09-04"
    );
    expect(result.steps).toHaveLength(2);
    expect(result.steps.map(step => step.duration)).toEqual([20, 20]);
    expect(result.steps.map(step => step.date)).toEqual([
      "2026-09-04",
      "2026-09-05",
    ]);
  });
});
