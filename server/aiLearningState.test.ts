import { describe, expect, it } from "vitest";
import {
  buildLearningStateSnapshot,
  learningStatePrompt,
  validateLearningStateClaims,
} from "./aiLearningState";

const base = {
  topics: [{ id: "t1", subject: "Physics", name: "Electricity" }],
  learningEvidence: [
    {
      id: "e1",
      topicId: "t1",
      subject: "Physics",
      kind: "quiz",
      score: 42,
      recordedAt: "2026-08-31T10:00:00Z",
    },
    {
      id: "e2",
      topicId: "t1",
      subject: "Physics",
      kind: "practice",
      score: 50,
      recordedAt: "2026-08-30T10:00:00Z",
    },
  ],
  exams: [
    {
      id: "x1",
      subject: "Physics",
      name: "Physics Mock",
      date: "2026-09-05",
      topics: [{ id: "t1", name: "Electricity", status: "learning" }],
    },
  ],
  tasks: [
    {
      subject: "Physics",
      title: "Revise circuits",
      topicId: "t1",
      dueDate: "2026-09-03",
      priority: "high",
      status: "todo",
    },
  ],
};

describe("ai learning state", () => {
  it("projects bounded, deterministic state into AI context", () => {
    const snapshot = buildLearningStateSnapshot(
      base,
      "Physics",
      "Electricity",
      "2026-09-01"
    );
    expect(snapshot.masteryScore).toBeGreaterThanOrEqual(0);
    expect(snapshot.masteryScore).toBeLessThan(60);
    expect(snapshot.upcomingExamDays).toBe(4);
    expect(learningStatePrompt(snapshot)).toMatch(/42|mastery/i);
  });

  it("rejects unsupported assessment claims", () => {
    const snapshot = buildLearningStateSnapshot(
      base,
      "Physics",
      "Electricity",
      "2026-09-01"
    );
    expect(() =>
      validateLearningStateClaims(
        "You scored 99% on this topic.",
        snapshot,
        "Lesson"
      )
    ).toThrow(/unsupported assessment score/i);
  });

  it("rejects unsupported imminent exam claims", () => {
    const state = buildLearningStateSnapshot(
      { ...base, exams: [] },
      "Physics",
      "Electricity",
      "2026-09-01"
    );
    expect(() =>
      validateLearningStateClaims("Your exam is tomorrow.", state, "Lesson")
    ).toThrow(/unsupported imminent-exam/i);
  });
});
