import { describe, expect, it } from "vitest";
import { rankTransitionOptions } from "./transitionRecommendations";
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
];

function option(id: string, maxAggregate = 24): TransitionDecisionOption {
  return {
    id,
    name: id,
    type: "programme",
    confidence: "official",
    sourceUrl: "https://example.edu/requirements",
    sourceVerifiedAt: "2026-09-01T00:00:00Z",
    requiredSubjects: [
      { subject: "English", minimumGrade: "C6" },
      { subject: "Core Mathematics", minimumGrade: "C6" },
    ],
    maxAggregate,
  };
}

describe("transition recommendation engine", () => {
  it("ranks a comfortably eligible option above a borderline option", () => {
    const ranked = rankTransitionOptions(
      [option("comfortable", 24), option("borderline", 16)],
      results,
      16
    );
    expect(ranked[0].optionId).toBe("comfortable");
    expect(ranked.find(item => item.optionId === "borderline")?.fitBand).toBe(
      "borderline_fit"
    );
  });
  it("never calls the result an admission probability", () => {
    const ranked = rankTransitionOptions([option("it")], results, 16);
    expect(ranked[0].caution).toMatch(/not an admission probability/i);
  });
});
