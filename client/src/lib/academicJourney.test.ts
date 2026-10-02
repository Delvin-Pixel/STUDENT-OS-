import { describe, expect, it } from "vitest";
import {
  academicStageFor,
  createAcademicJourney,
  evaluateAcademicJourney,
  expectedCompletionYearFor,
} from "./academicJourney";
import type { Profile } from "./types";

const base: Profile = {
  name: "Delvin",
  studentType: "Secondary School",
  educationLevel: "Lower Secondary",
  classLevel: "JHS 3",
  academicYear: "2026/27",
  goals: [],
  subjects: ["Mathematics"],
  hoursPerDay: "1 hour",
};

describe("academic journey", () => {
  it("maps education level to the correct journey stage", () => {
    expect(academicStageFor("Lower Secondary")).toBe("JHS");
    expect(academicStageFor("Secondary")).toBe("SHS");
    expect(academicStageFor("Tertiary")).toBe("Tertiary");
  });
  it("does not downgrade a student who enters at a later class", () => {
    const journey = createAcademicJourney({
      ...base,
      classLevel: "SHS 2",
      educationLevel: "Secondary",
      studentType: "Secondary School",
    });
    expect(journey.current.classLevel).toBe("SHS 2");
  });
  it("marks terminal classes for transition confirmation", () => {
    const journey = createAcademicJourney(
      base,
      new Date("2026-09-03T00:00:00Z")
    );
    const evaluated = evaluateAcademicJourney(
      journey,
      new Date("2029-01-01T00:00:00Z")
    );
    expect(evaluated.current.status).toBe("awaiting_confirmation");
    expect(evaluated.transition?.to).toBe("SHS");
  });
  it("projects completion from the selected class and academic year", () => {
    expect(expectedCompletionYearFor("SHS", "SHS 2", "2026/27")).toBe(2028);
  });
});
