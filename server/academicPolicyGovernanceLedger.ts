import { createHash } from "node:crypto";
import type { AcademicGovernanceLedgerEvent } from "../shared/academicPolicyGovernanceLedger";

/** Hash the schema-ordered event envelope without its eventHash field. */
export function governanceEventHash(
  event: Omit<AcademicGovernanceLedgerEvent, "eventHash">
): string {
  return createHash("sha256")
    .update("student-os/academic-governance-ledger/v1\n", "utf8")
    .update(JSON.stringify(event), "utf8")
    .digest("hex");
}
