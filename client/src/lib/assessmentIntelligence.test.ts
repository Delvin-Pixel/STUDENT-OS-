import { describe, expect, it } from "vitest";
import { getAssessmentIntelligence } from "./assessmentIntelligence";
import { emptyState } from "./storage";
import type { StudyState } from "./types";

const baseState = (): StudyState => ({
  foundationChecks: [],
  profile: null,
  onboarded: true,
  tasks: [],
  sessions: [],
  topics: [
    {
      id: "waves",
      subject: "Physics",
      name: "Waves",
      source: "manual",
      createdAt: "2026-08-01",
      updatedAt: "2026-08-01",
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

describe("B40 assessment intelligence", () => {
  it("detects a concentrated concept signal across distinct missed questions", () => {
    const state = baseState();
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
    const result = getAssessmentIntelligence(state, "waves");
    expect(result.primarySignal?.label).toBe("Frequency");
    expect(result.primarySignal?.repeatedMiss).toBe(true);
    expect(result.primarySignal?.severity).toBe("high");
    expect(result.remediation).toContain("Frequency");
  });

  it("does not pretend one isolated wrong answer proves a misconception", () => {
    const state = baseState();
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
            subtopic: "Amplitude",
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
        questionCount: 1,
        completedAt: "2026-09-01",
        responses: [
          {
            questionId: "a",
            prompt: "A",
            selectedOptionIndex: 1,
            correctOptionIndex: 0,
            correct: false,
            explanation: "",
            subtopic: "Amplitude",
          },
        ],
      },
    ];
    const result = getAssessmentIntelligence(state, "waves");
    expect(result.primarySignal?.repeatedMiss).toBe(false);
    expect(result.primarySignal?.reason).toContain("more varied checks");
  });
});
