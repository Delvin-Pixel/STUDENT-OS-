import { describe, expect, it } from "vitest";
import type { TransitionSourceAttestation } from "./transitionDecision";
import {
  getTransitionNextActions,
  getTransitionReadiness,
} from "./transitionPlanning";
import { rankTransitionOptions } from "./transitionRecommendations";
import type { GradeResult, TransitionDecisionHub } from "./types";

const results: GradeResult[] = [
  { id: "1", subject: "English", grade: "B2", category: "core" },
  { id: "2", subject: "Core Mathematics", grade: "B3", category: "core" },
];

function hub(
  overrides: Partial<TransitionDecisionHub> = {}
): TransitionDecisionHub {
  return {
    sourceStage: "SHS",
    targetStage: "Tertiary",
    status: "preparing",
    results,
    options: [
      {
        id: "it",
        name: "Information Technology",
        type: "programme",
        confidence: "official",
        sourceUrl: "https://example.edu/requirements",
        sourceVerifiedAt: "2026-09-01T00:00:00Z",
        requiredSubjects: [
          { subject: "English", minimumGrade: "C6" },
          { subject: "Core Mathematics", minimumGrade: "C6" },
        ],
      },
    ],
    preparationTasks: [],
    lastUpdatedAt: new Date().toISOString(),
    ...overrides,
  };
}

const officialAttestation: TransitionSourceAttestation = {
  optionId: "it",
  sourceUrl: "https://example.edu/requirements",
  level: "official",
  verifiedAt: "2026-09-27T00:00:00Z",
  verifierVersion: "student-os-source-registry@1",
};

describe("transition intelligence", () => {
  it("reports exploring when there are no saved options", () => {
    const current = hub({ options: [] });
    const ranked = rankTransitionOptions([], current.results);
    expect(getTransitionReadiness(current, ranked).status).toBe("exploring");
    expect(getTransitionNextActions("SHS", current, ranked)[0].id).toBe(
      "add-options"
    );
  });

  it("requires evidence when a required result is missing", () => {
    const current = hub({
      results: [{ id: "1", subject: "English", grade: "B2", category: "core" }],
    });
    const ranked = rankTransitionOptions(current.options, current.results);
    expect(getTransitionReadiness(current, ranked).status).toBe(
      "evidence_needed"
    );
    expect(
      getTransitionNextActions("SHS", current, ranked).some(
        item => item.id === "fill-result-gaps"
      )
    ).toBe(true);
  });

  it("reaches decision-ready planning with sufficient evidence", () => {
    const current = hub();
    current.results.push({
      id: "3",
      subject: "Physics",
      grade: "B2",
      category: "elective",
    });
    current.options[0].requiredSubjects.push({
      subject: "Physics",
      minimumGrade: "C6",
    });
    const ranked = rankTransitionOptions(current.options, current.results);
    expect(getTransitionReadiness(current, ranked).status).not.toBe(
      "decision_ready"
    );
    expect(
      getTransitionReadiness(current, ranked, [officialAttestation]).status
    ).toBe("decision_ready");
    expect(
      getTransitionNextActions("SHS", current, ranked).some(
        item => item.id === "build-timeline"
      )
    ).toBe(true);
  });

  it("uses stable source references for promotable actions", () => {
    const current = hub();
    const ranked = rankTransitionOptions(current.options, current.results);
    const actions = getTransitionNextActions("SHS", current, ranked);
    expect(
      actions.every(item => item.sourceRef.startsWith("transition-action:"))
    ).toBe(true);
  });
});
