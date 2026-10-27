import { createHash, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  AcademicGovernanceLedgerEventSchema,
  GOVERNANCE_LEDGER_GENESIS_HASH,
  governanceEventHash,
  verifyAcademicGovernanceLedger,
  type AcademicGovernanceLedgerEvent,
} from "../shared/academicPolicyGovernanceLedger";

function event(sequence: number, previousEventHash: string): AcademicGovernanceLedgerEvent {
  const unsigned = {
    protocol: "student-os-academic-governance-ledger-v1" as const,
    eventId: randomUUID(),
    authorityId: "synthetic-test-authority",
    sequence,
    eventType: "policy_revoked" as const,
    subjectId: "synthetic-policy",
    subjectVersion: "1.0.0",
    scope: {
      countryCode: "GH" as const,
      educationLevel: "SHS" as const,
      curriculumId: "test-curriculum",
      curriculumVersion: "2026",
    },
    actorPrincipalId: "synthetic-actor",
    reviewerPrincipalId: "synthetic-reviewer",
    actorKeyId: "synthetic-actor-key",
    reviewerKeyId: "synthetic-reviewer-key",
    actorSignature: Buffer.alloc(64, sequence).toString("base64url"),
    reviewerSignature: Buffer.alloc(64, sequence + 1).toString("base64url"),
    requestKey: `synthetic-request-key-${sequence}`,
    occurredAt: "2026-10-27T10:00:00.000Z",
    previousEventHash,
  };
  return AcademicGovernanceLedgerEventSchema.parse({
    ...unsigned,
    eventHash: governanceEventHash(unsigned),
  });
}

function chain() {
  const first = event(1, GOVERNANCE_LEDGER_GENESIS_HASH);
  return [first, event(2, first.eventHash)];
}

describe("academic governance append-only ledger contract", () => {
  it("verifies an ordered chain and rejects a sequence gap", () => {
    const events = chain();
    expect(verifyAcademicGovernanceLedger(events)).toEqual({ valid: true, eventCount: 2, reason: "valid" });
    expect(verifyAcademicGovernanceLedger([events[1]])).toMatchObject({ valid: false, reason: "sequence_gap" });
  });

  it("detects event tampering even when the prior hash is retained", () => {
    const events = chain();
    const tampered = [{ ...events[0], subjectId: "forged-policy" }, events[1]];
    expect(verifyAcademicGovernanceLedger(tampered)).toMatchObject({ valid: false, reason: "event_hash_mismatch" });
  });

  it("detects removal, reordering and previous-hash substitution", () => {
    const events = chain();
    expect(verifyAcademicGovernanceLedger(events.slice(1))).toMatchObject({ valid: false, reason: "sequence_gap" });
    expect(verifyAcademicGovernanceLedger([...events].reverse())).toMatchObject({ valid: false, reason: "sequence_gap" });
    expect(verifyAcademicGovernanceLedger([{ ...events[0], previousEventHash: "f".repeat(64) }, events[1])).toMatchObject({ valid: false, reason: "previous_hash_mismatch" });
  });

  it("rejects cross-authority mixing and same-principal review", () => {
    const events = chain();
    expect(verifyAcademicGovernanceLedger([events[0], { ...events[1], authorityId: "other-authority" }])).toMatchObject({ valid: false, reason: "authority_mismatch" });
    expect(AcademicGovernanceLedgerEventSchema.safeParse({ ...events[0], reviewerPrincipalId: events[0].actorPrincipalId }).success).toBe(false);
  });

  it("requires source digests and policy versions for governance events", () => {
    const base = event(1, GOVERNANCE_LEDGER_GENESIS_HASH);
    expect(AcademicGovernanceLedgerEventSchema.safeParse({ ...base, eventType: "source_manifest_reviewed", sourceManifestSha256: undefined }).success).toBe(false);
    expect(AcademicGovernanceLedgerEventSchema.safeParse({ ...base, subjectVersion: undefined }).success).toBe(false);
  });

  it("documents that hash integrity is not signature authority", () => {
    const events = chain();
    expect(verifyAcademicGovernanceLedger(events).valid).toBe(true);
    expect(createHash("sha256").update(events[0].actorSignature).digest("hex")).toHaveLength(64);
    // Synthetic signatures intentionally are not accepted as proof of real-world signer identity.
  });
});
