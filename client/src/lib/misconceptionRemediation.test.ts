import { describe, expect, it } from "vitest";
import { getAssessmentRemediationPlan } from "./misconceptionRemediation";
import { emptyState } from "./storage";
import type { StudyState } from "./types";

const baseState = (): StudyState => ({
  foundationChecks: [],
  profile: null,
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
  lastActiveDay: "2026-09-02",
  streakDays: 0,
  streakStart: "2026-09-02",
  longestStreak: 0,
  dailyGoal: { targetMinutes: 30 },
  customReminders: [],
  aiAnswerRatings: [],
  settings: {
    theme: "system",
    currency: "GHS",
    timerPrefs: emptyState().settings.timerPrefs,
    notifications: true,
    notificationPreferences: emptyState().settings.notificationPreferences,
  },
  habits: [],
  habitLog: {},
  friends: [],
  dailyLessonCompletions: [],
  savedLessons: [],
  syncTombstones: [],
});

describe("B41 misconception and remediation graph", () => {
  it("routes a strong concept signal into targeted remediation without claiming a proven misconception", () => {
    const state = baseState();
    state.topics = [
      {
        id: "waves",
        subject: "Physics",
        name: "Waves",
        source: "manual",
        createdAt: "2026-08-01",
        updatedAt: "2026-08-01",
      },
    ];
    state.quizzes = [
      {
        id: "q1",
        title: "Waves",
        subject: "Physics",
        topic: "Waves",
        topicId: "waves",
        source: "manual",
        createdAt: "2026-09-01",
        questions: [
          {
            id: "a",
            prompt: "A",
            type: "multiple_choice",
            options: ["x", "y"],
            correctOptionIndex: 0,
            explanation: "",
            subtopic: "Frequency",
          },
          {
            id: "b",
            prompt: "B",
            type: "multiple_choice",
            options: ["x", "y"],
            correctOptionIndex: 0,
            explanation: "",
            subtopic: "Frequency",
          },
        ],
      },
    ];
    state.quizAttempts = [
      {
        id: "a1",
        quizId: "q1",
        subject: "Physics",
        topicId: "waves",
        score: 0,
        correctCount: 0,
        questionCount: 2,
        completedAt: "2026-09-01",
        responses: [
          {
            questionId: "a",
            prompt: "A",
            selectedOptionIndex: 1,
            correctOptionIndex: 0,
            correct: false,
            explanation: "",
            subtopic: "Frequency",
          },
          {
            questionId: "b",
            prompt: "B",
            selectedOptionIndex: 1,
            correctOptionIndex: 0,
            correct: false,
            explanation: "",
            subtopic: "Frequency",
          },
        ],
      },
    ];
    const plan = getAssessmentRemediationPlan(state, "waves", "2026-09-02");
    expect(plan?.status).toBe("targeted");
    expect(plan?.reason).toBe("concept_signal");
    expect(plan?.summary).toContain("Frequency");
  });

  it("puts a canonical prerequisite before the target when one is weak", () => {
    const state = baseState();
    state.topics = [
      {
        id: "motion",
        subject: "Physics",
        name: "Motion",
        source: "manual",
        createdAt: "2026-08-01",
        updatedAt: "2026-08-01",
        prerequisiteTopicIds: ["algebra"],
      },
      {
        id: "algebra",
        subject: "Physics",
        name: "Algebra",
        source: "manual",
        createdAt: "2026-08-01",
        updatedAt: "2026-08-01",
      },
    ];
    state.learningEvidence = [
      {
        id: "e1",
        topicId: "motion",
        subject: "Physics",
        kind: "quiz",
        score: 30,
        recordedAt: "2026-09-01",
      },
    ];
    const plan = getAssessmentRemediationPlan(state, "motion", "2026-09-02");
    expect(plan?.status).toBe("prerequisite_first");
    expect(plan?.knowledgeGap?.topicId).toBe("algebra");
  });

  it("uses a short diagnostic when response evidence is absent", () => {
    const state = baseState();
    state.topics = [
      {
        id: "waves",
        subject: "Physics",
        name: "Waves",
        source: "manual",
        createdAt: "2026-08-01",
        updatedAt: "2026-08-01",
      },
    ];
    const plan = getAssessmentRemediationPlan(state, "waves", "2026-09-02");
    expect(plan?.status).toBe("needs_diagnosis");
    expect(plan?.nodes[0]?.route).toBe("/quizzes");
  });
});
