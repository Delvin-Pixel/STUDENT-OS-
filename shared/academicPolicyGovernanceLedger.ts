import { z } from "zod";
import { PolicyAttestationScopeSchema } from "./academicPolicyAttestation";

const digest = z.string().regex(/^[a-f0-9]{64}$/);
const identifier = z.string().min(1).max(160);
const isoTime = z.iso.datetime();

export const AcademicGovernanceEventTypeSchema = z.enum([
  "source_manifest_reviewed",
  "policy_attestation_recorded",
  "policy_published",
  "policy_suspended",
  "policy_revoked",
  "signer_registered",
  "signer_revoked",
  "signing_key_rotated",
]);
export type AcademicGovernanceEventType = z.infer<typeof AcademicGovernanceEventTypeSchema>;

export const AcademicGovernanceLedgerEventSchema = z.object({
  protocol: z.literal("student-os-academic-governance-ledger-v1"),
  eventId: z.uuid(),
  authorityId: identifier,
  sequence: z.number().int().positive(),
  eventType: AcademicGovernanceEventTypeSchema,
  subjectId: identifier,
  subjectVersion: z.string().min(1).max(64).optional(),
  scope: PolicyAttestationScopeSchema,
  sourceManifestSha256: digest.optional(),
  actorPrincipalId: identifier,
  reviewerPrincipalId: identifier,
  actorKeyId: identifier,
  reviewerKeyId: identifier,
  actorSignature: z.string().regex(/^[A-Za-z0-9_-]{86}$/),
  reviewerSignature: z.string().regex(/^[A-Za-z0-9_-]{86}$/),
  requestKey: z.string().min(16).max(128),
  occurredAt: isoTime,
  previousEventHash: digest,
  eventHash: digest,
}).strict().superRefine((event, ctx) => {
  if (event.actorPrincipalId === event.reviewerPrincipalId) {
    ctx.addIssue({ code: "custom", path: ["reviewerPrincipalId"], message: "Actor and reviewer must be distinct principals" });
  }
  if (event.actorKeyId === event.reviewerKeyId) {
    ctx.addIssue({ code: "custom", path: ["reviewerKeyId"], message: "Actor and reviewer must use distinct keys" });
  }
  if (event.eventType === "source_manifest_reviewed" && !event.sourceManifestSha256) {
    ctx.addIssue({ code: "custom", path: ["sourceManifestSha256"], message: "Source review events require a source manifest digest" });
  }
  if (["policy_published", "policy_suspended", "policy_revoked", "policy_attestation_recorded"].includes(event.eventType) && !event.subjectVersion) {
    ctx.addIssue({ code: "custom", path: ["subjectVersion"], message: "Policy governance events require an immutable policy version" });
  }
});
export type AcademicGovernanceLedgerEvent = z.infer<typeof AcademicGovernanceLedgerEventSchema>;

export const AcademicGovernanceLedgerHeadSchema = z.object({
  authorityId: identifier,
  sequence: z.number().int().nonnegative(),
  eventHash: digest,
}).strict();
export type AcademicGovernanceLedgerHead = z.infer<typeof AcademicGovernanceLedgerHeadSchema>;

export const GOVERNANCE_LEDGER_GENESIS_HASH = "0".repeat(64);

/** Checks byte-level event integrity and ordering only; it does not validate signer authority. */
export function verifyAcademicGovernanceLedger(
  input: unknown
): { valid: boolean; eventCount: number; reason: "valid" | "invalid_event" | "authority_mismatch" | "sequence_gap" | "previous_hash_mismatch" | "event_hash_mismatch" } {
  if (!Array.isArray(input)) return { valid: false, eventCount: 0, reason: "invalid_event" };
  let previousHash = GOVERNANCE_LEDGER_GENESIS_HASH;
  let authorityId: string | undefined;
  for (let i = 0; i < input.length; i += 1) {
    const parsed = AcademicGovernanceLedgerEventSchema.safeParse(input[i]);
    if (!parsed.success) return { valid: false, eventCount: i, reason: "invalid_event" };
    const event = parsed.data;
    if (authorityId === undefined) authorityId = event.authorityId;
    if (event.authorityId !== authorityId) return { valid: false, eventCount: i, reason: "authority_mismatch" };
    if (event.sequence !== i + 1) return { valid: false, eventCount: i, reason: "sequence_gap" };
    if (event.previousEventHash !== previousHash) return { valid: false, eventCount: i, reason: "previous_hash_mismatch" };
    const { eventHash, ...unsignedEvent } = event;
    if (governanceEventHash(unsignedEvent) !== eventHash) return { valid: false, eventCount: i, reason: "event_hash_mismatch" };
    previousHash = eventHash;
  }
  return { valid: true, eventCount: input.length, reason: "valid" };
}
