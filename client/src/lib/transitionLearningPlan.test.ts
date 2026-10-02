import { describe, expect, it } from "vitest";
import { getTransitionAcademicPreparation } from "./transitionAcademicPreparation";
import { getTransitionLearningPlan } from "./transitionLearningPlan";
import { rankTransitionOptions } from "./transitionRecommendations";
import type { StudyState, TransitionDecisionHub } from "./types";

function state(): StudyState {
  return {
    profile: {
      name: "A",
      studentType: "Secondary School",
      educationLevel: "Secondary",
      classLevel: "SHS 3",
      subjects: ["Mathematics"],
      goals: [],
      hoursPerDay: "1 hour",
    },
    foundationChecks: [
      {
        id: "foundation-math",
        subject: "Mathematics",
        sourceStage: "SHS",
        sourceClassLevel: "SHS 2",
        currentStage: "SHS",
        currentClassLevel: "SHS 3",
        status: "completed",
        createdAt: "2026-01-01T00:00:00Z",
        nextDueAt: "2026-09-01T00:00:00Z",
        attemptCount: 1,
        rationale: "Periodic check",
        focusTopicIds: ["algebra"],
        focusConcepts: ["Algebraic manipulation"],
        attentionStatus: "needs_remediation",
        weakConcepts: ["Algebraic manipulation"],
        remediationTopicIds: ["algebra"],
      },
    ],
    onboarded: true,
    tasks: [],
    sessions: [],
    topics: [
      {
        id: "algebra",
        subject: "Mathematics",
        name: "Algebraic manipulation",
        source: "manual",
        createdAt: "2026-01-01",
        updatedAt: "2026-01-01",
        academicClassLevel: "SHS 2",
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

const hub: TransitionDecisionHub = {
  sourceStage: "SHS",
  targetStage: "Tertiary",
  status: "decision_ready",
  results: [{ id: "m", subject: "Mathematics", grade: "B2", category: "core" }],
  options: [
    {
      id: "it",
      name: "Information Technology",
      type: "programme",
      confidence: "official",
      sourceUrl: "https://example.edu/requirements",
      sourceVerifiedAt: "2026-09-01T00:00:00Z",
      requiredSubjects: [{ subject: "Mathematics", minimumGrade: "C6" }],
    },
  ],
  preparationTasks: [],
  lastUpdatedAt: "2026-09-03T00:00:00Z",
};

describe("transition-aware learning plan", () => {
  it("reuses the ordinary learning-path engine", () => {
    const current = state();
    const ranked = rankTransitionOptions(hub.options, hub.results);
    const prep = getTransitionAcademicPreparation("SHS", hub, ranked, current);
    const plan = getTransitionLearningPlan(
      "SHS",
      prep,
      current,
      8,
      "2026-09-04"
    );
    expect(plan.status).toBe("ready");
    expect(plan.steps[0].topicId).toBe("algebra");
    expect(plan.steps[0].sourceRef).toContain("transition-learning:");
  });

  it("does not invent a step when a preparation item has no topic link", () => {
    const current = state();
    const ranked = rankTransitionOptions(hub.options, hub.results);
    const prep = getTransitionAcademicPreparation(
      "SHS",
      hub,
      ranked,
      current
    ).map(item => ({ ...item, topicId: undefined }));
    const plan = getTransitionLearningPlan("SHS", prep, current);
    expect(plan.status).toBe("needs_learning_signal");
    expect(plan.steps).toHaveLength(0);
  });
});
