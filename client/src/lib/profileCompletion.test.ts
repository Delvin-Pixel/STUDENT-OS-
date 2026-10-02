import type { Profile } from "@/lib/types";
import { describe, expect, it } from "vitest";
import { withOnboardingName } from "./profileCompletion";

const fallback: Profile = {
  name: "",
  studentType: "Other",
  educationLevel: "Other",
  goals: [],
  subjects: [],
  hoursPerDay: "1 hour",
};

describe("onboarding profile completion merge", () => {
  it("preserves an accepted queued profile while applying the final onboarding name", () => {
    const acceptedProfile: Profile = {
      name: "Draft name",
      age: 17,
      studentType: "Secondary School",
      educationLevel: "Secondary",
      goals: ["Prepare for exams"],
      subjects: ["Physics", "Mathematics"],
      hoursPerDay: "2 hours",
      profilePhotoStorageKey: "profile-photo-key",
    };

    expect(withOnboardingName(acceptedProfile, fallback, "Ada")).toEqual({
      ...acceptedProfile,
      name: "Ada",
    });
  });
});
