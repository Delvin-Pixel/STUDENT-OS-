import { describe, expect, it } from "vitest";
import {
  getNextBestActionForScheduleGap,
  getNextBestActionForTime,
  getNextBestExecution,
  getTodayScheduleGaps,
} from "./learningIntelligence";
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
  lastActiveDay: "2026-09-01",
  streakDays: 1,
  streakStart: "2026-09-01",
  longestStreak: 1,
  dailyGoal: { targetMinutes: 60 },
  customReminders: [],
  aiAnswerRatings: [],
  settings: {
    theme: "system",
    currency: "GHS",
    timerPrefs: { focus: 25, breakLen: 5, preset: "25/5" },
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
});

describe("adaptive Today action selection", () => {
  it("returns no action when no usable time remains", () => {
    expect(getNextBestActionForTime(baseState(), 0, "2026-09-01")).toBeNull();
  });

  it("prefers an action that fits the available window", () => {
    const state = baseState();
    state.tasks = [
      {
        id: "long",
        title: "Long task",
        description: "",
        dueDate: "2026-09-01",
        priority: "high",
        status: "not_started",
        subject: "Physics",
        createdAt: "",
        updatedAt: "",
      },
      {
        id: "short",
        title: "Short task",
        description: "",
        dueDate: "2026-09-01",
        priority: "medium",
        status: "not_started",
        subject: "Math",
        createdAt: "",
        updatedAt: "",
        estimatedMinutes: 15,
      },
    ] as any;
    const action = getNextBestActionForTime(state, 20, "2026-09-01");
    expect(action?.duration).toBeLessThanOrEqual(20);
    expect(action?.title).toBe("Short task");
  });

  it("time-boxes the best action when every action is longer than the window", () => {
    const state = baseState();
    state.tasks = [
      {
        id: "long",
        title: "Long task",
        description: "",
        dueDate: "2026-09-01",
        priority: "high",
        status: "not_started",
        subject: "Physics",
        estimatedMinutes: 60,
        createdAt: "",
        updatedAt: "",
      },
    ] as any;
    const action = getNextBestActionForTime(state, 20, "2026-09-01");
    expect(action?.duration).toBe(20);
    expect(action?.detail).toContain("20-minute focused sprint");
  });

  it("finds free gaps around timetable events and planned study sessions", () => {
    const state = baseState();
    state.events = [
      {
        id: "class",
        title: "Physics",
        subject: "Physics",
        day: 1,
        startTime: "09:00",
        endTime: "10:30",
        type: "class",
        location: "",
        notes: "",
      },
      {
        id: "class2",
        title: "Math",
        subject: "Math",
        day: 1,
        startTime: "13:00",
        endTime: "14:00",
        type: "class",
        location: "",
        notes: "",
      },
    ];
    state.sessions = [
      {
        id: "study",
        subject: "English",
        topic: "Essay",
        date: "2026-09-01",
        startTime: "11:00",
        duration: 30,
        priority: "medium",
        status: "planned",
        notes: "",
        actualDuration: 0,
      } as any,
    ];
    expect(getTodayScheduleGaps(state, "2026-09-01", "08:00", "16:00")).toEqual(
      [
        { startTime: "08:00", endTime: "09:00", duration: 60 },
        { startTime: "10:30", endTime: "11:00", duration: 30 },
        { startTime: "11:30", endTime: "13:00", duration: 90 },
        { startTime: "14:00", endTime: "16:00", duration: 120 },
      ]
    );
  });

  it("excludes elapsed time when a current clock time is supplied", () => {
    const state = baseState();
    state.events = [
      {
        id: "class",
        title: "Physics",
        subject: "Physics",
        day: 1,
        startTime: "15:00",
        endTime: "16:00",
        type: "class",
        location: "",
        notes: "",
      },
    ];
    expect(
      getTodayScheduleGaps(state, "2026-09-01", "08:00", "18:00", "13:20")[0]
    ).toEqual({ startTime: "13:20", endTime: "15:00", duration: 100 });
  });

  it("uses the first viable gap to choose the next best action", () => {
    const state = baseState();
    state.tasks = [
      {
        id: "short",
        title: "Review algebra",
        description: "",
        dueDate: "2026-09-01",
        priority: "high",
        status: "not_started",
        subject: "Math",
        estimatedMinutes: 15,
        createdAt: "",
        updatedAt: "",
      },
    ] as any;
    state.events = [
      {
        id: "class",
        title: "Physics",
        subject: "Physics",
        day: 1,
        startTime: "09:00",
        endTime: "10:00",
        type: "class",
        location: "",
        notes: "",
      },
    ];
    const result = getNextBestActionForScheduleGap(
      state,
      "2026-09-01",
      "08:10"
    );
    expect(result?.gap.duration).toBe(50);
    expect(result?.action.title).toBe("Review algebra");
  });
});

describe("B33 adaptive execution", () => {
  it("turns the first viable free window into an exact executable block", () => {
    const state = baseState();
    state.tasks = [
      {
        id: "short",
        title: "Review algebra",
        description: "",
        dueDate: "2026-09-01",
        priority: "high",
        status: "not_started",
        subject: "Math",
        estimatedMinutes: 15,
        createdAt: "",
        updatedAt: "",
      },
    ] as any;
    state.events = [
      {
        id: "class",
        title: "Physics",
        subject: "Physics",
        day: 1,
        startTime: "09:00",
        endTime: "10:00",
        type: "class",
        location: "",
        notes: "",
      },
    ];
    const execution = getNextBestExecution(state, "2026-09-01", "08:10");
    expect(execution).toMatchObject({
      date: "2026-09-01",
      startTime: "08:10",
      endTime: "08:25",
      duration: 15,
      source: "free_window",
      mode: "start",
    });
    expect(execution?.action.title).toBe("Review algebra");
  });

  it("returns an active session as a resume action instead of creating a competing block", () => {
    const state = baseState();
    state.sessions = [
      {
        id: "active",
        subject: "Physics",
        topic: "Waves",
        date: "2026-09-01",
        startTime: "08:30",
        duration: 40,
        priority: "high",
        status: "in_progress",
        notes: "",
        actualDuration: 12,
      },
    ] as any;
    const execution = getNextBestExecution(state, "2026-09-01", "08:40");
    expect(execution).toMatchObject({
      source: "existing_session",
      mode: "resume",
      startTime: "08:30",
      endTime: "09:10",
      duration: 40,
    });
  });

  it("never invents an execution block when no action can fit", () => {
    const state = baseState();
    state.events = [
      {
        id: "all-day",
        title: "Class",
        subject: "Physics",
        day: 1,
        startTime: "08:00",
        endTime: "22:00",
        type: "class",
        location: "",
        notes: "",
      },
    ];
    expect(getNextBestExecution(state, "2026-09-01", "08:00")).toBeNull();
  });
});
