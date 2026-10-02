import { describe, expect, it } from "vitest";
import { examDialogDefaults, sessionDialogDefaults } from "./formDefaults";
import type { Exam, StudySession } from "./types";

describe("dialog form defaults", () => {
  it("preserves an existing Study Planner subject when an edit dialog is opened", () => {
    const session: StudySession = {
      id: "session-1",
      subject: "Mathematics",
      topic: "Algebraic expressions",
      date: "2026-08-13",
      startTime: "16:00",
      duration: 45,
      difficulty: "medium",
      priority: "high",
      notes: "Practice factorising.",
      status: "planned",
    };

    expect(sessionDialogDefaults(session)).toMatchObject({
      subject: "Mathematics",
      topic: "Algebraic expressions",
      startTime: "16:00",
    });
    expect(sessionDialogDefaults(null)).toMatchObject({
      subject: "",
      startTime: "09:00",
      duration: 60,
    });
  });

  it("preserves an existing Exam Center subject when an edit dialog is opened", () => {
    const exam: Exam = {
      id: "exam-1",
      subject: "Science",
      name: "Chemistry practical",
      date: "2026-09-01",
      time: "09:00",
      location: "Lab 2",
      notes: "Bring calculator.",
      topics: [],
    };

    expect(examDialogDefaults(exam)).toMatchObject({
      subject: "Science",
      name: "Chemistry practical",
    });
    expect(examDialogDefaults(null)).toMatchObject({
      subject: "",
      name: "",
      date: "",
    });
  });
});
