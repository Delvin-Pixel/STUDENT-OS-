import { generateKeyPairSync, sign, type KeyObject } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  AcademicPolicyVerificationSchema,
  PolicyAttestationPayloadSchema,
  PolicyTrustSnapshotSchema,
  SignedAcademicPolicySchema,
  type PolicyAttestationPayload,
  type PolicyAttestationScope,
  type PolicyTrustSnapshot,
  type SignedAcademicPolicy,
} from "../shared/academicPolicyAttestation";
import { AcademicContextSchema } from "../shared/academicContext";
import {
  canonicalAcademicPolicyBytes,
  reviewAcademicPolicyAttestation,
} from "./academicPolicyAttestation";

const issuedAt = "2026-10-24T10:00:00.000Z";
const now = "2026-10-24T12:00:00.000Z";
const keys = {
  publisher: generateKeyPairSync("ed25519"),
  reviewer: generateKeyPairSync("ed25519"),
  outsider: generateKeyPairSync("ed25519"),
};

function signPayload(payload: PolicyAttestationPayload, key: KeyObject) {
  return sign(null, canonicalAcademicPolicyBytes(payload), key).toString(
    "base64url"
  );
}

function fixture(level: "JHS" | "SHS" | "TERTIARY" = "SHS") {
  const scope: PolicyAttestationScope = {
    countryCode: "GH",
    educationLevel: level,
    curriculumId: "curriculum-science",
    curriculumVersion: "2026",
    ...(level === "TERTIARY" ? { programId: "bsc-it" } : {}),
  };
  const payload = PolicyAttestationPayloadSchema.parse({
    protocol: "student-os-academic-policy-attestation-v1",
    documentId: "1f2c5848-a401-4330-b9f7-912065bf3f54",
    registryVersion: 1,
    sourceManifestSha256: "a".repeat(64),
    scope,
    policy: {
      id: "policy-science",
      version: "1.0.0",
      countryCode: "GH",
      educationLevel: level,
      curriculumId: "curriculum-science",
      curriculumVersion: "2026",
      status: "published",
      authorityId: "fixture-authority",
      sourceReferences: ["https://example.org/unverified-curriculum"],
      approvedBy: "independent-reviewer",
      approvedAt: "2026-10-21T10:00:00.000Z",
      publishedAt: "2026-10-22T10:00:00.000Z",
    },
    issuedAt,
  });
  const document: SignedAcademicPolicy = SignedAcademicPolicySchema.parse({
    payload,
    issuerSignature: {
      keyId: "fixture-publisher",
      algorithm: "ed25519",
      value: signPayload(payload, keys.publisher.privateKey),
    },
    reviewerSignature: {
      keyId: "fixture-reviewer",
      algorithm: "ed25519",
      value: signPayload(payload, keys.reviewer.privateKey),
    },
  });
  const trust: PolicyTrustSnapshot = PolicyTrustSnapshotSchema.parse({
    version: 1,
    observedAt: "2026-10-24T11:00:00.000Z",
    signers: [
      {
        keyId: "fixture-publisher",
        principalId: "publisher-principal",
        authorityId: "fixture-authority",
        role: "publisher",
        publicKeyPem: keys.publisher.publicKey.export({
          type: "spki",
          format: "pem",
        }),
        scope,
        validFrom: "2026-10-01T00:00:00.000Z",
        validUntil: "2026-12-31T00:00:00.000Z",
      },
      {
        keyId: "fixture-reviewer",
        principalId: "independent-reviewer",
        authorityId: "fixture-authority",
        role: "reviewer",
        publicKeyPem: keys.reviewer.publicKey.export({
          type: "spki",
          format: "pem",
        }),
        scope,
        validFrom: "2026-10-01T00:00:00.000Z",
        validUntil: "2026-12-31T00:00:00.000Z",
      },
    ],
    sources: [
      {
        manifestSha256: "a".repeat(64),
        scope,
        reviewedAt: "2026-10-22T12:00:00.000Z",
        status: "reviewed",
      },
    ],
    revocations: [],
  });
  const context = AcademicContextSchema.parse({
    id: "candidate-context",
    learnerId: "fixture-learner",
    countryCode: "GH",
    educationLevel: level,
    enrollmentMode: "private_candidate",
    curriculumId: "curriculum-science",
    curriculumVersion: "2026",
    policyBundleId: "policy-science",
    status: "active",
    ...(level === "TERTIARY" ? { programId: "bsc-it" } : {}),
  });
  return { document, trust, context };
}

