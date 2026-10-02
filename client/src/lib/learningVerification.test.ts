import { describe, expect, it } from "vitest";
import { getLearningPath } from "./learningIntelligence";
import {
  verifyLearningIntervention,
  verifyLearningPathIntervention,
} from "./learningVerification";
import { emptyState } from "./storage";
import type { LearningEvidence, StudyState } from "./types";

const baseState = (): StudyState => ({
  foundationChecks: [],
  profile: null,
  onboarded: true,
  tasks: [],
  sessions: [],
  topics: [
    {
      id: "motion",
      name: "Motion",
      subject: "Physics",
      source: "manual",
      createdAt: "2026-09-01",
      updatedAt: "2026-09-01",
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
  lastActiveDay: "2026-09-02",
  streakDays: 1,
  streakStart: "2026-09-02",
  longestStreak: 1,
  dailyGoal: { targetMinutes: 30 },
  customReminders: [],
  aiAnswerRatings: [],
  settings: {
    theme: "system",
    currency: "GHS",
    timerPrefs: emptyState().settings.timerPrefs,
    notifications: false,
    notificationPreferences: emptyState().settings.notificationPreferences,
  },
  habits: [],
  habitLog: {},
  friends: [],
  dailyLessonCompletions: [],
  savedLessons: [],
  syncTombstones: [],
});

const evidence = (
  id: string,
  score: number,
  recordedAt = "2026-09-02T12:00:00.000Z"
): LearningEvidence => ({
  id,
  topicId: "motion",
  subject: "Physics",
  kind: "quiz",
  score,
  sourceId: id,
  recordedAt,
});

describe("B43 closed-loop learning verification", () => {
  it("does not close a remediation loop from study work without fresh evidence", () => {
    const state = baseState();
    state.learningEvidence = [
      { ...evidence("baseline", 45, "2026-09-01T12:00:00.000Z") },
    ];
    const result = verifyLearningIntervention(state, "motion", []);
    expect(result?.verificationPass).toBe(false);
    expect(result?.outcome).toBe("no_new_evidence");
    expect(result?.escalation).toBe("varied_assessment");
  });

  it("closes an intervention only when fresh trusted evidence and readiness both pass", () => {
    const state = baseState();
    state.learningEvidence = [
      evidence("baseline", 45, "2026-09-01T12:00:00.000Z"),
    ];
    const sparse = verifyLearningIntervention(
      state,
      "motion",
      [evidence("fresh", 85)],
      "2026-09-02"
    );
    expect(sparse?.verificationPass).toBe(false);
    expect(sparse?.current.readiness).toBeLessThan(70);
    const result = verifyLearningIntervention(
      state,
      "motion",
      [
        evidence("fresh", 85),
        evidence("varied-2", 90),
        evidence("varied-3", 92),
      ],
      "2026-09-02"
    );
    expect(result?.verificationPass).toBe(true);
    expect(result?.outcome).toBe("improved");
    expect(result?.nextAction).not.toBe("learn");
  });

  it("flags regression instead of falsely closing the loop", () => {
    const state = baseState();
    state.learningEvidence = [
      evidence("baseline", 85, "2026-09-01T12:00:00.000Z"),
    ];
    const result = verifyLearningIntervention(state, "motion", [
      evidence("fresh", 35),
    ]);
    expect(result?.outcome).toBe("regressed");
    expect(result?.verificationPass).toBe(false);
    expect(result?.escalation).toBe("more_practice");
  });

  it("can evaluate a learning path without mutating workspace state", () => {
    const state = baseState();
    state.learningEvidence = [
      evidence("baseline", 40, "2026-09-01T12:00:00.000Z"),
    ];
    const path = getLearningPath(state, "motion", "2026-09-02");
    expect(path).toBeTruthy();
    const before = JSON.stringify(state.learningEvidence);
    const result = verifyLearningPathIntervention(state, path!, [
      evidence("fresh", 80),
    ]);
    expect(result).toBeTruthy();
    expect(JSON.stringify(state.learningEvidence)).toBe(before);
  });
});
