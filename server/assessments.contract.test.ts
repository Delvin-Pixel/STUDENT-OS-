import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  assessmentGradeForScore,
  assessmentSaveResponseInput,
  assessmentStartInput,
  assessmentSubmitInput,
} from "./assessments";

const source = readFileSync(
  fileURLToPath(new URL("./assessments.ts", import.meta.url)),
  "utf8"
);
const router = readFileSync(
  fileURLToPath(new URL("./routers.ts", import.meta.url)),
  "utf8"
);
const schema = readFileSync(
  fileURLToPath(new URL("../drizzle/schema.ts", import.meta.url)),
  "utf8"
);

describe("trusted assessment contract", () => {
  it("bounds opaque start and submit keys plus saved answer indices", () => {
    expect(
      assessmentStartInput.safeParse({
        quizId: "quiz",
        clientStartKey: "too-short",
      }).success
    ).toBe(false);
    expect(
      assessmentSubmitInput.safeParse({
        sessionId: 1,
        clientSubmitKey: "x".repeat(16),
      }).success
    ).toBe(true);
    expect(
      assessmentSaveResponseInput.safeParse({
        sessionId: 1,
        questionOrdinal: 100,
        selectedOptionIndex: 0,
      }).success
    ).toBe(false);
  });

  it("derives ownership from the protected caller, snapshots answer keys server-side, and withholds them from active reads", () => {
    expect(router).toContain("startAssessment(ctx.user.openId, input)");
    expect(router).toContain("submitAssessment(ctx.user.openId, input)");
    expect(source).toContain("const quiz = parsed.data.quizzes.find");
    expect(source).toContain(
      "function learnerQuestion(question: SnapshotQuestion): LearnerQuestion"
    );
    expect(source).toContain("questions: questions.map(learnerQuestion)");
    expect(source).toContain("if (quiz.questions.length !== 50)");
    expect(schema).toContain(
      'uniqueIndex("assessment_submissions_owner_key_unique")'
    );
    expect(source).not.toContain("openId: input.openId");
  });

  it("binds client keys to their actual quiz and assessment targets and finalizes atomically", () => {
    expect(source).toContain("existing.sourceQuizId !== input.quizId");
    expect(source).toContain("existing.sessionId !== input.sessionId");
    expect(source).toMatch(/await db\.transaction\(async\s*\(?tx\)?\s*=>/);
    expect(source).toContain('eq(assessmentSessions.status, "submitted")');
    expect(source).toContain(
      "Assessment session finalization was not confirmed."
    );
  });

  it("maps only server-finalized integer scores to the directive's grade and performance semantics", () => {
    expect(assessmentGradeForScore(90)).toEqual({
      grade: "A+ / A",
      performance: "Excellent — mastery demonstrated",
    });
    expect(assessmentGradeForScore(80)).toEqual({
      grade: "A- / B+",
      performance: "Very good — strong understanding",
    });
    expect(assessmentGradeForScore(70)).toEqual({
      grade: "B / C+",
      performance: "Good — solid understanding with minor gaps",
    });
    expect(assessmentGradeForScore(60)).toEqual({
      grade: "C / D",
      performance: "Satisfactory — some important gaps",
    });
    expect(assessmentGradeForScore(50)).toEqual({
      grade: "D / E",
      performance: "Weak pass — needs review",
    });
    expect(assessmentGradeForScore(40).performance).toBe(
      "Poor — major improvement needed"
    );
    expect(assessmentGradeForScore(30).performance).toBe(
      "Very poor — serious gaps"
    );
    expect(assessmentGradeForScore(20).performance).toBe(
      "Critical — foundational support needed"
    );
    expect(assessmentGradeForScore(10).performance).toBe(
      "Very critical — topic not understood"
    );
    expect(assessmentGradeForScore(0).performance).toBe(
      "No meaningful understanding shown"
    );
    expect(() => assessmentGradeForScore(70.5)).toThrow(RangeError);
    expect(() => assessmentGradeForScore(101)).toThrow(RangeError);
  });
});
