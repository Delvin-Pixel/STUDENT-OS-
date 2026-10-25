import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { AssessmentEvidenceReviewSchema } from "../shared/assessmentEvidenceReview";
import { assessmentGradeForScore } from "./assessments";
import {
  evaluateAssessmentEvidenceReview,
  type AssessmentReviewFacts,
} from "./assessmentEvidenceReview";

function snapshotQuestions() {
  return Array.from({ length: 50 }, (_, ordinal) => ({
    ordinal,
    prompt: `Question ${ordinal + 1}?`,
    options: ["Correct", "Incorrect"],
    correctOptionIndex: 0,
    explanation: "Reviewed solution, not curriculum-approved",
  }));
}

function fixture(): AssessmentReviewFacts {
  const questions = snapshotQuestions();
  const responses = questions.map(({ ordinal }) => ({
    questionOrdinal: ordinal,
    selectedOptionIndex: ordinal < 40 ? 0 : 1,
  }));
  const questionSetHash = createHash("sha256")
    .update(JSON.stringify(questions))
    .digest("hex");
  const finalizedAt = new Date("2026-10-25T12:00:00Z");
  return {
    requestingOpenId: "account-a",
    session: {
      id: 42,
      openId: "account-a",
      sourceQuizId: "local-quiz",
      topicId: "physics-waves",
      status: "submitted",
      questionSetHash,
      questionCount: questions.length,
      submittedAt: finalizedAt,
      finalScore: 80,
      correctCount: 40,
    },
    submission: {
      sessionId: 42,
      openId: "account-a",
      score: 80,
      correctCount: 40,
      questionCount: questions.length,
      finalizedAt,
    },
    questions,
    responses,
  };
}

