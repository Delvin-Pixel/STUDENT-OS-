import { describe, expect, it } from "vitest";
import {
  dueFoundationChecks,
  ensureFoundationChecks,
  markFoundationAssessment,
  markFoundationRemediation,
  previousClassLevel,
  selectFoundationTargets,
} from "./foundationMonitor";
import type { Profile, StudyState } from "./types";

const profile: Profile = {
  name: "A",
  studentType: "Secondary School",
  educationLevel: "Secondary",
  classLevel: "SHS 2",
  academicYear: "2026/27",
  subjects: ["Mathematics", "Chemistry"],
  goals: [],
  hoursPerDay: "1 hour",
};

function state(): StudyState {
  return {
    profile,
    academicJourney: undefined,
    transitionDecisionHub: undefined,
    foundationChecks: [],
    onboarded: true,
    tasks: [],
    sessions: [],
    topics: [],
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
  };
}

describe("foundationMonitor", () => {
  it("finds the immediate prior level", () => {
    expect(previousClassLevel("SHS", "SHS 3")).toBe("SHS 2");
    expect(previousClassLevel("JHS", "JHS 1")).toBeUndefined();
  });
  it("creates periodic checks for prior-level subjects", () => {
    const checks = ensureFoundationChecks(
      profile,
      [],
      new Date("2026-09-01T00:00:00Z")
    );
    expect(checks).toHaveLength(2);
    expect(checks[0].sourceClassLevel).toBe("SHS 1");
    expect(checks.every(x => x.status === "due")).toBe(true);
  });
  it("reschedules checks according to evidence strength", () => {
    const checks = ensureFoundationChecks(
      profile,
      [],
      new Date("2026-09-01T00:00:00Z")
    );
    const strong = markFoundationAssessment(
      checks[0],
      92,
      new Date("2026-09-01T00:00:00Z")
    );
    expect(new Date(strong.nextDueAt).getTime()).toBe(
      new Date("2026-10-16T00:00:00Z").getTime()
    );
    const weak = markFoundationAssessment(
      checks[0],
      55,
      new Date("2026-09-01T00:00:00Z")
    );
    expect(new Date(weak.nextDueAt).getTime()).toBe(
      new Date("2026-09-08T00:00:00Z").getTime()
    );
  });
  it("surfaces due checks from workspace state", () => {
    expect(
      dueFoundationChecks(state(), new Date("2026-09-03T00:00:00Z"))
    ).toHaveLength(2);
  });
  it("targets tagged prerequisite concepts instead of randomly sampling the old syllabus", () => {
    const s = state();
    s.topics = [
      {
        id: "old-algebra",
        subject: "Mathematics",
        name: "Algebraic manipulation",
        source: "manual",
        createdAt: "2026-01-01",
        updatedAt: "2026-01-01",
        academicClassLevel: "SHS 1",
      },
      {
        id: "old-functions",
        subject: "Mathematics",
        name: "Functions",
        source: "manual",
        createdAt: "2026-01-01",
        updatedAt: "2026-01-01",
        academicClassLevel: "SHS 1",
      },
      {
        id: "current-calc",
        subject: "Mathematics",
        name: "Differentiation",
        source: "manual",
        createdAt: "2026-08-01",
        updatedAt: "2026-08-01",
        academicClassLevel: "SHS 2",
        prerequisiteTopicIds: ["old-algebra"],
      },
      {
        id: "other",
        subject: "Mathematics",
        name: "Other current topic",
        source: "manual",
        createdAt: "2026-08-01",
        updatedAt: "2026-08-01",
        academicClassLevel: "SHS 2",
      },
    ];
    const check = ensureFoundationChecks(
      s.profile!,
      [],
      new Date("2026-09-01T00:00:00Z")
    )[0];
    const targets = selectFoundationTargets(check, s, 3);
    expect(targets[0].topicId).toBe("old-algebra");
    expect(targets[0].reason).toContain("prerequisite");
  });
});

describe("foundation remediation loop", () => {
  it("localizes weak concepts from missed responses and requests remediation", () => {
    const s = state();
    s.topics = [
      {
        id: "old-algebra",
        subject: "Mathematics",
        name: "Algebraic manipulation",
        source: "manual",
        createdAt: "2026-01-01",
        updatedAt: "2026-01-01",
        academicClassLevel: "SHS 1",
      },
      {
        id: "current-calc",
        subject: "Mathematics",
        name: "Differentiation",
        source: "manual",
        createdAt: "2026-08-01",
        updatedAt: "2026-08-01",
        academicClassLevel: "SHS 2",
        prerequisiteTopicIds: ["old-algebra"],
      },
    ];
    const check = ensureFoundationChecks(
      s.profile!,
      [],
      new Date("2026-09-01T00:00:00Z")
    )[0];
    const targeted = {
      ...check,
      focusTopicIds: ["old-algebra"],
      focusConcepts: ["Algebraic manipulation"],
    };
    const result = markFoundationAssessment(
      targeted,
      55,
      new Date("2026-09-03T00:00:00Z"),
      [
        {
          questionId: "q1",
          prompt: "x",
          selectedOptionIndex: 0,
          correctOptionIndex: 1,
          correct: false,
          explanation: "",
          subtopic: "Algebraic manipulation",
        },
        {
          questionId: "q2",
          prompt: "y",
          selectedOptionIndex: 0,
          correctOptionIndex: 0,
          correct: true,
          explanation: "",
          subtopic: "Algebraic manipulation",
        },
      ]
    );
    expect(result.attentionStatus).toBe("needs_remediation");
    expect(result.weakConcepts).toContain("Algebraic manipulation");
    expect(result.remediationTopicIds).toContain("old-algebra");
  });

  it("closes a remediation gap after a strong targeted repair check", () => {
    const check = {
      ...state().foundationChecks?.[0],
      attentionStatus: "needs_remediation" as const,
      weakConcepts: ["Algebraic manipulation"],
      remediationTopicIds: ["old-algebra"],
      attemptCount: 1,
      createdAt: "2026-08-01T00:00:00Z",
      nextDueAt: "2026-08-02T00:00:00Z",
      id: "foundation-1",
      subject: "Mathematics",
      sourceStage: "SHS" as const,
      sourceClassLevel: "SHS 1",
      currentStage: "SHS" as const,
      currentClassLevel: "SHS 2",
      status: "completed" as const,
      rationale: "test",
    };
    const result = markFoundationRemediation(
      check,
      92,
      new Date("2026-09-10T00:00:00Z"),
      []
    );
    expect(result.attentionStatus).toBe("none");
    expect(result.weakConcepts).toEqual([]);
    expect(result.remediationAttemptCount).toBe(1);
  });
});
