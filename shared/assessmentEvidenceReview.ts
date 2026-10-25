import { z } from "zod";

/**
 * A server-owned assessment submission is not independent, officially sourced,
 * or academically approved merely because it was scored on the server.
 *
 * This read-only response deliberately cannot represent verified mastery.
 */
export const AssessmentEvidenceReviewSchema = z
  .object({
    schemaVersion: z.literal(1),
    assessmentSessionId: z.number().int().positive(),
    sourceQuizId: z.string().min(1).max(160),
    topicId: z.string().min(1).max(160).nullable(),
    disposition: z.enum([
      "pending_submission",
      "held_integrity",
      "limited_advisory",
    ]),
    snapshotIntegrity: z.enum(["not_finalized", "held", "intact"]),
    assessmentOrigin: z.literal("learner_workspace_quiz"),
    academicContextId: z.null(),
    policyBundleId: z.null(),
    independence: z.literal("unknown"),
    sourceApproval: z.literal("unverified"),
    authoritativeMasteryEligible: z.literal(false),
    score: z.number().int().min(0).max(100).nullable(),
    finalizedAt: z.iso.datetime().nullable(),
    reasonCodes: z
      .array(
        z.enum([
          "assessment_not_submitted",
          "missing_final_submission",
          "owner_mismatch",
          "question_snapshot_mismatch",
          "question_set_invalid",
          "response_set_invalid",
          "score_inconsistent",
          "finalization_invalid",
          "academic_context_not_bound",
          "source_not_academically_reviewed",
          "independence_unverified",
        ])
      )
      .min(1)
      .max(12),
  })
  .strict()
  .superRefine((review, ctx) => {
    if (
      review.disposition === "limited_advisory" &&
      (review.snapshotIntegrity !== "intact" ||
        review.score === null ||
        review.finalizedAt === null)
    ) {
      ctx.addIssue({
        code: "custom",
        message: "An advisory result requires an intact finalized submission",
      });
    }
    if (
      review.disposition !== "limited_advisory" &&
      (review.score !== null || review.finalizedAt !== null)
    ) {
      ctx.addIssue({
        code: "custom",
        message:
          "Non-final or integrity-held evidence cannot expose an assessment signal",
      });
    }
    if (
      review.disposition === "pending_submission" &&
      review.snapshotIntegrity !== "not_finalized"
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Pending evidence cannot claim a verified snapshot",
      });
    }
    if (
      review.disposition === "held_integrity" &&
      review.snapshotIntegrity !== "held"
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Integrity-held evidence must report the hold",
      });
    }
  });

export type AssessmentEvidenceReview = z.infer<
  typeof AssessmentEvidenceReviewSchema
>;