describe("B62.3 server-owned assessment evidence review", () => {
  it("accepts an intact stored snapshot ONLY as limited advisory assessment evidence", () => {
    const facts = fixture();
    const prior = JSON.stringify(facts);
    const result = evaluateAssessmentEvidenceReview(facts);
    expect(result).toMatchObject({
      schemaVersion: 1,
      assessmentSessionId: 42,
      sourceQuizId: "local-quiz",
      topicId: "physics-waves",
      disposition: "limited_advisory",
      snapshotIntegrity: "intact",
      assessmentOrigin: "learner_workspace_quiz",
      academicContextId: null,
      policyBundleId: null,
      independence: "unknown",
      sourceApproval: "unverified",
      authoritativeMasteryEligible: false,
      score: 80,
      finalizedAt: "2026-10-25T12:00:00.000Z",
      reasonCodes: [
        "academic_context_not_bound",
        "source_not_academically_reviewed",
        "independence_unverified",
      ],
    });
    expect(AssessmentEvidenceReviewSchema.safeParse(result).success).toBe(true);
    expect(JSON.stringify(facts)).toBe(prior);
    expect(JSON.stringify(result)).not.toContain("Correct");
    expect(JSON.stringify(result)).not.toContain("account-a");
    expect(JSON.stringify(result)).not.toContain("clientSubmitKey");
  });

  it("keeps an unsubmitted session pending without reporting a score", () => {
    const facts = fixture();
    facts.session.status = "in_progress";
    facts.session.submittedAt = null;
    facts.submission = null;
    const result = evaluateAssessmentEvidenceReview(facts);
    expect(result).toMatchObject({
      disposition: "pending_submission",
      snapshotIntegrity: "not_finalized",
      score: null,
      finalizedAt: null,
      reasonCodes: ["assessment_not_submitted"],
    });
    expect(result.authoritativeMasteryEligible).toBe(false);
  });

  it("holds a submitted session without its immutable finalization record", () => {
    const facts = fixture();
    facts.submission = null;
    const result = evaluateAssessmentEvidenceReview(facts);
    expect(result).toMatchObject({
      disposition: "held_integrity",
      score: null,
      authoritativeMasteryEligible: false,
    });
    expect(result.reasonCodes).toContain("missing_final_submission");
  });

  it.each([
    ["request owner", (facts: AssessmentReviewFacts) => {
      facts.requestingOpenId = "account-b";
    }],
    ["submission owner", (facts: AssessmentReviewFacts) => {
      if (facts.submission) facts.submission.openId = "account-b";
    }],
    ["session owner", (facts: AssessmentReviewFacts) => {
      facts.session.openId = "account-b";
    }],
  ] as const)("rejects mismatched %s", (_label, mutate) => {
    const facts = fixture();
    mutate(facts);
    const result = evaluateAssessmentEvidenceReview(facts);
    expect(result.disposition).toBe("held_integrity");
    expect(result.reasonCodes).toContain("owner_mismatch");
    expect(result.score).toBeNull();
  });

  it("detects changed question content under the immutable digest", () => {
    const facts = fixture();
    facts.questions[0].prompt = "Replaced by another question";
    const result = evaluateAssessmentEvidenceReview(facts);
    expect(result.disposition).toBe("held_integrity");
    expect(result.reasonCodes).toContain("question_snapshot_mismatch");
    expect(result.score).toBeNull();
  });

  it.each([
    ["missing question", (facts: AssessmentReviewFacts) => {
      facts.questions.pop();
    }],
    ["duplicate ordinal", (facts: AssessmentReviewFacts) => {
      facts.questions[2].ordinal = 1;
    }],
    ["missing options", (facts: AssessmentReviewFacts) => {
      facts.questions[0].options = [];
    }],
    ["incorrect count", (facts: AssessmentReviewFacts) => {
      facts.session.questionCount = 49;
    }],
  ] as const)("holds structurally invalid questions: %s", (_label, mutate) => {
    const facts = fixture();
    mutate(facts);
    const result = evaluateAssessmentEvidenceReview(facts);
    expect(result.disposition).toBe("held_integrity");
    expect(result.reasonCodes).toContain("question_set_invalid");
  });

  it.each([
    ["missing response", (facts: AssessmentReviewFacts) => {
      facts.responses.pop();
    }],
    ["duplicate response", (facts: AssessmentReviewFacts) => {
      facts.responses[1].questionOrdinal = 0;
    }],
    ["out-of-range option", (facts: AssessmentReviewFacts) => {
      facts.responses[2].selectedOptionIndex = 9;
    }],
  ] as const)("holds compromised response sets: %s", (_label, mutate) => {
    const facts = fixture();
    mutate(facts);
    const result = evaluateAssessmentEvidenceReview(facts);
    expect(result.disposition).toBe("held_integrity");
    expect(result.reasonCodes).toContain("response_set_invalid");
  });

  it("recomputes the score rather than trusting the stored summary alone", () => {
    const facts = fixture();
    facts.responses[0].selectedOptionIndex = 1;
    const result = evaluateAssessmentEvidenceReview(facts);
    expect(result.disposition).toBe("held_integrity");
    expect(result.reasonCodes).toContain("score_inconsistent");
  });

  it("holds forged persisted score and incorrect session/submission pairing", () => {
    const facts = fixture();
    if (!facts.submission) throw new Error("Fixture incomplete");
    facts.submission.score = 99;
    facts.submission.sessionId = 12;
    const result = evaluateAssessmentEvidenceReview(facts);
    expect(result.reasonCodes).toContain("missing_final_submission");
    expect(result.reasonCodes).toContain("score_inconsistent");
    expect(result.authoritativeMasteryEligible).toBe(false);
  });

  it("holds missing or inconsistent completion timestamps", () => {
    const facts = fixture();
    if (!facts.submission) throw new Error("Fixture incomplete");
    facts.submission.finalizedAt = new Date("2026-10-25T12:01:00Z");
    const result = evaluateAssessmentEvidenceReview(facts);
    expect(result.disposition).toBe("held_integrity");
    expect(result.reasonCodes).toContain("finalization_invalid");
  });

  it("does not describe a high quiz score as verified mastery", () => {
    expect(assessmentGradeForScore(100).performance).toContain(
      "not verified mastery"
    );
  });

  it("rejects injected authority claims at the shared response boundary", () => {
    const result = evaluateAssessmentEvidenceReview(fixture());
    expect(
      AssessmentEvidenceReviewSchema.safeParse({
        ...result,
        authoritativeMasteryEligible: true,
      }).success
    ).toBe(false);
    expect(
      AssessmentEvidenceReviewSchema.safeParse({
        ...result,
        policyBundleId: "invented-by-client",
      }).success
    ).toBe(false);
    expect(
      AssessmentEvidenceReviewSchema.safeParse({
        ...result,
        officialCurriculumVerified: true,
      }).success
    ).toBe(false);
    expect(
      AssessmentEvidenceReviewSchema.safeParse({
        ...result,
        disposition: "pending_submission",
      }).success
    ).toBe(false);
  });
});
