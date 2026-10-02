import { describe, expect, it } from "vitest";
import {
  academicEnvironmentKey,
  getAcademicEnvironment,
} from "./academicEnvironment";
import type { Profile } from "./types";

const base: Profile = {
  name: "Delvin",
  studentType: "Secondary School",
  educationLevel: "Secondary",
  classLevel: "SHS 2",
  academicYear: "2026/27",
  academicTrack: "General Science",
  academicSelectionKind: "subject",
  goals: [],
  subjects: ["Physics", "Chemistry", "Mathematics"],
  hoursPerDay: "1 hour",
};

describe("academic environment", () => {
  it("tunes the environment to the selected SHS class and track", () => {
    const env = getAcademicEnvironment(base);
    expect(env.label).toContain("SHS 2");
    expect(env.label).toContain("General Science");
    expect(env.assessmentLabel).toContain("WASSCE");
    expect(env.progression).toBe("developing");
  });

  it("recognises terminal JHS and SHS classes", () => {
    expect(
      getAcademicEnvironment({
        ...base,
        educationLevel: "Lower Secondary",
        classLevel: "JHS 3",
        academicTrack: undefined,
      }).progression
    ).toBe("terminal");
    expect(
      getAcademicEnvironment({ ...base, classLevel: "SHS 3" }).progression
    ).toBe("terminal");
  });

  it("changes the environment key when academic context changes", () => {
    expect(academicEnvironmentKey(base)).not.toBe(
      academicEnvironmentKey({ ...base, classLevel: "SHS 1" })
    );
  });
});
