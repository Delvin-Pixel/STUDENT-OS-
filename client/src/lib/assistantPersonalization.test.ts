import { describe, expect, it } from "vitest";
import {
  getCurrentWeekLearningMinutes,
  getUpcomingExam,
} from "./assistantPersonalization";
import { emptyState } from "./storage";

describe("Study Assistant personalization", () => {
  it("uses canonical in-week completed and Focus time for planning context", () => {
    const state = emptyState();
    state.sessions = [
      {
        id: "completed",
        subject: "Maths",
        topic: "Algebra",
        date: "2026-08-24",
        startTime: "16:00",
        duration: 60,
        actualDuration: 25,
        difficulty: "medium",
        priority: "medium",
        notes: "",
        status: "completed",
      },
      {
        id: "planned",
        subject: "Maths",
        topic: "Geometry",
        date: "2026-08-24",
        startTime: "17:00",
        duration: 45,
        difficulty: "medium",
        priority: "medium",
        notes: "",
        status: "planned",
      },
      {
        id: "old",
        subject: "Maths",
        topic: "Fractions",
        date: "2026-08-17",
        startTime: "16:00",
        duration: 30,
        difficulty: "medium",
        priority: "medium",
        notes: "",
        status: "completed",
      },
    ];
    state.focusSessions = [
      { id: "focus", subject: "Maths", duration: 15, date: "2026-08-24" },
    ];

    expect(
      getCurrentWeekLearningMinutes(state, ["2026-08-18", "2026-08-24"])
    ).toBe(40);
  });

  it("selects the nearest exam without mutating workspace exam order", () => {
    const exams = [
      {
        id: "later",
        subject: "Physics",
        name: "Final",
        date: "2026-09-10",
        time: "",
        location: "",
        notes: "",
        topics: [],
      },
      {
        id: "nearer",
        subject: "Maths",
        name: "Quiz",
        date: "2026-08-25",
        time: "",
        location: "",
        notes: "",
        topics: [],
      },
    ];
    expect(getUpcomingExam(exams)?.id).toBe("nearer");
    expect(exams.map(exam => exam.id)).toEqual(["later", "nearer"]);
  });
});
