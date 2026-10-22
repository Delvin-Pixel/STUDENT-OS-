import { describe, expect, it } from "vitest";
import { trustedAssessmentStorageKey } from "./Quizzes";

describe("trusted assessment resume storage", () => {
  it("scopes the resume pointer by account identity", () => {
    expect(trustedAssessmentStorageKey("quiz-1", "account-a")).not.toBe(
      trustedAssessmentStorageKey("quiz-1", "account-b")
    );
  });

  it("encodes account scope without conflating distinct identities", () => {
    expect(trustedAssessmentStorageKey("quiz-1", "acct/with spaces")).toBe(
      "student-os:trusted-assessment:acct%2Fwith%20spaces:quiz-1"
    );
    expect(trustedAssessmentStorageKey("quiz-1", "   ")).toBe(
      "student-os:trusted-assessment:%20%20%20:quiz-1"
    );
  });
});
