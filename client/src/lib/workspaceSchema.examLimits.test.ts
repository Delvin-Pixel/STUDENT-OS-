import {
  WORKSPACE_EXAM_LIMIT,
  WORKSPACE_EXAM_TOPIC_LIMIT,
  WORKSPACE_FOCUS_SESSION_LIMIT,
  validateStudyState,
} from "@shared/workspaceSchema";
import { describe, expect, it } from "vitest";

const baseState = {
  profile: null,
  onboarded: false,
  tasks: [],
  sessions: [],
  topics: [],
  learningEvidence: [],
  studyPlans: [],
  quizzes: [],
  quizAttempts: [],
  studyMaterials: [],
  decks: [],
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
  dailyGoal: { targetMinutes: 10 },
  customReminders: [],
  aiAnswerRatings: [],
  settings: {
    theme: "system",
    currency: "GHS",
    timerPrefs: { focus: 25, breakLen: 5, preset: "Balanced" },
    notifications: false,
    notificationPreferences: {
      tasks: true,
      exams: true,
      focus: true,
      studyPlan: true,
      dailyGoal: true,
      streak: true,
      savedLessons: true,
      vibrationPattern: "off",
      categoryVibrationPatterns: {},
      quietHours: { enabled: false, start: "", end: "" },
      dailyCap: 1,
      studyPlanTime: "",
      dailyGoalTime: "",
    },
  },
  habits: [],
  habitLog: {},
  friends: [],
  dailyLessonCompletions: [],
  savedLessons: [],
  syncTombstones: [],
};

const exam = (id: string, topics: ReturnType<typeof topic>[] = []) => ({
  id,
  subject: "Maths",
  name: "Final",
  date: "2026-09-01",
  time: "",
  location: "",
  notes: "",
  topics,
});
const topic = (id: string) => ({
  id,
  name: "Algebra",
  status: "not_started" as const,
});
const focusSession = (id: string) => ({
  id,
  subject: "Physics",
  duration: 25,
  date: "2026-09-01",
});

describe("workspaceSchema exam capacity limits", () => {
  it("accepts exactly the published limits", () => {
    expect(
      validateStudyState({
        ...baseState,
        exams: Array.from({ length: WORKSPACE_EXAM_LIMIT }, (_, index) =>
          exam(`exam-${index}`)
        ),
      }).success
    ).toBe(true);
    expect(
      validateStudyState({
        ...baseState,
        exams: [
          exam(
            "exam-1",
            Array.from({ length: WORKSPACE_EXAM_TOPIC_LIMIT }, (_, index) =>
              topic(`topic-${index}`)
            )
          ),
        ],
      }).success
    ).toBe(true);
  });

  it("rejects an additional exam or nested topic", () => {
    expect(
      validateStudyState({
        ...baseState,
        exams: Array.from({ length: WORKSPACE_EXAM_LIMIT + 1 }, (_, index) =>
          exam(`exam-${index}`)
        ),
      }).success
    ).toBe(false);
    expect(
      validateStudyState({
        ...baseState,
        exams: [
          exam(
            "exam-1",
            Array.from({ length: WORKSPACE_EXAM_TOPIC_LIMIT + 1 }, (_, index) =>
              topic(`topic-${index}`)
            )
          ),
        ],
      }).success
    ).toBe(false);
  });

  it("accepts the Focus-session limit and rejects one additional canonical record", () => {
    expect(
      validateStudyState({
        ...baseState,
        exams: [],
        focusSessions: Array.from(
          { length: WORKSPACE_FOCUS_SESSION_LIMIT },
          (_, index) => focusSession(`focus-${index}`)
        ),
      }).success
    ).toBe(true);
    expect(
      validateStudyState({
        ...baseState,
        exams: [],
        focusSessions: Array.from(
          { length: WORKSPACE_FOCUS_SESSION_LIMIT + 1 },
          (_, index) => focusSession(`focus-${index}`)
        ),
      }).success
    ).toBe(false);
  });
});
