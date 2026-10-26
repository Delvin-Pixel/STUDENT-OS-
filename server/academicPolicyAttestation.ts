import {
  createPublicKey,
  verify as verifySignature,
  type KeyObject,
} from "node:crypto";
import {
  AcademicPolicyVerificationSchema,
  PolicyAttestationPayloadSchema,
  PolicyReviewContextSchema,
  PolicyTrustSnapshotSchema,
  SignedAcademicPolicySchema,
  type AcademicPolicyVerification,
  type PolicyAttestationPayload,
  type PolicyAttestationScope,
  type SignedAcademicPolicy,
  type TrustedPolicySigner,
} from "../shared/academicPolicyAttestation";
import type { AcademicContext } from "../shared/academicContext";

type Reason = AcademicPolicyVerification["reasonCodes"][number];
const MAX_TRUST_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Protocol v1: use only the strict Zod-normalized payload's defined field
 * ordering. Do not sign arbitrary user JSON, mutable transport metadata or
 * the detached signatures themselves. All signers must agree on these bytes.
 */
export function canonicalAcademicPolicyBytes(
  payload: PolicyAttestationPayload
): Buffer {
  const normalized = PolicyAttestationPayloadSchema.parse(payload);
  return Buffer.from(
    "student-os/academic-policy/v1\n" + JSON.stringify(normalized),
    "utf8"
  );
}

function scopeMatches(
  left: PolicyAttestationScope,
  right: PolicyAttestationScope
): boolean {
  return (
    left.countryCode === right.countryCode &&
    left.educationLevel === right.educationLevel &&
    left.curriculumId === right.curriculumId &&
    left.curriculumVersion === right.curriculumVersion &&
    left.institutionId === right.institutionId &&
    left.programId === right.programId
  );
}

function coversContext(
  scope: PolicyAttestationScope,
  context: AcademicContext,
  policyId: string
): boolean {
  return (
    context.status === "active" &&
    context.policyBundleId === policyId &&
    context.countryCode === scope.countryCode &&
    context.educationLevel === scope.educationLevel &&
    context.curriculumId === scope.curriculumId &&
    context.curriculumVersion === scope.curriculumVersion &&
    (scope.institutionId === undefined ||
      scope.institutionId === context.institutionId) &&
    (context.educationLevel !== "TERTIARY" ||
      scope.programId === context.programId)
  );
}

function signatureMatches(
  key: TrustedPolicySigner,
  encoded: string,
  bytes: Buffer
): boolean {
  try {
    const decoded = Buffer.from(encoded, "base64url");
    if (decoded.length !== 64 || decoded.toString("base64url") !== encoded)
      return false;
    const imported: KeyObject = createPublicKey(key.publicKeyPem);
    if (imported.asymmetricKeyType !== "ed25519") return false;
    return verifySignature(null, bytes, imported, decoded);
  } catch {
    return false;
  }
}

function activeSigner(
  signer: TrustedPolicySigner,
  issuedAt: number,
  asOf: number
): boolean {
  return (
    Date.parse(signer.validFrom) <= issuedAt &&
    issuedAt <= Date.parse(signer.validUntil) &&
    asOf <= Date.parse(signer.validUntil) &&
    (signer.revokedAt === undefined || Date.parse(signer.revokedAt) > asOf)
  );
}

/**
 * Read-only, fail-closed preflight. The calling code MUST load a verified
 * server-owned trust snapshot; never accept a trust snapshot, authenticated
 * academic context or public keys supplied by a browser/NEXA.
 *
 * Because no independently approved production trust roots have been
 * installed, even valid synthetic signatures can yield only an integrity
 * preflight, NOT official approval, mastery or a published policy.
 */
