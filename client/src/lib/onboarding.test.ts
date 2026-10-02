import { restartOnboardingState } from "@/lib/onboarding";
import { emptyState } from "@/lib/storage";
import { describe, expect, it } from "vitest";

describe("restartOnboardingState", () => {
  it("returns to onboarding without deleting existing student work", () => {
    const state = emptyState();
    state.onboarded = true;
    state.profile = {
      name: "Ada",
      age: 16,
      studentType: "Secondary School",
      hoursPerDay: "1 hour",
      educationLevel: "Secondary",
      goals: ["Exam preparation"],
      subjects: ["Mathematics"],
    };
    state.tasks = [
      {
        id: "task-1",
        title: "Revise algebra",
        subject: "Mathematics",
        status: "todo",
        description: "",
        priority: "high",
        createdAt: "2026-08-12",
        dueDate: "2026-08-14",
      },
    ];
    state.notes = [
      {
        id: "note-1",
        title: "Formula list",
        subject: "Mathematics",
        content: "Area = length × width",
        pinned: true,
        createdAt: "2026-08-12T12:00:00.000Z",
        updatedAt: "2026-08-12T12:00:00.000Z",
      },
    ];
    state.savedLessons = [
      {
        id: "lesson-1",
        selectionKey: "2026-08-12-maths-algebra",
        savedAt: "2026-08-12T12:00:00.000Z",
        dateStr: "2026-08-12",
        subject: "Mathematics",
        branch: "Algebra",
        topic: "Linear equations",
        title: "Solving linear equations",
        strapline: "Balance both sides of the equation.",
        learningGoals: ["Solve a one-step equation"],
        recap: "Keep an equation balanced.",
      },
    ];
    state.xp = 240;

    const restarted = restartOnboardingState(state);

    expect(restarted.onboarded).toBe(false);
    expect(restarted.profile).toBeNull();
    expect(restarted.tasks).toEqual(state.tasks);
    expect(restarted.notes).toEqual(state.notes);
    expect(restarted.savedLessons).toEqual(state.savedLessons);
    expect(restarted.xp).toBe(240);
  });
});
