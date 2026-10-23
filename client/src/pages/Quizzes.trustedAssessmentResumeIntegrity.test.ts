import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { trustedAssessmentStorageKey } from "./Quizzes";

const source = readFileSync(
  fileURLToPath(new URL("./Quizzes.tsx", import.meta.url)),
  "utf8"
).replace(/\s+/g, " ");
const assessmentSource = readFileSync(
  fileURLToPath(new URL("../../../server/assessments.ts", import.meta.url)),
  "utf8"
);

describe("trusted assessment refresh resume integrity", () => {
  it("keeps distinct account identities and delimiter-containing quiz IDs isolated", () => {
    expect(trustedAssessmentStorageKey("q", "owner/a")).not.toBe(
      trustedAssessmentStorageKey("q", "owner_a")
    );
    expect(trustedAssessmentStorageKey("b:c", "a")).not.toBe(
      trustedAssessmentStorageKey("c", "a:b")
    );
  });
  it("persists only a namespaced opaque session reference and resumes answers/result through the protected read route", () => {
    expect(trustedAssessmentStorageKey("quiz-42", "owner-1")).toBe(
      "student-os:trusted-assessment:owner-1:quiz-42"
    );
    expect(trustedAssessmentStorageKey("quiz-42", "owner/with spaces")).toBe(
      "student-os:trusted-assessment:owner%2Fwith%20spaces:quiz-42"
    );
    expect(source).toContain(
      "window.sessionStorage.setItem(storageKey, String(started.sessionId))"
    );
    expect(source).toContain("trpc.assessments.read.useQuery");
    expect(source).toMatch(
      /setAnswers\(\s*Object\.fromEntries\(\s*resumed\.data\.responses\.map/
    );
    expect(source).toContain(
      "if (resumed.data.result) setResult(resumed.data.result)"
    );
    expect(assessmentSource).toContain(
      "...assessmentGradeForScore(result.score)"
    );
  });
});
