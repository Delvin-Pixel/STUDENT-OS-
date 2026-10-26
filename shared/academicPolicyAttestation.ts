import { z } from "zod";
import {
  AcademicContextSchema,
  EducationLevelSchema,
} from "./academicContext";
import { AcademicPolicyBundleSchema } from "./academicGovernance";

const digest = z.string().regex(/^[a-f0-9]{64}$/);
const identifier = z.string().min(1).max(160);
const isoTime = z.iso.datetime();

export const PolicyAttestationScopeSchema = z
  .object({
    countryCode: z.literal("GH"),
    educationLevel: EducationLevelSchema,
    curriculumId: identifier,
    curriculumVersion: z.string().min(1).max(64),
    institutionId: identifier.optional(),
    programId: identifier.optional(),
  })
  .strict()
  .superRefine((scope, ctx) => {
    if (scope.educationLevel === "TERTIARY" && !scope.programId)
      ctx.addIssue({
        code: "custom",
        path: ["programId"],
        message: "Tertiary attestations must identify a programme",
      });
    if (scope.educationLevel !== "TERTIARY" && scope.programId)
      ctx.addIssue({
        code: "custom",
        path: ["programId"],
        message: "Programme scope is reserved for tertiary curricula",
      });
  });
export type PolicyAttestationScope = z.infer<
  typeof PolicyAttestationScopeSchema
>;

/**
 * Versioned bytes are signed independently by the issuer and reviewer.
 * Only the server can supply externally verified trust roots and sources.
 * A valid signature alone DOES NOT make a curriculum officially approved.
 */
export const PolicyAttestationPayloadSchema = z
  .object({
    protocol: z.literal("student-os-academic-policy-attestation-v1"),
    documentId: z.uuid(),
    registryVersion: z.number().int().positive(),
    sourceManifestSha256: digest,
    scope: PolicyAttestationScopeSchema,
    policy: AcademicPolicyBundleSchema,
    issuedAt: isoTime,
  })
  .strict()
  .superRefine((payload, ctx) => {
    const { policy, scope } = payload;
    if (
      policy.status !== "published" ||
      policy.countryCode !== scope.countryCode ||
      policy.educationLevel !== scope.educationLevel ||
      policy.curriculumId !== scope.curriculumId ||
      policy.curriculumVersion !== scope.curriculumVersion
    )
      ctx.addIssue({
        code: "custom",
        message: "Published policy and signed curriculum scope must match",
      });
    if (
      !policy.approvedAt ||
      !policy.publishedAt ||
      Date.parse(policy.approvedAt) > Date.parse(policy.publishedAt) ||
      Date.parse(policy.publishedAt) > Date.parse(payload.issuedAt)
    )
      ctx.addIssue({
        code: "custom",
        message: "Approval, publication and signing chronology is invalid",
      });
  });
export type PolicyAttestationPayload = z.infer<
  typeof PolicyAttestationPayloadSchema
>;

export const PolicySignatureSchema = z
  .object({
    keyId: identifier,
    algorithm: z.literal("ed25519"),
    value: z.string().regex(/^[A-Za-z0-9_-]{86}$/),
  })
  .strict();

export const SignedAcademicPolicySchema = z
  .object({
    payload: PolicyAttestationPayloadSchema,
    issuerSignature: PolicySignatureSchema,
    reviewerSignature: PolicySignatureSchema,
  })
  .strict()
  .refine(data => data.issuerSignature.keyId !== data.reviewerSignature.keyId, {
    message: "Publication and review must use separate signing keys",
  });
export type SignedAcademicPolicy = z.infer<
  typeof SignedAcademicPolicySchema
>;

export const TrustedPolicySignerSchema = z
  .object({
    keyId: identifier,
    principalId: identifier,
    authorityId: identifier,
    role: z.enum(["publisher", "reviewer"]),
    publicKeyPem: z.string().min(50).max(4096),
    scope: PolicyAttestationScopeSchema,
    validFrom: isoTime,
    validUntil: isoTime,
    revokedAt: isoTime.optional(),
  })
  .strict();
export type TrustedPolicySigner = z.infer<
  typeof TrustedPolicySignerSchema
>;

export const TrustedPolicySourceSchema = z
  .object({
    manifestSha256: digest,
    scope: PolicyAttestationScopeSchema,
    reviewedAt: isoTime,
    status: z.enum(["reviewed", "withdrawn"]),
  })
  .strict();

export const PolicyRevocationSchema = z
  .object({
    authorityId: identifier,
    policyId: identifier,
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
    revokedAt: isoTime,
    reason: z.enum(["withdrawn", "superseded", "authority_revoked"]),
  })
  .strict();

export const PolicyTrustSnapshotSchema = z
  .object({
    version: z.number().int().positive(),
    observedAt: isoTime,
    signers: z.array(TrustedPolicySignerSchema).max(256),
    sources: z.array(TrustedPolicySourceSchema).max(512),
    revocations: z.array(PolicyRevocationSchema).max(512),
  })
  .strict()
  .superRefine((snapshot, ctx) => {
    if (new Set(snapshot.signers.map(signer => signer.keyId)).size !== snapshot.signers.length)
      ctx.addIssue({
        code: "custom",
        message: "Trust snapshot signing keys must have unique IDs",
      });
    if (new Set(snapshot.sources.map(source => source.manifestSha256)).size !== snapshot.sources.length)
      ctx.addIssue({
        code: "custom",
        message: "Source digests must not have ambiguous registry entries",
      });
    if (
      new Set(snapshot.revocations.map(item =>
        [item.authorityId, item.policyId, item.version].join("\u0000")
      )).size !== snapshot.revocations.length
    )
      ctx.addIssue({
        code: "custom",
        message: "Policy revocation identities must be unique",
      });
  });
export type PolicyTrustSnapshot = z.infer<typeof PolicyTrustSnapshotSchema>;

/** This is a review-only result, never a certificate or mastery authorization. */
export const AcademicPolicyVerificationSchema = z
  .object({
    schemaVersion: z.literal(1),
    status: z.enum(["integrity_passed_not_authorized", "held"]),
    reasonCodes: z.array(
      z.enum([
        "invalid_document",
        "invalid_trust_snapshot",
        "stale_or_future_trust_snapshot",
        "context_mismatch",
        "issuer_not_trusted",
        "reviewer_not_trusted",
        "signer_scope_mismatch",
        "signer_expired_or_revoked",
        "reviewer_not_independent",
        "signature_invalid",
        "source_unreviewed_or_withdrawn",
        "policy_revoked",
        "invalid_signing_time",
      ])
    ).max(16),
    officialApprovalEstablished: z.literal(false),
    authoritativeMasteryEligible: z.literal(false),
  })
  .strict()
  .superRefine((out, ctx) => {
    if (
      (out.status === "integrity_passed_not_authorized") !==
      (out.reasonCodes.length === 0)
    )
      ctx.addIssue({
        code: "custom",
        message: "Only a completely checked document may pass integrity review",
      });
  });
export type AcademicPolicyVerification = z.infer<
  typeof AcademicPolicyVerificationSchema
>;

/** Validate the input context without treating profile labels as authority. */
export const PolicyReviewContextSchema = AcademicContextSchema;
