import { describe, expect, it } from "vitest";
import type { TransitionAcademicPreparation } from "./transitionAcademicPreparation";
import type { TransitionAdaptiveExecutionPlan } from "./transitionAdaptiveExecution";
import { getTransitionClosedLoop } from "./transitionClosedLoop";
import type { TransitionLearningPlan } from "./transitionLearningPlan";
import type { StudyState } from "./types";

function baseState(): StudyState {
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

const preparation: TransitionAcademicPreparation[] = [
  {
    id: "foundation:math",
    title: "Repair Mathematics foundation",
    description: "Repair Algebra.",
    kind: "foundation_remediation",
    priority: "high",
    subject: "Mathematics",
    topicId: "algebra",
    concept: "Algebra",
    foundationCheckId: "f1",
    sourceRef: "transition-prep:foundation:f1",
  },
];

const plan: TransitionLearningPlan = {
  status: "ready",
  summary: "ready",
  steps: [
    {
      id: "learn",
      title: "Learn Algebra",
      description: "Learn.",
      subject: "Mathematics",
      topicId: "algebra",
      topic: "Algebra",
      action: "learn",
      route: "/study",
      duration: 20,
      priority: "high",
      sourceRef: "transition-learning:f1:learn",
    },
  ],
};
const execution: TransitionAdaptiveExecutionPlan = {
  status: "ready",
  startDate: "2026-09-04",
  endDate: "2026-09-04",
  dailyCapacityMinutes: 30,
  totalMinutes: 20,
  steps: [
    {
      id: "exec",
      sourceRef: "transition-learning:f1:learn",
      title: "Learn Algebra",
      description: "Learn.",
      subject: "Mathematics",
      topicId: "algebra",
      topic: "Algebra",
      action: "learn",
      route: "/study",
      duration: 20,
      originalDuration: 20,
      priority: "high",
      date: "2026-09-04",
      mode: "standard",
      reason: "Learn.",
    },
  ],
  notes: [],
};

describe("transition closed loop", () => {
  it("does not close merely because execution was completed", () => {
    const state = {
      ...baseState(),
      foundationChecks: [
        {
          id: "f1",
          subject: "Mathematics",
          sourceStage: "SHS" as const,
          sourceClassLevel: "SHS 2",
          currentStage: "SHS" as const,
          currentClassLevel: "SHS 3",
          status: "completed" as const,
          createdAt: "2026-09-01",
          nextDueAt: "2026-09-05",
          attemptCount: 1,
          rationale: "test",
          attentionStatus: "needs_remediation" as const,
          weakConcepts: ["Algebra"],
          remediationTopicIds: ["algebra"],
          lastScore: 55,
        },
      ],
    } as StudyState;
    const result = getTransitionClosedLoop(state, preparation, plan, execution);
    expect(result.status).toBe("needs_preparation");
    expect(result.decision.action).toBe("continue_learning");
  });

  it("moves to recheck after remediation has made the foundation usable", () => {
    const state = {
      ...baseState(),
      foundationChecks: [
        {
          id: "f1",
          subject: "Mathematics",
          sourceStage: "SHS" as const,
          sourceClassLevel: "SHS 2",
          currentStage: "SHS" as const,
          currentClassLevel: "SHS 3",
          status: "completed" as const,
          createdAt: "2026-09-01",
          nextDueAt: "2026-09-10",
          attemptCount: 2,
          rationale: "test",
          attentionStatus: "ready_to_recheck" as const,
          weakConcepts: ["Algebra"],
          remediationTopicIds: ["algebra"],
          lastScore: 78,
        },
      ],
    } as StudyState;
    const result = getTransitionClosedLoop(
      state,
      [{ ...preparation[0], kind: "foundation_recheck" }],
      plan,
      execution
    );
    expect(result.status).toBe("needs_recheck");
    expect(result.decision.action).toBe("complete_recheck");
  });

  it("closes the academic-preparation loop only at the strong foundation threshold", () => {
    const state = {
      ...baseState(),
      foundationChecks: [
        {
          id: "f1",
          subject: "Mathematics",
          sourceStage: "SHS" as const,
          sourceClassLevel: "SHS 2",
          currentStage: "SHS" as const,
          currentClassLevel: "SHS 3",
          status: "completed" as const,
          createdAt: "2026-09-01",
          nextDueAt: "2026-10-01",
          attemptCount: 3,
          rationale: "test",
          attentionStatus: "none" as const,
          weakConcepts: [],
          remediationTopicIds: [],
          lastScore: 90,
        },
      ],
    } as StudyState;
    const result = getTransitionClosedLoop(state, preparation, plan, execution);
    expect(result.status).toBe("complete");
    expect(result.decision.action).toBe("maintain_foundation");
    expect(result.decision.completionSignal).toBe(100);
  });
  it("does not use an unrelated strong foundation check to close the transition loop", () => {
    const state = {
      ...baseState(),
      foundationChecks: [
        {
          id: "science-1",
          subject: "Science",
          sourceStage: "SHS" as const,
          sourceClassLevel: "SHS 2",
          currentStage: "SHS" as const,
          currentClassLevel: "SHS 3",
          status: "completed" as const,
          createdAt: "2026-09-01",
          nextDueAt: "2026-10-01",
          attemptCount: 1,
          rationale: "test",
          attentionStatus: "none" as const,
          weakConcepts: [],
          remediationTopicIds: [],
          lastScore: 95,
        },
      ],
    } as StudyState;
    const result = getTransitionClosedLoop(
      state,
      [],
      { status: "needs_learning_signal", summary: "none", steps: [] },
      { ...execution, steps: [], totalMinutes: 0 },
      1,
      ["Mathematics"]
    );
    expect(result.status).toBe("needs_evidence");
    expect(result.decision.action).toBe("collect_evidence");
  });

  it("treats a due transition-linked foundation check as requiring a fresh recheck", () => {
    const state = {
      ...baseState(),
      foundationChecks: [
        {
          id: "f1",
          subject: "Mathematics",
          sourceStage: "SHS" as const,
          sourceClassLevel: "SHS 2",
          currentStage: "SHS" as const,
          currentClassLevel: "SHS 3",
          status: "due" as const,
          createdAt: "2026-09-01",
          nextDueAt: "2026-09-27",
          attemptCount: 3,
          rationale: "test",
          attentionStatus: "none" as const,
          weakConcepts: [],
          remediationTopicIds: [],
          lastScore: 90,
        },
      ],
    } as StudyState;
    const result = getTransitionClosedLoop(state, preparation, plan, execution);
    expect(result.status).toBe("needs_recheck");
    expect(result.remainingRechecks).toBe(1);
  });
});
