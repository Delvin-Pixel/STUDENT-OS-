import { describe, expect, it } from "vitest";
import { getTopicMastery } from "./learningIntelligence";
import { emptyState } from "./storage";
import type { StudyState } from "./types";

const state = (evidence: StudyState["learningEvidence"]): StudyState => ({
  ...emptyState(),
  topics: [
    {
      id: "waves",
      subject: "Physics",
      name: "Waves",
      source: "manual",
      createdAt: "2026-09-01",
      updatedAt: "2026-09-01",
    },
  ],
  exams: [],
  learningEvidence: evidence,
});

describe("B39 mastery integration", () => {
  it("does not let same-day retries dominate a low-trust assessment trail", () => {
    const evidence = [
      {
        id: "a",
        topicId: "waves",
        subject: "Physics",
        kind: "quiz" as const,
        score: 40,
        sourceId: "same-quiz",
        recordedAt: "2026-09-02",
      },
      {
        id: "b",
        topicId: "waves",
        subject: "Physics",
        kind: "quiz" as const,
        score: 100,
        sourceId: "same-quiz",
        recordedAt: "2026-09-02",
      },
      {
        id: "c",
        topicId: "waves",
        subject: "Physics",
        kind: "quiz" as const,
        score: 100,
        sourceId: "same-quiz",
        recordedAt: "2026-09-02",
      },
    ];
    const mastery = getTopicMastery(state(evidence), "2026-09-02")[0];
    expect(mastery.directEvidenceCount).toBe(1);
    expect(mastery.score).toBeLessThan(70);
  });
});
