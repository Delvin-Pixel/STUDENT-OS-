import { z } from "zod";
import { EducationLevelSchema } from "./academicContext";

/**
 * B62.4 review-only format. Verified mastery is intentionally impossible to
 * represent until a separately trusted registry, approved rubric, and durable
 * owner-bound decision service exist.
 */
const reason = z.enum([
  "no_assessment_evidence",
  "context_inactive",
  "account_scope_mismatch",
  "policy_missing",
  "policy_scope_mismatch",
  "policy_authority_unattested",
  "independence_unverified",
  "assessment_source_unreviewed",
  "academic_context_not_bound_to_assessment",
  "mixed_topic_evidence",
  "duplicate_assessment_session",
  "integrity_review_required",
  "assessment_not_finalized",
  "future_assessment_timestamp",
  "single_assessment_only",
]);

export const MasteryReadinessSchema = z
  .object({
    schemaVersion: z.literal(1),
    engineVersion: z.literal("b62.4-review-v1"),
    academicContextId: z.string().min(1).max(160),
    educationLevel: EducationLevelSchema,
    curriculumId: z.string().min(1).max(160),
    curriculumVersion: z.string().min(1).max(64),
    policyBundleId: z.string().min(1).max(160),
    outcomeId: z.string().min(1).max(160),
    state: z.enum(["insufficient_evidence", "estimated", "needs_review"]),
    assessmentSessionIds: z.array(z.number().int().positive()).max(64),
    scoreEstimate: z.number().int().min(0).max(100).nullable(),
    evaluatedAt: z.iso.datetime(),
    source: z.literal("learner_workspace_server_scored"),
    policyAuthority: z.literal("unattested"),
    verifiedMastery: z.literal(false),
    reasonCodes: z.array(reason).min(1).max(15),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      new Set(value.assessmentSessionIds).size !==
      value.assessmentSessionIds.length
    )
      ctx.addIssue({
        code: "custom",
        message: "Assessment session references must be unique",
      });
    if (new Set(value.reasonCodes).size !== value.reasonCodes.length)
      ctx.addIssue({
        code: "custom",
        message: "Reason codes must be unique",
      });
    if (
      value.state === "estimated" &&
      (value.scoreEstimate === null || value.assessmentSessionIds.length === 0)
    )
      ctx.addIssue({
        code: "custom",
        message: "An estimate needs at least one complete assessment signal",
      });
    if (value.state !== "estimated" && value.scoreEstimate !== null)
      ctx.addIssue({
        code: "custom",
        message: "Unresolved evidence cannot expose an estimated score",
      });
    if (
      !value.reasonCodes.includes("policy_authority_unattested") ||
      !value.reasonCodes.includes("independence_unverified") ||
      !value.reasonCodes.includes("assessment_source_unreviewed") ||
      !value.reasonCodes.includes("academic_context_not_bound_to_assessment")
    )
      ctx.addIssue({
        code: "custom",
        message:
          "The B62.4 contract must disclose every unresolved authority gate",
      });
  });

export type MasteryReadiness = z.infer<typeof MasteryReadinessSchema>;

export const MasteryReassessmentComparisonSchema = z
  .object({
    kind: z.enum([
      "unchanged",
      "additional_evidence",
      "evidence_removed",
      "review_state_changed",
      "context_changed_review_required",
    ]),
    previousState: MasteryReadinessSchema.shape.state,
    currentState: MasteryReadinessSchema.shape.state,
    currentVerifiedMastery: z.literal(false),
  })
  .strict();
export type MasteryReassessmentComparison = z.infer<
  typeof MasteryReassessmentComparisonSchema
>;
