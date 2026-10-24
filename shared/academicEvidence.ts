import { z } from "zod";

export const EvidenceDecisionSchema = z
  .object({
    id: z.string().min(1),
    academicContextId: z.string().min(1),
    evidenceId: z.string().min(1),
    policyBundleId: z.string().min(1),
    status: z.enum([
      "pending",
      "accepted",
      "limited",
      "held",
      "rejected",
      "superseded",
    ]),
    independence: z.enum(["verified", "assisted", "unknown"]),
    sourceVerified: z.boolean(),
    reviewerId: z.string().min(1).optional(),
    reasonCodes: z.array(z.string().min(1)).min(1),
    recordedAt: z.iso.datetime(),
  })
  .strict();

export type EvidenceDecision = z.infer<typeof EvidenceDecisionSchema>;

export const MasteryDecisionSchema = z
  .object({
    id: z.string().min(1),
    academicContextId: z.string().min(1),
    outcomeId: z.string().min(1),
    policyBundleId: z.string().min(1),
    state: z.enum([
      "insufficient_evidence",
      "estimated",
      "verified",
      "needs_review",
    ]),
    evidenceDecisionIds: z.array(z.string().min(1)),
    engineVersion: z.string().min(1),
    decidedAt: z.iso.datetime(),
  })
  .strict()
  .superRefine((decision, ctx) => {
    if (
      decision.state === "verified" &&
      decision.evidenceDecisionIds.length === 0
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Verified mastery requires evidence decision references",
      });
    }
  });

export type MasteryDecision = z.infer<typeof MasteryDecisionSchema>;

/**
 * Advisory eligibility filter only. A true result does not authorize mastery:
 * trusted server lineage, active policy, approvals and account ownership must
 * be verified by the authoritative B62 service before publication.
 */
export function canUseEvidenceForVerifiedMastery(
  decision: EvidenceDecision
): boolean {
  return (
    decision.status === "accepted" &&
    decision.independence === "verified" &&
    decision.sourceVerified
  );
}
