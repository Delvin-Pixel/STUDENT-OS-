import { describe, expect, it } from "vitest";
import { getEvidenceQualitySummary, getEvidenceTrust } from "./assessmentTrust";
import type { LearningEvidence } from "./types";

const base = (overrides: Partial<LearningEvidence> = {}): LearningEvidence => ({
  id: "quiz-1",
  topicId: "waves",
  subject: "Physics",
  kind: "quiz",
  score: 80,
  sourceId: "quiz-a",
  recordedAt: "2026-09-02",
  ...overrides,
});

describe("B39 assessment trust", () => {
  it("treats valid direct assessment as strong evidence", () => {
    expect(getEvidenceTrust(base()).label).toBe("strong");
    expect(getEvidenceTrust(base()).weight).toBe(1);
  });

  it("rejects invalid direct scores", () => {
    expect(getEvidenceTrust(base({ score: 140 })).label).toBe("rejected");
    expect(getEvidenceTrust(base({ score: Number.NaN })).weight).toBe(0);
  });

  it("heavily discounts same-source same-day retries", () => {
    const first = base();
    const retry = base({ id: "quiz-2", score: 100 });
    const trust = getEvidenceTrust(retry, [first, retry]);
    expect(trust.label).toBe("weak");
    expect(trust.weight).toBeLessThan(0.25);
  });

  it("allows spaced reassessment to retain meaningful trust", () => {
    const old = base({ id: "old", recordedAt: "2026-08-20" });
    const fresh = base({ id: "fresh", score: 90, recordedAt: "2026-09-02" });
    expect(getEvidenceTrust(fresh, [old, fresh]).weight).toBe(1);
  });

  it("keeps study time weak rather than turning minutes into mastery", () => {
    const evidence = base({
      id: "study",
      kind: "study_session",
      score: undefined,
      minutes: 60,
      sourceId: undefined,
    });
    const trust = getEvidenceTrust(evidence);
    expect(trust.label).toBe("weak");
    expect(trust.weight).toBe(0.25);
  });

  it("summarizes evidence quality for a topic", () => {
    const evidence = [
      base(),
      base({ id: "retry", score: 100 }),
      base({
        id: "study",
        kind: "study_session",
        score: undefined,
        minutes: 20,
        sourceId: undefined,
      }),
    ];
    const summary = getEvidenceQualitySummary(evidence);
    expect(summary.strong).toBe(1);
    expect(summary.weak).toBe(2);
    expect(summary.trustedDirectCount).toBe(1);
  });
});
