import { describe, expect, it } from "vitest";
import { normalizeNewQuiz, validateNewQuiz } from "./quizValidation";

const validQuiz = {
  title: "Waves quick check",
  subject: "Physics",
  topic: "Waves",
  topicId: "topic-1",
  source: "manual" as const,
  questions: [
    {
      prompt: "Which wave needs a medium?",
      type: "multiple_choice" as const,
      options: ["Sound", "Light"],
      correctOptionIndex: 0,
      explanation: "Sound is mechanical.",
    },
  ],
};

describe("quizValidation", () => {
  it("normalizes learner-reviewed text and accepts a bounded canonical quiz", () => {
    const normalized = normalizeNewQuiz({
      ...validQuiz,
      title: " Waves quick check ",
      questions: [
        { ...validQuiz.questions[0], options: [" Sound ", " Light "] },
      ],
    });
    expect(normalized.title).toBe("Waves quick check");
    expect(normalized.questions[0].options).toEqual(["Sound", "Light"]);
    expect(validateNewQuiz(normalized)).toBeNull();
  });

  it("rejects invalid questions before they can enter the canonical workspace", () => {
    expect(validateNewQuiz({ ...validQuiz, title: " ".repeat(501) })).toContain(
      "Give the quiz"
    );
    expect(validateNewQuiz({ ...validQuiz, questions: [] })).toContain(
      "between 1 and 100"
    );
    expect(
      validateNewQuiz({
        ...validQuiz,
        questions: [
          {
            ...validQuiz.questions[0],
            options: ["Only one"],
            correctOptionIndex: 0,
          },
        ],
      })
    ).toContain("between 2 and 6");
    expect(
      validateNewQuiz({
        ...validQuiz,
        questions: [{ ...validQuiz.questions[0], correctOptionIndex: 2 }],
      })
    ).toContain("correct answer");
    expect(
      validateNewQuiz({
        ...validQuiz,
        questions: [
          { ...validQuiz.questions[0], explanation: "x".repeat(20_001) },
        ],
      })
    ).toContain("20,000");
  });
});
