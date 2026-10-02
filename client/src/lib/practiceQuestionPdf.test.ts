import { describe, expect, it } from "vitest";
import {
  buildReviewedPracticeQuestionPdfLines,
  isMaterialPracticeDraftReviewed,
  type MaterialPracticeQuestionDraft,
} from "./practiceQuestionPdf";

const draft: MaterialPracticeQuestionDraft = {
  title: "States of matter — revision",
  instructions: "Choose the answer you verified against your material.",
  questions: [
    {
      prompt: "Which state has a fixed volume but no fixed shape?",
      options: ["Solid", "Liquid", "Gas"],
      correctOptionIndex: 1,
      explanation: "Liquids retain volume while taking the container's shape.",
    },
  ],
};

describe("reviewed material practice-question PDF content", () => {
  it("requires every generated question to be learner-reviewed before export", () => {
    expect(isMaterialPracticeDraftReviewed(1, {})).toBe(false);
    expect(isMaterialPracticeDraftReviewed(1, { 0: true })).toBe(true);
    expect(isMaterialPracticeDraftReviewed(2, { 0: true })).toBe(false);
  });

  it("builds offline study content with questions, choices, verified answer, and explanation", () => {
    const lines = buildReviewedPracticeQuestionPdfLines(
      draft,
      new Date("2026-08-23T00:00:00.000Z")
    );
    expect(lines.map(line => line.value)).toEqual(
      expect.arrayContaining([
        "States of matter - revision",
        "1. Which state has a fixed volume but no fixed shape?",
        "A. Solid",
        "B. Liquid",
        "Answer: B. Liquid",
        "Explanation: Liquids retain volume while taking the container's shape.",
      ])
    );
    expect(lines.some(line => line.value.includes("storageKey"))).toBe(false);
  });
});
