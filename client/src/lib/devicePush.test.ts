import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  activeFocusReminderKey,
  assessDevicePushSupport,
  limitPlannedPushReminders,
  loadActiveFocusReminder,
  planDevicePushReminders,
  planFocusCompletionReminder,
  saveActiveFocusReminder,
} from "./devicePush";
import { emptyState } from "./storage";

describe("planDevicePushReminders", () => {
  it("explains the exact browser prerequisite preventing real device registration", () => {
    expect(
      assessDevicePushSupport({
        secureContext: false,
        notification: true,
        serviceWorker: true,
        pushManager: true,
      })
    ).toMatchObject({
      supported: false,
      reason: "insecure-context",
    });
    expect(
      assessDevicePushSupport({
        secureContext: true,
        notification: true,
        serviceWorker: true,
        pushManager: false,
      })
    ).toMatchObject({
      supported: false,
      reason: "push-manager",
    });
    expect(
      assessDevicePushSupport({
        secureContext: true,
        notification: true,
        serviceWorker: true,
        pushManager: true,
      })
    ).toMatchObject({
      supported: true,
      reason: "ready",
    });
  });

  it("creates idempotent task and exam reminders only for future events", () => {
    const state = emptyState();
    state.tasks.push({
      id: "task-1",
      title: "Finish biology summary",
      description: "",
      subject: "Science",
      dueDate: "2026-09-10",
      priority: "high",
      status: "todo",
      createdAt: "2026-08-13",
    });
    state.exams.push({
      id: "exam-1",
      subject: "Mathematics",
      name: "Algebra assessment",
      date: "2026-09-20",
      time: "09:00",
      location: "Room 4",
      notes: "",
      topics: [],
    });

    const reminders = planDevicePushReminders(
      state,
      new Date("2026-08-13T12:00:00")
    );

    expect(reminders).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dedupeKey: "task-task-1-2026-09-10",
          targetUrl: "/tasks",
        }),
        expect.objectContaining({
          dedupeKey: "exam-exam-1-7",
          targetUrl: "/exams",
        }),
        expect.objectContaining({
          dedupeKey: "exam-exam-1-3",
          targetUrl: "/exams",
        }),
        expect.objectContaining({
          dedupeKey: "exam-exam-1-1",
          targetUrl: "/exams",
        }),
      ])
    );
  });

  it("respects category opt-outs and never exposes task or exam names in phone alerts", () => {
    const state = emptyState();
    state.tasks.push({
      id: "private-task",
      title: "Private essay title",
      description: "",
      subject: "English",
      dueDate: "2026-08-20",
      priority: "high",
      status: "todo",
      createdAt: "2026-08-13",
    });
    state.exams.push({
      id: "private-exam",
      subject: "Science",
      name: "Sensitive exam name",
      date: "2026-08-21",
      time: "09:00",
      location: "",
      notes: "",
      topics: [],
    });
    state.settings.notificationPreferences.studyPlan = false;
    state.settings.notificationPreferences.dailyGoal = false;
    state.settings.notificationPreferences.streak = false;
    state.settings.notificationPreferences.savedLessons = false;

    const reminders = planDevicePushReminders(
      state,
      new Date("2026-08-13T12:00:00")
    );
    expect(
      reminders.find(reminder => reminder.dedupeKey.startsWith("task-"))?.body
    ).not.toContain("Private essay title");
    expect(
      reminders.find(reminder => reminder.dedupeKey.startsWith("exam-"))?.body
    ).not.toContain("Sensitive exam name");

    state.settings.notificationPreferences.tasks = false;
    state.settings.notificationPreferences.exams = false;
    const muted = planDevicePushReminders(
      state,
      new Date("2026-08-13T12:00:00")
    );
    expect(muted).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ targetUrl: "/tasks" }),
        expect.objectContaining({ targetUrl: "/exams" }),
      ])
    );
  });

  it("holds quiet-hour alerts and caps planned notifications per day", () => {
    const state = emptyState();
    state.settings.notificationPreferences.dailyCap = 1;
    state.settings.notificationPreferences.quietHours = {
      enabled: true,
      start: "20:00",
      end: "07:00",
    };
    const planned = [
      {
        dedupeKey: "day",
        title: "A",
        body: "A",
        targetUrl: "/study",
        fireAt: new Date("2026-08-14T18:00:00"),
      },
      {
        dedupeKey: "cap",
        title: "B",
        body: "B",
        targetUrl: "/study",
        fireAt: new Date("2026-08-14T19:00:00"),
      },
      {
        dedupeKey: "quiet",
        title: "C",
        body: "C",
        targetUrl: "/study",
        fireAt: new Date("2026-08-14T21:00:00"),
      },
    ];

    expect(
      limitPlannedPushReminders(planned, state).map(
        reminder => reminder.dedupeKey
      )
    ).toEqual(["day"]);
  });

  it("plans daily-goal and streak milestone nudges without exposing private study details", () => {
    const state = emptyState();
    state.profile = {
      name: "Ava",
      age: 16,
      studentType: "Secondary School",
      educationLevel: "Secondary",
      goals: [],
      subjects: ["Science"],
      hoursPerDay: "1 hour",
    };
    state.dailyGoal.targetMinutes = 45;
    state.streakDays = 7;
    state.longestStreak = 10;
    state.lastActiveDay = "2026-08-13";
    state.settings.notificationPreferences.studyPlan = false;
    state.settings.notificationPreferences.savedLessons = false;
    const reminders = planDevicePushReminders(
      state,
      new Date("2026-08-13T12:00:00")
    );
    expect(reminders).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dedupeKey: "daily-goal-2026-08-13",
          targetUrl: "/",
        }),
        expect.objectContaining({
          dedupeKey: "streak-celebration-2026-08-13",
          targetUrl: "/progress",
        }),
      ])
    );
    expect(
      reminders.find(reminder => reminder.dedupeKey.startsWith("daily-goal-"))
        ?.body
    ).not.toContain("Science");
  });

  it("does not schedule today's daily-goal nudge after the target is reached", () => {
    const state = emptyState();
    state.profile = {
      name: "Ava",
      age: 16,
      studentType: "Secondary School",
      educationLevel: "Secondary",
      goals: [],
      subjects: [],
      hoursPerDay: "1 hour",
    };
    state.dailyGoal.targetMinutes = 30;
    state.focusSessions.push({
      id: "focus-1",
      subject: "Science",
      duration: 30,
      date: "2026-08-13",
    });
    state.settings.notificationPreferences.studyPlan = false;
    state.settings.notificationPreferences.streak = false;
    state.settings.notificationPreferences.savedLessons = false;
    const reminders = planDevicePushReminders(
      state,
      new Date("2026-08-13T12:00:00")
    );
    expect(
      reminders.some(reminder => reminder.dedupeKey === "daily-goal-2026-08-13")
    ).toBe(false);
  });

  it("plans enabled one-time and daily custom reminders with stable dedupe keys", () => {
    const state = emptyState();
    state.settings.notificationPreferences = {
      ...state.settings.notificationPreferences,
      tasks: false,
      exams: false,
      studyPlan: false,
      dailyGoal: false,
      streak: false,
      savedLessons: false,
      dailyCap: 6,
      quietHours: { enabled: false, start: "22:00", end: "07:00" },
    };
    state.customReminders = [
      {
        id: "once",
        title: "Project check-in",
        message: "Open your project and make one small step.",
        date: "2026-08-14",
        time: "09:30",
        repeat: "once",
        enabled: true,
        createdAt: "2026-08-13T00:00:00.000Z",
      },
      {
        id: "daily",
        title: "Quick review",
        message: "Revisit one idea from today.",
        date: "",
        time: "18:00",
        repeat: "daily",
        enabled: true,
        createdAt: "2026-08-13T00:00:00.000Z",
      },
      {
        id: "paused",
        title: "Paused",
        message: "This must not schedule.",
        date: "",
        time: "16:00",
        repeat: "daily",
        enabled: false,
        createdAt: "2026-08-13T00:00:00.000Z",
      },
    ];

    const reminders = planDevicePushReminders(
      state,
      new Date("2026-08-13T12:00:00")
    );

    expect(reminders).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dedupeKey: "custom-once-2026-08-14",
          title: "Student OS · Project check-in",
          targetUrl: "/settings",
        }),
        expect.objectContaining({
          dedupeKey: "custom-daily-2026-08-13",
          body: "Revisit one idea from today.",
        }),
      ])
    );
    expect(
      reminders.some(reminder => reminder.dedupeKey.startsWith("custom-paused"))
    ).toBe(false);
  });

  it("carries the selected vibration pattern into every scheduled reminder", () => {
    const state = emptyState();
    state.profile = {
      name: "Ava",
      age: 16,
      studentType: "Secondary School",
      educationLevel: "Secondary",
      goals: [],
      subjects: ["Science"],
      hoursPerDay: "1 hour",
    };
    state.settings.notificationPreferences.vibrationPattern = "strong";
    const reminders = planDevicePushReminders(
      state,
      new Date("2026-08-13T12:00:00")
    );
    expect(reminders.length).toBeGreaterThan(0);
    expect(
      reminders.every(
        reminder => reminder.vibration?.join(",") === "240,100,240,100,240"
      )
    ).toBe(true);
  });

  it("uses a category vibration override while retaining the default for other reminders", () => {
    const state = emptyState();
    state.tasks.push({
      id: "task-vibration",
      title: "Review",
      description: "",
      subject: "Science",
      dueDate: "2026-08-20",
      priority: "medium",
      status: "todo",
      createdAt: "2026-08-13",
    });
    state.exams.push({
      id: "exam-vibration",
      subject: "Maths",
      name: "Quiz",
      date: "2026-08-21",
      time: "09:00",
      location: "",
      notes: "",
      topics: [],
    });
    state.settings.notificationPreferences.vibrationPattern = "gentle";
    state.settings.notificationPreferences.categoryVibrationPatterns = {
      exams: "strong",
    };

    const reminders = planDevicePushReminders(
      state,
      new Date("2026-08-13T12:00:00")
    );
    expect(
      reminders.find(reminder => reminder.dedupeKey.startsWith("task-"))
        ?.vibration
    ).toEqual([80]);
    expect(
      reminders.find(reminder => reminder.dedupeKey.startsWith("exam-"))
        ?.vibration
    ).toEqual([240, 100, 240, 100, 240]);
  });
});

