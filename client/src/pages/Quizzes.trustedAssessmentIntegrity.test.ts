import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(new URL("./Quizzes.tsx", import.meta.url)),
  "utf8"
).replace(/\s+/g, " ");

describe("trusted assessment quiz boundary", () => {
  it("starts and submits through protected assessment mutations while preserving the local practice runner", () => {
    expect(source).toContain("Timed assessment");
    expect(source).toContain("trpc.assessments.start.useMutation()");
    expect(source).toContain("trpc.assessments.saveResponse.useMutation()");
    expect(source).toContain("trpc.assessments.submit.useMutation()");
    expect(source).toContain(
      "This server-finalized result is separate from local practice evidence."
    );
    const trustedRunner = source.slice(
      source.indexOf("function TrustedAssessmentRunner"),
      source.indexOf("function QuizRunner")
    );
    expect(trustedRunner).not.toContain("recordQuizAttempt");
    expect(source).toContain("function QuizRunner");
  });
});
