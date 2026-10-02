import { describe, expect, it } from "vitest";
import {
  validateLearningContextAlignment,
  validateLessonSemanticIntegrity,
  validateScheduleSemanticIntegrity,
} from "./aiSemanticIntegrity";

describe("AI semantic integrity", () => {
  it("accepts strongly aligned output", () => {
    expect(() =>
      validateLearningContextAlignment({
        outputText:
          "Physics lesson about series circuits and current through a series circuit.",
        subject: "Physics",
        topic: "Series Circuits",
        educationLevel: "Secondary",
        label: "Lesson output",
      })
    ).not.toThrow();
  });

  it("rejects strong subject/topic drift", () => {
    expect(() =>
      validateLearningContextAlignment({
        outputText: "Biology lesson about photosynthesis and cell division.",
        subject: "Physics",
        topic: "Series Circuits",
        educationLevel: "Secondary",
        label: "Quiz draft",
      })
    ).toThrow(/subject\/topic/);
  });

  it("rejects an explicit conflicting education level", () => {
    expect(() =>
      validateLearningContextAlignment({
        outputText: "This university course covers series circuits in Physics.",
        subject: "Physics",
        topic: "Series Circuits",
        educationLevel: "Primary",
        label: "Lesson output",
      })
    ).toThrow(/education-level mismatch/);
  });

  it("accepts a schedule that references an exact supplied deadline", () => {
    expect(() =>
      validateScheduleSemanticIntegrity(
        {
          sessions: [
            {
              subject: "Physics",
              topic: "Circuits",
              deadlineTitle: "Physics Mock",
            },
          ],
        },
        { deadlines: [{ subject: "Physics", title: "Physics Mock" }] }
      )
    ).not.toThrow();
  });

  it("rejects an invented deadline/subject pair", () => {
    expect(() =>
      validateScheduleSemanticIntegrity(
        {
          sessions: [
            {
              subject: "Biology",
              topic: "Cells",
              deadlineTitle: "Physics Mock",
            },
          ],
        },
        { deadlines: [{ subject: "Physics", title: "Physics Mock" }] }
      )
    ).toThrow(/deadline\/subject/);
  });

  it("guards generated lessons with the same semantic rule", () => {
    expect(() =>
      validateLessonSemanticIntegrity(
        {
          title: "Series Circuits",
          summary: "Physics lesson on series circuits.",
        },
        {
          subject: "Physics",
          topic: "Series Circuits",
          educationLevel: "Secondary",
        }
      )
    ).not.toThrow();
  });

  it("rejects generic unrelated lessons", () => {
    expect(() =>
      validateLessonSemanticIntegrity(
        {
          title: "Study Skills",
          summary: "Time management and note taking.",
        },
        {
          subject: "Physics",
          topic: "Series Circuits",
          educationLevel: "Secondary",
        }
      )
    ).toThrow();
  });
});