describe("planFocusCompletionReminder", () => {
  it("creates a direct future phone reminder for a running focus block", () => {
    const reminder = planFocusCompletionReminder(
      25 * 60,
      "Mathematics",
      new Date("2026-08-13T12:00:00.000Z")
    );

    expect(reminder).toMatchObject({
      dedupeKey: "focus-1786623900",
      targetUrl: "/focus",
      title: "Student OS · Focus session complete",
    });
    expect(reminder?.body).toContain("Mathematics");
    expect(reminder?.fireAt.toISOString()).toBe("2026-08-13T12:25:00.000Z");
  });
});

describe("active focus-reminder cache", () => {
  const entries = new Map<string, string>();

  beforeEach(() => {
    entries.clear();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => entries.get(key) ?? null,
        setItem: (key: string, value: string) => entries.set(key, value),
        removeItem: (key: string) => entries.delete(key),
      },
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("keeps a running learner's persisted focus reminder out of another account's server sync plan", () => {
    const reminder = planFocusCompletionReminder(
      60,
      "Physics",
      new Date("2026-08-13T12:00:00.000Z")
    );
    saveActiveFocusReminder("learner-a", reminder);
    expect(activeFocusReminderKey("learner-a")).not.toBe(
      activeFocusReminderKey("learner-b")
    );
    expect(
      loadActiveFocusReminder("learner-b", new Date("2026-08-13T12:00:01.000Z"))
    ).toBeNull();
    expect(
      loadActiveFocusReminder("learner-a", new Date("2026-08-13T12:00:01.000Z"))
        ?.dedupeKey
    ).toBe(reminder?.dedupeKey);
  });
});
