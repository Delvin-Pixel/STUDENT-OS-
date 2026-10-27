import { createHash } from "node:crypto";
import {
  AcademicGovernanceLedgerEventSchema,
  GOVERNANCE_LEDGER_GENESIS_HASH,
  type AcademicGovernanceLedgerEvent,
} from "../shared/academicPolicyGovernanceLedger";

/** Hash the schema-ordered event envelope without its eventHash field. */
export function governanceEventHash(
  event: Omit<AcademicGovernanceLedgerEvent, "eventHash">
): string {
  return createHash("sha256")
    .update("student-os/academic-governance-ledger/v1\n", "utf8")
    .update(JSON.stringify(event), "utf8")
    .digest("hex");
}

/**
 * Checks byte-level event integrity and ordering only; it does not validate
 * signer authority.
 */
export function verifyAcademicGovernanceLedger(input: unknown): {
  valid: boolean;
  eventCount: number;
  reason:
    | "valid"
    | "invalid_event"
    | "authority_mismatch"
    | "sequence_gap"
    | "previous_hash_mismatch"
    | "event_hash_mismatch";
} {
  if (!Array.isArray(input))
    return { valid: false, eventCount: 0, reason: "invalid_event" };

  let previousHash = GOVERNANCE_LEDGER_GENESIS_HASH;
  let authorityId: string | undefined;

  for (let i = 0; i < input.length; i += 1) {
    const parsed = AcademicGovernanceLedgerEventSchema.safeParse(input[i]);
    if (!parsed.success)
      return { valid: false, eventCount: i, reason: "invalid_event" };

    const event = parsed.data;
    if (authorityId === undefined) authorityId = event.authorityId;
    if (event.authorityId !== authorityId)
      return { valid: false, eventCount: i, reason: "authority_mismatch" };
    if (event.sequence !== i + 1)
      return { valid: false, eventCount: i, reason: "sequence_gap" };
    if (event.previousEventHash !== previousHash)
      return { valid: false, eventCount: i, reason: "previous_hash_mismatch" };

    const { eventHash, ...unsignedEvent } = event;
    if (governanceEventHash(unsignedEvent) !== eventHash)
      return { valid: false, eventCount: i, reason: "event_hash_mismatch" };
    previousHash = eventHash;
  }

  return { valid: true, eventCount: input.length, reason: "valid" };
}
