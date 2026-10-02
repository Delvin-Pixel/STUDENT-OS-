import { describe, expect, it } from "vitest";
import {
  buildQuizAttemptResponses,
  normalizeQuizAnswers,
  scoreQuiz,
} from "./quizAssessment";

const quiz = {
  id: "quiz",
  title: "Waves",
  subject: "Physics",
  topic: "Waves",
  topicId: "waves",
  source: "manual" as const,
  createdAt: "2026-08-22",
  questions: [
    {
      id: "one",
      prompt: "Q1",
      type: "multiple_choice" as const,
      options: ["A", "B"],
      correctOptionIndex: 1,
      explanation: "",
    },
    {
      id: "two",
      prompt: "Q2",
      type: "true_false" as const,
      options: ["True", "False"],
      correctOptionIndex: 0,
      explanation: "",
    },
  ],
};

describe("scoreQuiz", () => {
  it("returns a bounded score, correct count, and missed question identifiers", () => {
    expect(scoreQuiz(quiz, { one: 1, two: 1 })).toEqual({
      correctCount: 1,
      questionCount: 2,
      score: 50,
      missedQuestionIds: ["two"],
    });
  });

  it("builds reviewable response evidence with the selected answer and explanation without changing scoring", () => {
    const responses = buildQuizAttemptResponses(quiz, { one: 1, two: 1 });
    expect(responses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          questionId: "one",
          selectedOptionIndex: 1,
          correct: true,
        }),
        expect.objectContaining({
          questionId: "two",
          selectedOptionIndex: 1,
          correctOptionIndex: 0,
          correct: false,
        }),
      ])
    );
  });

  it("rejects missing, non-finite, fractional, and out-of-range answer indices before response evidence is built", () => {
    expect(
      normalizeQuizAnswers(quiz, { one: 1 } as Record<string, number>)
    ).toBeNull();
    expect(normalizeQuizAnswers(quiz, { one: Number.NaN, two: 0 })).toBeNull();
    expect(normalizeQuizAnswers(quiz, { one: 0.5, two: 0 })).toBeNull();
    expect(normalizeQuizAnswers(quiz, { one: 2, two: 0 })).toBeNull();
  });
});
