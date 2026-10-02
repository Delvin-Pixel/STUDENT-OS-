import { describe, expect, it } from "vitest";
import { buildFocusedAssessmentRequest } from "./assessmentGeneration";
import { emptyState } from "./storage";
import type { StudyState } from "./types";

const state = (): StudyState => ({
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
      createdAt: "2026-09-01",
      updatedAt: "2026-09-01",
    },
  ],
  learningEvidence: [],
  studyPlans: [],
  quizzes: [
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
          prompt: "What is frequency?",
          type: "multiple_choice",
          options: ["A", "B"],
          correctOptionIndex: 0,
          explanation: "",
          subtopic: "Frequency",
        },
      ],
    },
  ],
  quizAttempts: [
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
          prompt: "What is frequency?",
          selectedOptionIndex: 1,
          correctOptionIndex: 0,
          correct: false,
          explanation: "",
          subtopic: "Frequency",
        },
      ],
    },
  ],
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

describe("B44 focused assessment generation", () => {
  it("builds bounded fresh-assessment guidance from prior misses", () => {
    const result = buildFocusedAssessmentRequest(
      state(),
      "waves",
      "remediation_verification"
    );
    expect(result.mode).toBe("remediation_verification");
    expect(result.focusConcepts).toContain("Frequency");
    expect(result.excludeQuestionPrompts).toContain("What is frequency?");
    expect(result.excludeQuestionPrompts.length).toBeLessThanOrEqual(20);
    expect(result.rationale).toContain("Verify");
  });
});
