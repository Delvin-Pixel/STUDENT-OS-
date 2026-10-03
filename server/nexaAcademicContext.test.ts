import { describe, expect, it } from "vitest";
import type { CanonicalStudyState } from "@shared/workspaceSchema";
import { buildStudentOsNexaAcademicContext } from "./nexaAcademicContext";

function state(): CanonicalStudyState {
  return {
    tasks: [
      {
        id: "task-1",
        title: "Finish algebra practice",
        subject: "Mathematics",
        status: "todo",
        priority: "high",
        dueDate: "2026-10-03",
        estimatedMinutes: 30,
      },
    ],
    sessions: [],
    topics: [
      {
        id: "factorisation",
        subject: "Mathematics",
        name: "Factorisation",
        prerequisiteTopicIds: [],
      },
    ],
    learningEvidence: [
      {
        id: "evidence-1",
        topicId: "factorisation",
        subject: "Mathematics",
        kind: "quiz",
        score: 48,
        sourceId: "quiz-1",
        recordedAt: "2026-10-02T12:00:00.000Z",
      },
    ],
    studyPlans: [],
    quizzes: [],
    quizAttempts: [],
    studyMaterials: [],
    decks: [],
    exams: [],
    events: [],
  } as unknown as CanonicalStudyState;
}

describe("NEXA academic context projection", () => {
  it("uses canonical learningIntelligence evidence for a named topic", () => {
    const context = buildStudentOsNexaAcademicContext(
      state(),
      "Explain my Factorisation progress",
      "workspace:9",
      "2026-10-03"
    );
    expect(context?.authority).toBe("student-os-learning-intelligence");
    expect(context?.snapshotId).toBe("workspace:9");
    expect(context?.evidence.join("\n")).toContain(
      "Canonical topic: Mathematics — Factorisation."
    );
    expect(context?.evidence.join("\n")).toMatch(/Canonical mastery \d+\/100/);
    expect(context?.constraints?.join("\n")).toContain(
      "learningIntelligence is authoritative"
    );
  });

  it("includes the deterministic next-best action for personalized coaching", () => {
    const context = buildStudentOsNexaAcademicContext(
      state(),
      "What should I study next?",
      "workspace:10",
      "2026-10-03"
    );
    expect(context?.evidence.join("\n")).toContain(
      "Student OS next-best action 1"
    );
    expect(context?.constraints?.join("\n")).toContain(
      "Do not re-rank or replace Student OS next-best actions"
    );
  });

  it("does not manufacture academic context for an unrelated factual question", () => {
    expect(
      buildStudentOsNexaAcademicContext(
        state(),
        "What is the capital of France?",
        "workspace:11",
        "2026-10-03"
      )
    ).toBeUndefined();
  });
});