function signedAgain(
  document: SignedAcademicPolicy,
  issuerKey = keys.publisher.privateKey,
  reviewerKey = keys.reviewer.privateKey
): SignedAcademicPolicy {
  return {
    ...document,
    issuerSignature: {
      ...document.issuerSignature,
      value: signPayload(document.payload, issuerKey),
    },
    reviewerSignature: {
      ...document.reviewerSignature,
      value: signPayload(document.payload, reviewerKey),
    },
  };
}

describe("B62.6 academic policy cryptographic governance preflight", () => {
  it.each(["JHS", "SHS", "TERTIARY"] as const)(
    "validates scoped dual signatures for Ghana %s only as integrity evidence",
    level => {
      const f = fixture(level);
      const before = JSON.stringify({
        document: f.document,
        context: f.context,
      });
      const result = reviewAcademicPolicyAttestation(
        f.document,
        f.trust,
        f.context,
        now
      );
      expect(result).toEqual({
        schemaVersion: 1,
        status: "integrity_passed_not_authorized",
        reasonCodes: [],
        officialApprovalEstablished: false,
        authoritativeMasteryEligible: false,
      });
      expect(AcademicPolicyVerificationSchema.safeParse(result).success).toBe(
        true
      );
      expect(JSON.stringify({ document: f.document, context: f.context })).toBe(
        before
      );
    }
  );

  it("rejects a forged policy with no registered signing keys or approved source", () => {
    const f = fixture();
    const result = reviewAcademicPolicyAttestation(
      f.document,
      { ...f.trust, signers: [], sources: [] },
      f.context,
      now
    );
    expect(result.status).toBe("held");
    expect(result.reasonCodes).toContain("issuer_not_trusted");
    expect(result.reasonCodes).toContain("reviewer_not_trusted");
    expect(result.reasonCodes).toContain("signature_invalid");
    expect(result.reasonCodes).toContain("source_unreviewed_or_withdrawn");
  });

  it("does not accept a tampered policy or curriculum after signatures are issued", () => {
    const f = fixture();
    const payload = {
      ...f.document.payload,
      policy: {
        ...f.document.payload.policy,
        sourceReferences: ["https://example.org/changed-after-signing"],
      },
    };
    const result = reviewAcademicPolicyAttestation(
      { ...f.document, payload },
      f.trust,
      f.context,
      now
    );
    expect(result.reasonCodes).toContain("signature_invalid");
    expect(result.authoritativeMasteryEligible).toBe(false);
  });

  it("detects one invalid signature even when the other signer is valid", () => {
    const f = fixture();
    const bad = {
      ...f.document,
      reviewerSignature: {
        ...f.document.reviewerSignature,
        value: signPayload(f.document.payload, keys.outsider.privateKey),
      },
    };
    const result = reviewAcademicPolicyAttestation(
      bad,
      f.trust,
      f.context,
      now
    );
    expect(result.reasonCodes).toContain("signature_invalid");
  });

  it("rejects a cross-role or wrong-authority signer", () => {
    const f = fixture();
    const role = {
      ...f.trust,
      signers: f.trust.signers.map(signer =>
        signer.keyId === "fixture-publisher"
          ? { ...signer, role: "reviewer" }
          : signer
      ),
    };
    expect(
      reviewAcademicPolicyAttestation(f.document, role, f.context, now)
        .reasonCodes
    ).toContain("issuer_not_trusted");
    const authority = {
      ...f.trust,
      signers: f.trust.signers.map(signer =>
        signer.keyId === "fixture-publisher"
          ? { ...signer, authorityId: "another-authority" }
          : signer
      ),
    };
    expect(
      reviewAcademicPolicyAttestation(f.document, authority, f.context, now)
        .reasonCodes
    ).toContain("issuer_not_trusted");
    const crossAuthorityReviewer = {
      ...f.trust,
      signers: f.trust.signers.map(signer =>
        signer.role === "reviewer"
          ? { ...signer, authorityId: "another-authority" }
          : signer
      ),
    };
    expect(
      reviewAcademicPolicyAttestation(
        f.document,
        crossAuthorityReviewer,
        f.context,
        now
      ).reasonCodes
    ).toContain("reviewer_not_trusted");
  });

  it("rejects a reviewer whose key does not belong to the signed approver identity", () => {
    const f = fixture();
    const trust = {
      ...f.trust,
      signers: f.trust.signers.map(signer =>
        signer.role === "reviewer"
          ? { ...signer, principalId: "unrelated-reviewer" }
          : signer
      ),
    };
    const result = reviewAcademicPolicyAttestation(
      f.document,
      trust,
      f.context,
      now
    );
    expect(result.reasonCodes).toContain("reviewer_not_trusted");
  });

  it("requires reviewer independence from publication identity even with two valid keys", () => {
    const f = fixture();
    const principal = f.trust.signers[0].principalId;
    const changedPayload = {
      ...f.document.payload,
      policy: { ...f.document.payload.policy, approvedBy: principal },
    };
    const document = signedAgain({
      ...f.document,
      payload: changedPayload,
    });
    const trust = {
      ...f.trust,
      signers: f.trust.signers.map(signer =>
        signer.role === "reviewer"
          ? { ...signer, principalId: principal }
          : signer
      ),
    };
    const result = reviewAcademicPolicyAttestation(
      document,
      trust,
      f.context,
      now
    );
    expect(result.reasonCodes).toContain("reviewer_not_independent");
  });

  it("blocks cross-level, wrong curriculum version and institutional scope escalation", () => {
    const f = fixture("SHS");
    const anotherLevel = {
      ...f.context,
      educationLevel: "JHS" as const,
    };
    expect(
      reviewAcademicPolicyAttestation(f.document, f.trust, anotherLevel, now)
        .reasonCodes
    ).toContain("context_mismatch");
    expect(
      reviewAcademicPolicyAttestation(
        f.document,
        f.trust,
        { ...f.context, curriculumVersion: "2027" },
        now
      ).reasonCodes
    ).toContain("context_mismatch");
    const scopedPayload = {
      ...f.document.payload,
      scope: { ...f.document.payload.scope, institutionId: "campus-1" },
    };
    const institutionDocument = signedAgain({
      ...f.document,
      payload: scopedPayload,
    });
    expect(
      reviewAcademicPolicyAttestation(
        institutionDocument,
        f.trust,
        f.context,
        now
      ).reasonCodes
    ).toContain("signer_scope_mismatch");
  });

  it("never assumes a tertiary curriculum is valid for a different programme", () => {
    const f = fixture("TERTIARY");
    const result = reviewAcademicPolicyAttestation(
      f.document,
      f.trust,
      { ...f.context, programId: "another-programme" },
      now
    );
    expect(result.reasonCodes).toContain("context_mismatch");
  });

  it("holds withdrawn sources or mismatched content digests", () => {
    const f = fixture();
    const withdrawn = {
      ...f.trust,
      sources: f.trust.sources.map(source => ({
        ...source,
        status: "withdrawn" as const,
      })),
    };
    expect(
      reviewAcademicPolicyAttestation(f.document, withdrawn, f.context, now)
        .reasonCodes
    ).toContain("source_unreviewed_or_withdrawn");
    const changedManifest = signedAgain({
      ...f.document,
      payload: {
        ...f.document.payload,
        sourceManifestSha256: "b".repeat(64),
      },
    });
    expect(
      reviewAcademicPolicyAttestation(changedManifest, f.trust, f.context, now)
        .reasonCodes
    ).toContain("source_unreviewed_or_withdrawn");
  });

  it("enforces policy version revocations even against intact signatures", () => {
    const f = fixture();
    const trust = {
      ...f.trust,
      revocations: [
        {
          authorityId: "fixture-authority",
          policyId: "policy-science",
          version: "1.0.0",
          revokedAt: "2026-10-24T11:30:00.000Z",
          reason: "withdrawn" as const,
        },
      ],
    };
    const result = reviewAcademicPolicyAttestation(
      f.document,
      trust,
      f.context,
      now
    );
    expect(result.reasonCodes).toContain("policy_revoked");
    expect(result.status).toBe("held");
  });

  it("rejects revoked or expired signing keys", () => {
    const f = fixture();
    const revoked = {
      ...f.trust,
      signers: f.trust.signers.map(signer => ({
        ...signer,
        ...(signer.role === "publisher"
          ? { revokedAt: "2026-10-24T11:30:00.000Z" }
          : {}),
      })),
    };
    expect(
      reviewAcademicPolicyAttestation(f.document, revoked, f.context, now)
        .reasonCodes
    ).toContain("signer_expired_or_revoked");
    const expired = {
      ...f.trust,
      signers: f.trust.signers.map(signer => ({
        ...signer,
        validUntil: "2026-10-24T11:30:00.000Z",
      })),
    };
    expect(
      reviewAcademicPolicyAttestation(f.document, expired, f.context, now)
        .reasonCodes
    ).toContain("signer_expired_or_revoked");
  });

  it("fails closed for stale, future and mismatched trust snapshot versions", () => {
    const f = fixture();
    const stale = {
      ...f.trust,
      observedAt: "2026-10-24T10:30:00.000Z",
    };
    const result = reviewAcademicPolicyAttestation(
      f.document,
      stale,
      f.context,
      "2026-10-26T10:00:00.000Z"
    );
    expect(result.reasonCodes).toContain("stale_or_future_trust_snapshot");
    expect(
      reviewAcademicPolicyAttestation(
        f.document,
        { ...f.trust, observedAt: "2026-10-24T15:00:00.000Z" },
        f.context,
        now
      ).reasonCodes
    ).toContain("stale_or_future_trust_snapshot");
    expect(
      reviewAcademicPolicyAttestation(
        f.document,
        { ...f.trust, version: 2 },
        f.context,
        now
      ).reasonCodes
    ).toContain("stale_or_future_trust_snapshot");
  });

  it("rejects invalid, incomplete and duplicate trust records", () => {
    const f = fixture();
    expect(
      reviewAcademicPolicyAttestation(
        f.document,
        { ...f.trust, signers: [...f.trust.signers, f.trust.signers[0]] },
        f.context,
        now
      ).reasonCodes
    ).toContain("invalid_trust_snapshot");
    expect(
      reviewAcademicPolicyAttestation(
        f.document,
        { ...f.trust, sources: [...f.trust.sources, f.trust.sources[0]] },
        f.context,
        now
      ).reasonCodes
    ).toContain("invalid_trust_snapshot");
    expect(
      reviewAcademicPolicyAttestation(
        { ...f.document, administrativeApproval: "yes" },
        f.trust,
        f.context,
        now
      ).reasonCodes
    ).toContain("invalid_document");
  });

  it("rejects malformed official-sounding claims or independently supplied approval state", () => {
    const f = fixture();
    const response = reviewAcademicPolicyAttestation(
      f.document,
      f.trust,
      f.context,
      now
    );
    expect(
      AcademicPolicyVerificationSchema.safeParse({
        ...response,
        authoritativeMasteryEligible: true,
      }).success
    ).toBe(false);
    expect(
      AcademicPolicyVerificationSchema.safeParse({
        ...response,
        officialApprovalEstablished: true,
      }).success
    ).toBe(false);
    expect(
      AcademicPolicyVerificationSchema.safeParse({
        ...response,
        status: "officially_verified",
      }).success
    ).toBe(false);
  });

  it("requires approval, publication and issuance in chronological order", () => {
    const f = fixture();
    const malformed = {
      ...f.document,
      payload: {
        ...f.document.payload,
        issuedAt: "2026-10-20T10:00:00.000Z",
      },
    };
    expect(
      reviewAcademicPolicyAttestation(malformed, f.trust, f.context, now)
        .reasonCodes
    ).toContain("invalid_document");
  });

  it("does not treat learner-context status labels as trusted policy provenance", () => {
    const f = fixture();
    expect(
      reviewAcademicPolicyAttestation(
        f.document,
        f.trust,
        { ...f.context, status: "pending_review" },
        now
      ).reasonCodes
    ).toContain("context_mismatch");
  });

  it("keeps the cryptographic bytes stable regardless of object input field insertion order", () => {
    const f = fixture();
    const policy = f.document.payload.policy;
    const reordered = {
      ...f.document.payload,
      policy: Object.fromEntries(
        Object.entries(policy).reverse()
      ) as typeof policy,
    };
    expect(canonicalAcademicPolicyBytes(reordered)).toEqual(
      canonicalAcademicPolicyBytes(f.document.payload)
    );
  });
});
