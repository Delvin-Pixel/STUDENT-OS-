import { describe, expect, it } from "vitest";
import {
  validateLessonEducationalQuality,
  validateQuizEducationalQuality,
} from "./aiEducationalQuality";

describe("AI educational quality", () => {
  it("accepts a well-formed teaching quiz", () => {
    const questions = Array.from({ length: 50 }, (_, index) => ({
      prompt: `What happens to current in a series circuit, question ${index + 1}?`,
      options: [
        "Current is the same through each component",
        "It disappears",
        "It becomes zero",
        "It changes randomly",
      ],
      correctOptionIndex: 0,
      explanation:
        "In a series circuit, the same current flows through each component in the single path.",
      difficulty: index % 2 ? ("medium" as const) : ("easy" as const),
    }));
    expect(() => validateQuizEducationalQuality({ questions })).not.toThrow();
  });

  it("rejects explanations that are disconnected from the question and answer", () => {
    const questions = Array.from({ length: 50 }, () => ({
      prompt: "Explain a key concept in physics.",
      options: [
        "Series current",
        "Photosynthesis",
        "Market price",
        "Cell division",
      ],
      correctOptionIndex: 0,
      explanation:
        "This is an unrelated sentence about cooking food and travel.",
    }));
    expect(() => validateQuizEducationalQuality({ questions })).toThrow(
      /disconnected/
    );
  });

  it("accepts a coherent lesson scaffold", () => {
    expect(() =>
      validateLessonEducationalQuality({
        learningGoals: ["Explain series circuits"],
        sections: [
          {
            heading: "Series circuits",
            explanation:
              "A series circuit has one path for current and the same current passes through each component.",
          },
        ],
        keyTerms: [
          {
            term: "Current",
            definition:
              "The rate of flow of electric charge through a circuit.",
          },
        ],
        workedExample: {
          prompt: "Describe the current in a series circuit.",
          solution:
            "The current is the same at every point because there is only one path through the circuit.",
        },
        diagram: {
          nodes: ["Source", "Current", "Load"],
          connectors: ["provides", "flows through"],
        },
        quickCheck: {
          question: "What is the defining feature of a series circuit?",
          answer: "It has one continuous path for current.",
        },
      })
    ).not.toThrow();
  });

  it("rejects a diagram with impossible connector count", () => {
    expect(() =>
      validateLessonEducationalQuality({
        learningGoals: ["Explain circuits"],
        sections: [
          {
            heading: "Circuits",
            explanation: "Circuits provide paths for current to flow.",
          },
        ],
        keyTerms: [
          { term: "Current", definition: "The rate of electric charge flow." },
        ],
        workedExample: {
          prompt: "Describe current.",
          solution: "Current is the rate of charge flow through a circuit.",
        },
        diagram: { nodes: ["Source", "Load"], connectors: [] },
        quickCheck: {
          question: "What flows in a circuit?",
          answer: "Electric current flows through the circuit.",
        },
      })
    ).toThrow(/diagram connectors/);
  });
});