export function reviewAcademicPolicyAttestation(
  document: unknown,
  trustSnapshot: unknown,
  academicContext: unknown,
  asOf: string
): AcademicPolicyVerification {
  const reasons: Reason[] = [];
  const add = (reason: Reason) => {
    if (!reasons.includes(reason)) reasons.push(reason);
  };
  const result = (): AcademicPolicyVerification =>
    AcademicPolicyVerificationSchema.parse({
      schemaVersion: 1,
      status: reasons.length === 0 ? "integrity_passed_not_authorized" : "held",
      reasonCodes: reasons,
      officialApprovalEstablished: false,
      authoritativeMasteryEligible: false,
    });

  const parsedDocument = SignedAcademicPolicySchema.safeParse(document);
  if (!parsedDocument.success) {
    add("invalid_document");
    return result();
  }
  const parsedSnapshot = PolicyTrustSnapshotSchema.safeParse(trustSnapshot);
  if (!parsedSnapshot.success) {
    add("invalid_trust_snapshot");
    return result();
  }
  const parsedContext = PolicyReviewContextSchema.safeParse(academicContext);
  if (!parsedContext.success) {
    add("context_mismatch");
    return result();
  }

  const envelope: SignedAcademicPolicy = parsedDocument.data;
  const snapshot = parsedSnapshot.data;
  const context = parsedContext.data;
  const { payload, issuerSignature, reviewerSignature } = envelope;
  const time = Date.parse(asOf);
  const observedAt = Date.parse(snapshot.observedAt);
  const issuedAt = Date.parse(payload.issuedAt);
  const approvedAt = Date.parse(payload.policy.approvedAt!);

  if (!Number.isFinite(time) || time < issuedAt || issuedAt < approvedAt)
    add("invalid_signing_time");
  if (
    !Number.isFinite(time) ||
    snapshot.version !== payload.registryVersion ||
    observedAt > time ||
    observedAt < issuedAt ||
    time - observedAt > MAX_TRUST_AGE_MS
  )
    add("stale_or_future_trust_snapshot");

  if (!coversContext(payload.scope, context, payload.policy.id))
    add("context_mismatch");

  const publisher = snapshot.signers.find(
    signer => signer.keyId === issuerSignature.keyId
  );
  const reviewer = snapshot.signers.find(
    signer => signer.keyId === reviewerSignature.keyId
  );

  if (
    !publisher ||
    publisher.role !== "publisher" ||
    publisher.authorityId !== payload.policy.authorityId
  )
    add("issuer_not_trusted");
  if (
    !reviewer ||
    reviewer.role !== "reviewer" ||
    reviewer.principalId !== payload.policy.approvedBy ||
    reviewer.authorityId !== payload.policy.authorityId
  )
    add("reviewer_not_trusted");

  if (
    (publisher && !scopeMatches(publisher.scope, payload.scope)) ||
    (reviewer && !scopeMatches(reviewer.scope, payload.scope))
  )
    add("signer_scope_mismatch");

  if (
    (publisher &&
      Number.isFinite(time) &&
      !activeSigner(publisher, issuedAt, time)) ||
    (reviewer &&
      Number.isFinite(time) &&
      !activeSigner(reviewer, issuedAt, time))
  )
    add("signer_expired_or_revoked");

  if (
    publisher &&
    reviewer &&
    (publisher.principalId === reviewer.principalId ||
      publisher.keyId === reviewer.keyId)
  )
    add("reviewer_not_independent");

  const manifest = snapshot.sources.find(
    source => source.manifestSha256 === payload.sourceManifestSha256
  );
  if (
    !manifest ||
    manifest.status !== "reviewed" ||
    !scopeMatches(manifest.scope, payload.scope) ||
    Date.parse(manifest.reviewedAt) > issuedAt
  )
    add("source_unreviewed_or_withdrawn");

  if (
    Number.isFinite(time) &&
    snapshot.revocations.some(
      item =>
        item.authorityId === payload.policy.authorityId &&
        item.policyId === payload.policy.id &&
        item.version === payload.policy.version &&
        Date.parse(item.revokedAt) <= time
    )
  )
    add("policy_revoked");

  const bytes = canonicalAcademicPolicyBytes(payload);
  if (
    !publisher ||
    !reviewer ||
    !signatureMatches(publisher, issuerSignature.value, bytes) ||
    !signatureMatches(reviewer, reviewerSignature.value, bytes)
  )
    add("signature_invalid");

  return result();
}
