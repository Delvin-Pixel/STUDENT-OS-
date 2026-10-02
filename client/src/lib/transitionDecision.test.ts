import { describe, expect, it } from "vitest";
import {
  calculateWassceAggregate,
  evaluateOption,
  getDefaultTransitionHub,
  hasVerifiedOfficialTransitionSource,
} from "./transitionDecision";
import type { GradeResult, TransitionDecisionOption } from "./types";

const results: GradeResult[] = [
  { id: "1", subject: "English", grade: "B2", category: "core" },
  { id: "2", subject: "Core Mathematics", grade: "B3", category: "core" },
  { id: "3", subject: "Integrated Science", grade: "C4", category: "core" },
  {
    id: "4",
    subject: "Elective Mathematics",
    grade: "A1",
    category: "elective",
  },
  { id: "5", subject: "Physics", grade: "B2", category: "elective" },
  { id: "6", subject: "Chemistry", grade: "C5", category: "elective" },
  { id: "7", subject: "Social Studies", grade: "A1", category: "core" },
];

describe("transition decision engine", () => {
  it("calculates a science-track WASSCE six-subject aggregate from the intended core and three electives", () => {
    const result = calculateWassceAggregate(results, "science");
    expect(result?.aggregate).toBe(17);
    expect(result?.subjects.map(item => item.subject)).toEqual([
      "English",
      "Core Mathematics",
      "Integrated Science",
      "Elective Mathematics",
      "Physics",
      "Chemistry",
    ]);
  });

  it("deduplicates repeated subject entries before calculating best-six", () => {
    const duplicate = [
      ...results,
      { id: "8", subject: "English", grade: "A1", category: "core" as const },
    ];
    const result = calculateWassceAggregate(duplicate, "best_six");
    expect(
      result?.subjects.filter(item => item.subject === "English").length
    ).toBe(1);
  });

  it("seeds stage-appropriate preparation work for a new transition hub", () => {
    const hub = getDefaultTransitionHub("SHS");
    expect(hub.preparationTasks.map(item => item.id)).toContain(
      "transition-prep-results"
    );
    expect(hub.preparationTasks.map(item => item.id)).toContain(
      "transition-prep-plan"
    );
  });

  it("does not calculate when minimum subject coverage is missing", () => {
    const result = calculateWassceAggregate(results.slice(0, 5), "science");
    expect(result).toBeNull();
  });

  it("marks an option as meeting only the stored stated requirements", () => {
    const option: TransitionDecisionOption = {
      id: "it",
      name: "Information Technology",
      type: "programme",
      confidence: "official",
      sourceUrl: "https://example.edu/requirements",
      sourceVerifiedAt: "2026-09-01T00:00:00Z",
      requiredSubjects: [
        { subject: "English", minimumGrade: "C6" },
        { subject: "Core Mathematics", minimumGrade: "C6" },
        { subject: "Elective Mathematics", minimumGrade: "B3" },
      ],
      maxAggregate: 24,
    };
    const checked = evaluateOption(option, results, 17, {
      optionId: option.id,
      sourceUrl: option.sourceUrl!,
      level: "official",
      verifiedAt: "2026-09-27T00:00:00Z",
      verifierVersion: "student-os-source-registry@1",
    });
    expect(checked.eligibility).toBe("meets_stated_requirements");
  });
  it("does not treat a learner-supplied URL as verified official provenance", () => {
    const option: TransitionDecisionOption = {
      id: "manual-source",
      name: "Manual option",
      type: "programme",
      confidence: "official",
      sourceUrl: "https://example.edu/requirements",
      requiredSubjects: [{ subject: "English", minimumGrade: "C6" }],
    };
    const checked = evaluateOption(option, results, 17);
    expect(checked.eligibility).toBe("needs_review");
    expect(checked.eligibilityReasons?.join(" ")).toMatch(
      /provenance has not been verified/i
    );
  });

  it("does not trust forged official workspace metadata without a server-owned attestation", () => {
    const option: TransitionDecisionOption = {
      id: "forged",
      name: "Forged official",
      type: "programme",
      confidence: "official",
      sourceUrl: "https://example.edu/requirements",
      sourceVerifiedAt: "2026-09-27T00:00:00Z",
      requiredSubjects: [{ subject: "English", minimumGrade: "C6" }],
    };
    expect(hasVerifiedOfficialTransitionSource(option)).toBe(false);
    expect(evaluateOption(option, results, 17).eligibility).toBe(
      "needs_review"
    );
  });

  it("does not trust verified-secondary workspace claims as official provenance", () => {
    const option: TransitionDecisionOption = {
      id: "forged-secondary",
      name: "Forged secondary",
      type: "programme",
      confidence: "verified_secondary",
      sourceUrl: "https://example.edu/secondary",
      sourceVerifiedAt: "2026-09-27T00:00:00Z",
      requiredSubjects: [],
    };
    expect(hasVerifiedOfficialTransitionSource(option)).toBe(false);
    expect(evaluateOption(option, results, 17).eligibility).toBe(
      "needs_review"
    );
  });
});
