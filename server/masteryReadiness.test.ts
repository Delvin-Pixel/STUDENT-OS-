import { describe, expect, it } from "vitest";
import {
  AcademicContextSchema,
  type AcademicContext,
} from "../shared/academicContext";
import {
  AcademicPolicyBundleSchema,
  type AcademicPolicyBundle,
} from "../shared/academicGovernance";
import {
  AssessmentEvidenceReviewSchema,
  type AssessmentEvidenceReview,
} from "../shared/assessmentEvidenceReview";
import { MasteryReadinessSchema } from "../shared/masteryReadiness";
import {
  compareMasteryReadiness,
  evaluateMasteryReadiness,
  type MasteryReadinessFacts,
} from "./masteryReadiness";

const NOW = "2026-10-25T12:00:00Z";

function context(
  educationLevel: AcademicContext["educationLevel"] = "SHS"
): AcademicContext {
  return AcademicContextSchema.parse({
    id: "context-2026",
    learnerId: "learner-1",
    countryCode: "GH",
    educationLevel,
    enrollmentMode: "private_candidate",
    curriculumId: "curr-1",
    curriculumVersion: "2026",
    policyBundleId: "policy-1",
    status: "active",
    ...(educationLevel === "TERTIARY" ? { programId: "bsc-it" } : {}),
  });
}

function policy(
  educationLevel: AcademicContext["educationLevel"] = "SHS"
): AcademicPolicyBundle {
  return AcademicPolicyBundleSchema.parse({
    id: "policy-1",
    version: "1.0.0",
    countryCode: "GH",
    educationLevel,
    curriculumId: "curr-1",
    curriculumVersion: "2026",
    status: "published",
    authorityId: "unattested-publisher",
    sourceReferences: ["https://example.org/not-official"],
    approvedBy: "claimed-reviewer",
    approvedAt: "2026-10-20T10:00:00Z",
    publishedAt: "2026-10-21T10:00:00Z",
  });
}

function review(
  assessmentSessionId: number,
  score = 95
): AssessmentEvidenceReview {
  return AssessmentEvidenceReviewSchema.parse({
    schemaVersion: 1,
    assessmentSessionId,
    sourceQuizId: "learner-quiz",
    topicId: "algebra",
    disposition: "limited_advisory",
    snapshotIntegrity: "intact",
    assessmentOrigin: "learner_workspace_quiz",
    academicContextId: null,
    policyBundleId: null,
    independence: "unknown",
    sourceApproval: "unverified",
    authoritativeMasteryEligible: false,
    score,
    finalizedAt: "2026-10-23T10:00:00Z",
    reasonCodes: [
      "academic_context_not_bound",
      "source_not_academically_reviewed",
      "independence_unverified",
    ],
  });
}

function facts(
  educationLevel: AcademicContext["educationLevel"] = "SHS"
): MasteryReadinessFacts {
  return {
    requestingOpenId: "owner-1",
    contextOwnerOpenId: "owner-1",
    context: context(educationLevel),
    policy: policy(educationLevel),
    outcomeId: "algebra",
    assessments: [review(1)],
    evaluatedAt: NOW,
  };
}

