import type { NexaAiGatewayReadinessReason } from '@/lib/ai-gateway-readiness-core';
import { query } from '@/lib/db';
import type { StudentOsBridgeAdmissionScope } from '@/lib/student-os-bridge-admission';
import type { StudentOsBridgeCapability, StudentOsBridgeContractNegotiation } from '@/lib/student-os-bridge-core';
import {
  fingerprintStudentOsBridgeUser,
  normalizeStudentOsBridgeDurationMs,
  type StudentOsBridgeEventType,
} from '@/lib/student-os-bridge-observability-core';

export type StudentOsBridgeObservation = Readonly<{
  externalUserId: string;
  bridgeRequestId: string;
  serverRequestId: string;
  capability: StudentOsBridgeCapability;
  eventType: StudentOsBridgeEventType;
  httpStatus?: number | null;
  durationMs: number;
  limitScope?: StudentOsBridgeAdmissionScope | null;
  providerOk?: boolean | null;
  operationalReason?: NexaAiGatewayReadinessReason | null;
  bridgeContractVersion?: string | null;
  contractNegotiationSource?: Extract<StudentOsBridgeContractNegotiation, { compatible: true }>['source'] | null;
}>;

export async function recordStudentOsBridgeEvent(input: StudentOsBridgeObservation) {
  try {
    const userFingerprint = fingerprintStudentOsBridgeUser(
      input.externalUserId,
      process.env.RATE_LIMIT_SECRET ?? '',
    );
    await query(
      `insert into student_os_bridge_events (
         user_fingerprint, bridge_request_id, server_request_id, capability,
         event_type, http_status, duration_ms, limit_scope, provider_ok, operational_reason,
         bridge_contract_version, contract_negotiation_source
       ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        userFingerprint,
        input.bridgeRequestId,
        input.serverRequestId,
        input.capability,
        input.eventType,
        input.httpStatus ?? null,
        normalizeStudentOsBridgeDurationMs(input.durationMs),
        input.limitScope ?? null,
        input.providerOk ?? null,
        input.operationalReason ?? null,
        input.bridgeContractVersion ?? null,
        input.contractNegotiationSource ?? null,
      ],
    );
  } catch {
    // Bridge observability must never break Student OS request handling.
  }
}
