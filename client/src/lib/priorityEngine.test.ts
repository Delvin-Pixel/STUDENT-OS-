import { describe, expect, it } from "vitest";
import { getRankedNextActions, getTopicMastery } from "./learningIntelligence";
import { getActionDecisionIndex } from "./priorityEngine";
import { emptyState } from "./storage";
import type { StudyState } from "./types";

const baseState = (): StudyState => ({
  ...emptyState(),
  onboarded: true,
  profile: null,
});

describe("deterministic priority engine", () => {
  it("does not let a weak study topic outrank an actively in-progress session", () => {
    const state = baseState();
    state.topics = [
      {
        id: "waves",
        subject: "Physics",
        name: "Waves",
        source: "manual",
        createdAt: "",
        updatedAt: "",
      },
    ];
    state.sessions = [
      {
        id: "active",
        subject: "Maths",
        topic: "Algebra",
        date: "2026-08-22",
        startTime: "16:00",
        duration: 25,
        difficulty: "medium",
        priority: "medium",
        notes: "Finish",
        status: "in_progress",
      },
    ];
    state.exams = [
      {
        id: "exam",
        subject: "Physics",
        name: "Mock",
        date: "2026-08-23",
        time: "",
        location: "",
        notes: "",
        topics: [{ id: "waves", name: "Waves", status: "learning" }],
      },
    ];
    state.learningEvidence = [
      {
        id: "e",
        topicId: "waves",
        subject: "Physics",
        kind: "quiz",
        score: 10,
        recordedAt: "2026-08-21",
      },
    ];
    const ranked = getRankedNextActions(state, "2026-08-22");
    expect(ranked[0]?.id).toBe("session:active");
  });

  it("keeps score explainability separate from the display score", () => {
    const state = baseState();
    state.tasks = [
      {
        id: "task",
        title: "Submit lab",
        description: "",
        subject: "Physics",
        dueDate: "2026-08-22",
        priority: "high",
        status: "todo",
        createdAt: "",
      },
    ];
    const actions = getRankedNextActions(state, "2026-08-22");
    const decisions = getActionDecisionIndex(
      state,
      actions,
      getTopicMastery(state),
      "2026-08-22"
    );
    expect(decisions[0]?.factors.urgency).toBeGreaterThan(0);
    expect(decisions[0]?.factors.userPriority).toBe(100);
  });

  it("is deterministic when two actions have equal scores", () => {
    const state = baseState();
    state.tasks = [
      {
        id: "b",
        title: "B",
        description: "",
        subject: "",
        dueDate: "2026-08-22",
        priority: "low",
        status: "todo",
        createdAt: "",
      },
      {
        id: "a",
        title: "A",
        description: "",
        subject: "",
        dueDate: "2026-08-22",
        priority: "low",
        status: "todo",
        createdAt: "",
      },
    ];
    const first = getRankedNextActions(state, "2026-08-22").map(
      entry => entry.id
    );
    const second = getRankedNextActions(state, "2026-08-22").map(
      entry => entry.id
    );
    expect(first).toEqual(second);
  });
});

describe("B31 mastery-aware priority", () => {
  it("uses evidence freshness and exam pressure without treating estimates as proof", () => {
    const state = baseState();
    state.topics = [
      {
        id: "waves",
        subject: "Physics",
        name: "Waves",
        source: "manual",
        createdAt: "",
        updatedAt: "",
      },
    ];
    state.exams = [
      {
        id: "exam",
        subject: "Physics",
        name: "Mock",
        date: "2026-08-25",
        time: "",
        location: "",
        notes: "",
        topics: [{ id: "waves", name: "Waves", status: "learning" }],
      },
    ];
    state.learningEvidence = [
      {
        id: "recent",
        topicId: "waves",
        subject: "Physics",
        kind: "quiz",
        score: 40,
        recordedAt: "2026-08-22",
      },
    ];
    const action = getRankedNextActions(state, "2026-08-22")[0];
    const decision = getActionDecisionIndex(
      state,
      [action],
      getTopicMastery(state, "2026-08-22"),
      "2026-08-22"
    )[0];
    expect(decision?.factors.examPressure).toBe(95);
    expect(decision?.confidence).toBe("medium");
  });
});
