import {
  AcademicContextSchema,
  type AcademicContext,
} from "../shared/academicContext";
import {
  AcademicPolicyBundleSchema,
  isCompatiblePolicy,
  type AcademicPolicyBundle,
} from "../shared/academicGovernance";
import {
  AssessmentEvidenceReviewSchema,
  type AssessmentEvidenceReview,
} from "../shared/assessmentEvidenceReview";
import {
  MasteryReadinessSchema,
  MasteryReassessmentComparisonSchema,
  type MasteryReadiness,
  type MasteryReassessmentComparison,
} from "../shared/masteryReadiness";

/**
 * Server-controlled facts only. No tRPC endpoint accepts these fields.
 * In a later phase, context ownership, curriculum policy, and evidence must be
 * read from independent, account-bound sources rather than a client payload.
 */
export type MasteryReadinessFacts = {
  requestingOpenId: string;
  contextOwnerOpenId: string;
  context: AcademicContext;
  policy: AcademicPolicyBundle | null;
  outcomeId: string;
  assessments: AssessmentEvidenceReview[];
  evaluatedAt: string;
};

type ReasonCode = MasteryReadiness["reasonCodes"][number];
const REQUIRED_GATES: ReasonCode[] = [
  "policy_authority_unattested",
  "independence_unverified",
  "assessment_source_unreviewed",
  "academic_context_not_bound_to_assessment",
];

/**
 * Deterministic planning classification only. Even a "published" policy in
 * this input is merely metadata: approved institutional authority requires a
 * separate trusted registry and audited authorization path.
 *
 * B62.3 score records are server-scored learner-workspace quizzes and cannot
 * supply independence, source authority, or verified mastery by themselves.
 * No state, evidence or database table is mutated.
 */
export function evaluateMasteryReadiness(
  facts: MasteryReadinessFacts
): MasteryReadiness {
  const context = AcademicContextSchema.parse(facts.context);
  const policy = facts.policy
    ? AcademicPolicyBundleSchema.parse(facts.policy)
    : null;
  const assessments = facts.assessments.map(assessment =>
    AssessmentEvidenceReviewSchema.parse(assessment)
  );
  if (assessments.length > 64)
    throw new RangeError("At most 64 assessment reviews may be considered.");
  if (!facts.outcomeId || facts.outcomeId.length > 160)
    throw new RangeError("A bounded canonical outcome ID is required.");
  const evaluatedAt = new Date(facts.evaluatedAt);
  if (
    !Number.isFinite(evaluatedAt.getTime()) ||
    !Number.isFinite(Date.parse(facts.evaluatedAt))
  )
    throw new RangeError("An explicit valid evaluation timestamp is required.");

  const reasons: ReasonCode[] = [...REQUIRED_GATES];
  const add = (reason: ReasonCode) => {
    if (!reasons.includes(reason)) reasons.push(reason);
  };

  const ownerMatches =
    facts.requestingOpenId.length > 0 &&
    facts.contextOwnerOpenId.length > 0 &&
    facts.requestingOpenId === facts.contextOwnerOpenId;
  if (!ownerMatches) add("account_scope_mismatch");
  if (context.status !== "active") add("context_inactive");
  if (!policy) add("policy_missing");
  else if (!isCompatiblePolicy(context, policy))
    add("policy_scope_mismatch");

  const seen = new Set<number>();
  let validSignals = 0;
  let scoreSum = 0;
  for (const assessment of assessments) {
    const id = assessment.assessmentSessionId;
    if (seen.has(id)) add("duplicate_assessment_session");
    seen.add(id);

    if (assessment.topicId !== facts.outcomeId)
      add("mixed_topic_evidence");
    if (
      assessment.disposition === "held_integrity" ||
      assessment.snapshotIntegrity === "held"
    )
      add("integrity_review_required");
    if (assessment.disposition === "pending_submission")
      add("assessment_not_finalized");

    if (
      assessment.finalizedAt !== null &&
      Date.parse(assessment.finalizedAt) > evaluatedAt.getTime()
    )
      add("future_assessment_timestamp");

    if (
      assessment.disposition === "limited_advisory" &&
      assessment.snapshotIntegrity === "intact" &&
      assessment.score !== null &&
      assessment.topicId === facts.outcomeId &&
      assessment.finalizedAt !== null &&
      Date.parse(assessment.finalizedAt) <= evaluatedAt.getTime()
    ) {
      validSignals++;
      scoreSum += assessment.score;
    }
  }

  if (validSignals === 0) add("no_assessment_evidence");
  if (validSignals === 1) add("single_assessment_only");

  // All conditions here relate only to advisory planning, not authorization.
  const blocking = [
    "account_scope_mismatch",
    "context_inactive",
    "policy_missing",
    "policy_scope_mismatch",
    "duplicate_assessment_session",
    "mixed_topic_evidence",
    "integrity_review_required",
    "assessment_not_finalized",
    "future_assessment_timestamp",
  ] as const;
  const requiresReview = blocking.some(reason => reasons.includes(reason));
  const state: MasteryReadiness["state"] = requiresReview
    ? "needs_review"
    : validSignals > 0
      ? "estimated"
      : "insufficient_evidence";

  return MasteryReadinessSchema.parse({
    schemaVersion: 1,
    engineVersion: "b62.4-review-v1",
    academicContextId: context.id,
    educationLevel: context.educationLevel,
    curriculumId: context.curriculumId,
    curriculumVersion: context.curriculumVersion,
    policyBundleId: context.policyBundleId,
    outcomeId: facts.outcomeId,
    state,
    assessmentSessionIds: ownerMatches
      ? [...seen].sort((a, b) => a - b)
      : [],
    scoreEstimate:
      state === "estimated" ? Math.round(scoreSum / validSignals) : null,
    evaluatedAt: facts.evaluatedAt,
    source: "learner_workspace_server_scored",
    policyAuthority: "unattested",
    verifiedMastery: false,
    reasonCodes: reasons,
  });
}

/**
 * Compare complete evidence snapshots rather than incrementally editing
 * previous mastery. Revocations and context transitions cannot be disguised as
 * progress. This produces only a planning comparison, not a durable verdict.
 */
export function compareMasteryReadiness(
  previous: MasteryReadiness,
  current: MasteryReadiness
): MasteryReassessmentComparison {
  const before = MasteryReadinessSchema.parse(previous);
  const after = MasteryReadinessSchema.parse(current);
  const scoped = [
    "academicContextId",
    "educationLevel",
    "curriculumId",
    "curriculumVersion",
    "policyBundleId",
    "outcomeId",
  ] as const;

  const beforeIds = new Set(before.assessmentSessionIds);
  const afterIds = new Set(after.assessmentSessionIds);
  const kind: MasteryReassessmentComparison["kind"] = scoped.some(
    key => before[key] !== after[key]
  )
    ? "context_changed_review_required"
    : [...beforeIds].some(id => !afterIds.has(id))
      ? "evidence_removed"
      : [...afterIds].some(id => !beforeIds.has(id))
        ? "additional_evidence"
        : before.state !== after.state ||
            before.scoreEstimate !== after.scoreEstimate ||
            before.reasonCodes.join("|") !== after.reasonCodes.join("|")
          ? "review_state_changed"
          : "unchanged";

  return MasteryReassessmentComparisonSchema.parse({
    kind,
    previousState: before.state,
    currentState: after.state,
    currentVerifiedMastery: false,
  });
}
