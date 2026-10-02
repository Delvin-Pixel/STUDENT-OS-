import { describe, expect, it } from "vitest";
import { buildDailyContext } from "./dailyContext";
import { emptyState } from "./storage";

describe("daily context", () => {
  it("combines only today’s unfinished work, recurring events, completed study, and current-month spending", () => {
    const state = emptyState();
    state.tasks.push(
      {
        id: "due",
        title: "Due",
        description: "",
        subject: "Maths",
        dueDate: "2026-08-24",
        priority: "high",
        status: "todo",
        createdAt: "",
      },
      {
        id: "later",
        title: "Later",
        description: "",
        subject: "Maths",
        dueDate: "2026-08-25",
        priority: "high",
        status: "todo",
        createdAt: "",
      }
    );
    state.sessions.push({
      id: "done",
      subject: "Maths",
      topic: "Algebra",
      date: "2026-08-24",
      startTime: "10:00",
      duration: 30,
      actualDuration: 25,
      difficulty: "medium",
      priority: "medium",
      notes: "",
      status: "completed",
    });
    state.sessions.push(
      {
        id: "planned",
        subject: "Maths",
        topic: "Geometry",
        date: "2026-08-24",
        startTime: "11:00",
        duration: 30,
        difficulty: "medium",
        priority: "medium",
        notes: "",
        status: "planned",
      },
      {
        id: "skipped",
        subject: "Maths",
        topic: "Trigonometry",
        date: "2026-08-24",
        startTime: "12:00",
        duration: 30,
        difficulty: "medium",
        priority: "medium",
        notes: "",
        status: "skipped",
        skipReason: "no_time",
      },
      {
        id: "moved",
        subject: "Maths",
        topic: "Statistics",
        date: "2026-08-24",
        startTime: "13:00",
        duration: 30,
        difficulty: "medium",
        priority: "medium",
        notes: "",
        status: "rescheduled",
      }
    );
    state.events.push({
      id: "mon",
      title: "Monday study",
      subject: "Maths",
      day: 0,
      startTime: "09:00",
      endTime: "10:00",
      type: "study",
      location: "",
      notes: "",
    });
    state.transactions.push(
      {
        id: "aug",
        type: "expense",
        amount: 20,
        category: "school",
        label: "Book",
        date: "2026-08-02",
      },
      {
        id: "sep",
        type: "expense",
        amount: 50,
        category: "school",
        label: "Later",
        date: "2026-09-01",
      }
    );
    const context = buildDailyContext(state, "2026-08-24");
    expect(context.dueTasks.map(task => task.id)).toEqual(["due"]);
    expect(context.timetableEvents).toHaveLength(1);
    expect(context.completedStudyMinutes).toBe(25);
    expect(context.sessions.map(session => session.id)).toEqual(["planned"]);
    expect(context.monthlySpend).toBe(20);
  });

  it("sorts command-center projections without mutating canonical task, session, or event order", () => {
    const state = emptyState();
    state.tasks = [
      {
        id: "later",
        title: "Later",
        description: "",
        subject: "",
        dueDate: "2026-08-23",
        priority: "medium",
        status: "todo",
        createdAt: "",
      },
      {
        id: "earlier",
        title: "Earlier",
        description: "",
        subject: "",
        dueDate: "2026-08-22",
        priority: "medium",
        status: "todo",
        createdAt: "",
      },
    ];
    state.sessions = [
      {
        id: "late-session",
        subject: "Maths",
        topic: "Algebra",
        date: "2026-08-23",
        startTime: "18:00",
        duration: 30,
        difficulty: "medium",
        priority: "medium",
        notes: "",
        status: "planned",
      },
      {
        id: "early-session",
        subject: "Physics",
        topic: "Waves",
        date: "2026-08-23",
        startTime: "16:00",
        duration: 30,
        difficulty: "medium",
        priority: "medium",
        notes: "",
        status: "planned",
      },
    ];
    state.events = [
      {
        id: "late-event",
        title: "Club",
        subject: "",
        day: 6,
        startTime: "18:00",
        endTime: "19:00",
        type: "personal",
        location: "",
        notes: "",
      },
      {
        id: "early-event",
        title: "Class",
        subject: "",
        day: 6,
        startTime: "09:00",
        endTime: "10:00",
        type: "class",
        location: "",
        notes: "",
      },
    ];
    const context = buildDailyContext(state, "2026-08-23");
    expect(context.dueTasks.map(task => task.id)).toEqual(["earlier", "later"]);
    expect(context.sessions.map(session => session.id)).toEqual([
      "early-session",
      "late-session",
    ]);
    expect(context.timetableEvents.map(event => event.id)).toEqual([
      "early-event",
      "late-event",
    ]);
    expect(state.tasks.map(task => task.id)).toEqual(["later", "earlier"]);
    expect(state.sessions.map(session => session.id)).toEqual([
      "late-session",
      "early-session",
    ]);
    expect(state.events.map(event => event.id)).toEqual([
      "late-event",
      "early-event",
    ]);
  });
});