describe("B62.4 fail-closed mastery readiness", () => {
  it.each(["JHS", "SHS", "TERTIARY"] as const)(
    "supports Ghana %s without attributing authority to claimed policy metadata",
    level => {
      const input = facts(level);
      const unchanged = JSON.stringify(input);
      const result = evaluateMasteryReadiness(input);
      expect(result).toMatchObject({
        academicContextId: "context-2026",
        educationLevel: level,
        curriculumId: "curr-1",
        curriculumVersion: "2026",
        outcomeId: "algebra",
        state: "estimated",
        assessmentSessionIds: [1],
        scoreEstimate: 95,
        verifiedMastery: false,
        policyAuthority: "unattested",
      });
      expect(result.reasonCodes).toContain("policy_authority_unattested");
      expect(result.reasonCodes).toContain("independence_unverified");
      expect(result.reasonCodes).toContain("assessment_source_unreviewed");
      expect(result.reasonCodes).toContain(
        "academic_context_not_bound_to_assessment"
      );
      expect(JSON.stringify(input)).toBe(unchanged);
      expect(MasteryReadinessSchema.safeParse(result).success).toBe(true);
    }
  );

  it("treats 100% server-scored learner-generated quizzes as estimated, never verified", () => {
    const input = facts();
    input.assessments = [review(1, 100), review(2, 100)];
    const result = evaluateMasteryReadiness(input);
    expect(result.scoreEstimate).toBe(100);
    expect(result.state).toBe("estimated");
    expect(result.verifiedMastery).toBe(false);
    expect(result.reasonCodes).toContain("independence_unverified");
  });

  it("requires assessment evidence for any estimate", () => {
    const input = facts();
    input.assessments = [];
    const result = evaluateMasteryReadiness(input);
    expect(result.state).toBe("insufficient_evidence");
    expect(result.scoreEstimate).toBeNull();
    expect(result.assessmentSessionIds).toEqual([]);
    expect(result.reasonCodes).toContain("no_assessment_evidence");
  });

  it("holds account mismatches and suppresses references and scores", () => {
    const input = facts();
    input.requestingOpenId = "different-owner";
    const result = evaluateMasteryReadiness(input);
    expect(result.state).toBe("needs_review");
    expect(result.scoreEstimate).toBeNull();
    expect(result.assessmentSessionIds).toEqual([]);
    expect(result.reasonCodes).toContain("account_scope_mismatch");
    expect(JSON.stringify(result)).not.toContain("different-owner");
  });

  it.each(["historical", "pending_review"] as const)(
    "does not apply active mastery to a %s academic context",
    status => {
      const input = facts();
      input.context = { ...input.context, status };
      const result = evaluateMasteryReadiness(input);
      expect(result.state).toBe("needs_review");
      expect(result.scoreEstimate).toBeNull();
      expect(result.reasonCodes).toContain("context_inactive");
    }
  );

  it("treats missing, withdrawn, and cross-level policies as a review gate", () => {
    const missing = facts();
    missing.policy = null;
    expect(evaluateMasteryReadiness(missing).reasonCodes).toContain(
      "policy_missing"
    );

    const withdrawn = facts();
    withdrawn.policy = { ...policy(), status: "withdrawn" };
    const result = evaluateMasteryReadiness(withdrawn);
    expect(result.state).toBe("needs_review");
    expect(result.reasonCodes).toContain("policy_scope_mismatch");

    const wrongLevel = facts();
    wrongLevel.policy = policy("JHS");
    expect(evaluateMasteryReadiness(wrongLevel).scoreEstimate).toBeNull();

    const wrongVersion = facts();
    wrongVersion.policy = { ...policy(), curriculumVersion: "2027" };
    expect(evaluateMasteryReadiness(wrongVersion).state).toBe("needs_review");
  });

  it("does not mix evidence from distinct academic outcomes", () => {
    const input = facts();
    input.assessments = [
      review(1),
      { ...review(2), topicId: "different-topic" },
    ];
    const result = evaluateMasteryReadiness(input);
    expect(result.state).toBe("needs_review");
    expect(result.scoreEstimate).toBeNull();
    expect(result.reasonCodes).toContain("mixed_topic_evidence");
  });

  it("holds duplicate session replay even when the scores match", () => {
    const input = facts();
    input.assessments = [review(1), review(1)];
    const result = evaluateMasteryReadiness(input);
    expect(result.state).toBe("needs_review");
    expect(result.scoreEstimate).toBeNull();
    expect(result.assessmentSessionIds).toEqual([1]);
    expect(result.reasonCodes).toContain("duplicate_assessment_session");
  });

  it("holds compromised assessment integrity instead of averaging a high score", () => {
    const input = facts();
    input.assessments = [
      review(1),
      {
        ...review(2),
        disposition: "held_integrity",
        snapshotIntegrity: "held",
        score: null,
        finalizedAt: null,
        reasonCodes: ["question_snapshot_mismatch"],
      },
    ];
    const result = evaluateMasteryReadiness(input);
    expect(result.state).toBe("needs_review");
    expect(result.scoreEstimate).toBeNull();
    expect(result.reasonCodes).toContain("integrity_review_required");
  });

  it("holds pending and future-dated assessment records", () => {
    const input = facts();
    input.assessments = [
      {
        ...review(1),
        disposition: "pending_submission",
        snapshotIntegrity: "not_finalized",
        score: null,
        finalizedAt: null,
        reasonCodes: ["assessment_not_submitted"],
      },
    ];
    expect(evaluateMasteryReadiness(input).reasonCodes).toContain(
      "assessment_not_finalized"
    );

    const future = facts();
    future.assessments = [
      { ...review(1), finalizedAt: "2026-10-26T10:00:00Z" },
    ];
    const result = evaluateMasteryReadiness(future);
    expect(result.state).toBe("needs_review");
    expect(result.reasonCodes).toContain("future_assessment_timestamp");
  });

  it("is deterministic regardless of the input evidence order", () => {
    const first = facts();
    first.assessments = [review(22, 70), review(7, 90), review(3, 60)];
    const second = facts();
    second.assessments = [...first.assessments].reverse();
    const a = evaluateMasteryReadiness(first);
    const b = evaluateMasteryReadiness(second);
    expect(a).toEqual(b);
    expect(a.assessmentSessionIds).toEqual([3, 7, 22]);
    expect(a.scoreEstimate).toBe(73);
  });

  it("rejects unknown authority claims, forged verified output, and oversized evidence batches", () => {
    const result = evaluateMasteryReadiness(facts());
    expect(
      MasteryReadinessSchema.safeParse({
        ...result,
        verifiedMastery: true,
      }).success
    ).toBe(false);
    expect(
      MasteryReadinessSchema.safeParse({
        ...result,
        state: "verified",
      }).success
    ).toBe(false);
    expect(
      MasteryReadinessSchema.safeParse({
        ...result,
        sourceApproval: "official",
      }).success
    ).toBe(false);
    const oversized = facts();
    oversized.assessments = Array.from({ length: 65 }, (_, index) =>
      review(index + 1)
    );
    expect(() => evaluateMasteryReadiness(oversized)).toThrow(RangeError);
  });

  it("keeps reassessment unchanged for identical snapshots, including no fabricated authority", () => {
    const result = evaluateMasteryReadiness(facts());
    expect(compareMasteryReadiness(result, result)).toEqual({
      kind: "unchanged",
      previousState: "estimated",
      currentState: "estimated",
      currentVerifiedMastery: false,
    });
  });

  it("reassesses additional or retracted evidence without carrying over stale scores", () => {
    const before = evaluateMasteryReadiness(facts());
    const withNewEvidence = facts();
    withNewEvidence.assessments = [review(1, 95), review(2, 30)];
    const after = evaluateMasteryReadiness(withNewEvidence);
    expect(after.scoreEstimate).toBe(63);
    expect(compareMasteryReadiness(before, after).kind).toBe(
      "additional_evidence"
    );
    expect(compareMasteryReadiness(after, before).kind).toBe(
      "evidence_removed"
    );
    expect(after.verifiedMastery).toBe(false);
  });

  it("flags policy or context transitions instead of silently migrating mastery", () => {
    const before = evaluateMasteryReadiness(facts());
    const changed = facts();
    changed.context = {
      ...changed.context,
      curriculumVersion: "2027",
    };
    const after = evaluateMasteryReadiness(changed);
    expect(compareMasteryReadiness(before, after).kind).toBe(
      "context_changed_review_required"
    );
    expect(after.scoreEstimate).toBeNull();
  });

  it("records review-state regressions for unchanged evidence IDs", () => {
    const before = evaluateMasteryReadiness(facts());
    const changed = facts();
    changed.assessments = [
      {
        ...review(1),
        disposition: "held_integrity",
        snapshotIntegrity: "held",
        score: null,
        finalizedAt: null,
        reasonCodes: ["score_inconsistent"],
      },
    ];
    const after = evaluateMasteryReadiness(changed);
    expect(compareMasteryReadiness(before, after).kind).toBe(
      "review_state_changed"
    );
    expect(after.verifiedMastery).toBe(false);
  });
});
