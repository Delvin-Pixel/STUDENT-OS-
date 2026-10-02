import { describe, expect, it } from "vitest";
import { getTransitionAcademicPreparation } from "./transitionAcademicPreparation";
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
    academicJourney: undefined,
    transitionDecisionHub: undefined,
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

describe("transition academic preparation bridge", () => {
  it("converts a linked foundation weakness into a transition preparation task", () => {
    const current = state();
    const ranked = rankTransitionOptions(hub.options, hub.results);
    const items = getTransitionAcademicPreparation("SHS", hub, ranked, current);
    expect(items[0].kind).toBe("foundation_remediation");
    expect(items[0].subject).toBe("Mathematics");
    expect(items[0].topicId).toBe("algebra");
    expect(items[0].sourceRef).toBe(
      "transition-prep:foundation:foundation-math"
    );
    expect(items[0].description).toContain(
      "does not erase or change a recorded result"
    );
  });

  it("deduplicates one foundation issue shared by multiple options", () => {
    const current = state();
    const expanded = {
      ...hub,
      options: [
        hub.options[0],
        { ...hub.options[0], id: "it-2", name: "Software Engineering" },
      ],
    };
    const ranked = rankTransitionOptions(expanded.options, expanded.results);
    const items = getTransitionAcademicPreparation(
      "SHS",
      expanded,
      ranked,
      current
    );
    expect(
      items.filter(item => item.foundationCheckId === "foundation-math")
    ).toHaveLength(1);
  });

  it("surfaces an existing weak foundation even before an option has a usable result", () => {
    const current = state();
    const emptyHub = { ...hub, results: [], options: [] };
    const items = getTransitionAcademicPreparation(
      "SHS",
      emptyHub,
      [],
      current
    );
    expect(items[0].foundationCheckId).toBe("foundation-math");
  });
});
