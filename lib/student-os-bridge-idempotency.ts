import { hashRequestBody } from '@/lib/idempotency-core';
import { query, withTransaction } from '@/lib/db';
import type { StudentOsBridgeEnvelope } from '@/lib/student-os-bridge-core';

const BRIDGE_REQUEST_TTL_SECONDS = 24 * 60 * 60;
const BRIDGE_REQUEST_LEASE_MS = 90_000;

export type StudentOsBridgeRequestLease = Readonly<{
  externalUserId: string;
  requestId: string;
  ownerRequestId: string;
  attemptId: string;
}>;

export type StudentOsBridgeRequestClaim =
  | Readonly<{
      kind: 'claimed';
      recovered: boolean;
      lease: StudentOsBridgeRequestLease;
    }>
  | Readonly<{
      kind: 'in_progress';
      retryAfterSeconds: number;
    }>
  | Readonly<{
      kind: 'replay';
      status: number;
      body: unknown;
      terminalStatus: 'completed' | 'failed';
    }>;

export class StudentOsBridgeIdempotencyError extends Error {
  code: 'KEY_REUSE_MISMATCH';

  constructor() {
    super('KEY_REUSE_MISMATCH');
    this.name = 'StudentOsBridgeIdempotencyError';
    this.code = 'KEY_REUSE_MISMATCH';
  }
}

export function hashStudentOsBridgeRequest(envelope: StudentOsBridgeEnvelope) {
  return hashRequestBody(envelope);
}

export async function claimStudentOsBridgeRequest(input: {
  externalUserId: string;
  requestId: string;
  requestHash: string;
  capability: StudentOsBridgeEnvelope['capability'];
  ownerRequestId: string;
}): Promise<StudentOsBridgeRequestClaim> {
  return withTransaction(async (client) => {
    await client.query(
      `delete from student_os_bridge_requests
       where external_user_id = $1
         and request_id = $2
         and expires_at <= now()`,
      [input.externalUserId, input.requestId],
    );

    const inserted = await client.query<{ owner_attempt_id: string }>(
      `insert into student_os_bridge_requests (
         external_user_id, request_id, request_hash, capability, status,
         owner_request_id, owner_attempt_id, lease_expires_at, expires_at
       )
       values (
         $1, $2, $3, $4, 'running',
         $5, gen_random_uuid(),
         clock_timestamp() + ($6::int * interval '1 millisecond'),
         now() + ($7 * interval '1 second')
       )
       on conflict (external_user_id, request_id) do nothing
       returning owner_attempt_id`,
      [
        input.externalUserId,
        input.requestId,
        input.requestHash,
        input.capability,
        input.ownerRequestId,
        BRIDGE_REQUEST_LEASE_MS,
        BRIDGE_REQUEST_TTL_SECONDS,
      ],
    );

    if (inserted.rows[0]) {
      return Object.freeze({
        kind: 'claimed',
        recovered: false,
        lease: Object.freeze({
          externalUserId: input.externalUserId,
          requestId: input.requestId,
          ownerRequestId: input.ownerRequestId,
          attemptId: inserted.rows[0].owner_attempt_id,
        }),
      });
    }

    const existing = await client.query<{
      request_hash: string;
      status: 'running' | 'completed' | 'failed';
      response_status: number | null;
      response_body: unknown | null;
      lease_expires_at: string;
      owner_request_id: string;
    }>(
      `select request_hash, status, response_status, response_body,
              lease_expires_at, owner_request_id
       from student_os_bridge_requests
       where external_user_id = $1 and request_id = $2
       for update`,
      [input.externalUserId, input.requestId],
    );
    const row = existing.rows[0];
    if (!row) throw new Error('Student OS bridge request ledger record could not be created.');
    if (row.request_hash !== input.requestHash) throw new StudentOsBridgeIdempotencyError();

    if (row.status !== 'running') {
      if (row.response_status === null || row.response_body === null) {
        throw new Error('Student OS bridge terminal replay is incomplete.');
      }
      return Object.freeze({
        kind: 'replay',
        status: row.response_status,
        body: row.response_body,
        terminalStatus: row.status,
      });
    }

    const leaseExpiry = new Date(row.lease_expires_at).getTime();
    if (Number.isFinite(leaseExpiry) && leaseExpiry > Date.now()) {
      return Object.freeze({
        kind: 'in_progress',
        retryAfterSeconds: Math.max(1, Math.ceil((leaseExpiry - Date.now()) / 1000)),
      });
    }

    const recovered = await client.query<{ owner_attempt_id: string }>(
      `update student_os_bridge_requests
       set owner_request_id = $3,
           owner_attempt_id = gen_random_uuid(),
           lease_expires_at = clock_timestamp() + ($4::int * interval '1 millisecond'),
           recovery_count = recovery_count + 1,
           updated_at = now()
       where external_user_id = $1
         and request_id = $2
         and status = 'running'
       returning owner_attempt_id`,
      [input.externalUserId, input.requestId, input.ownerRequestId, BRIDGE_REQUEST_LEASE_MS],
    );
    const next = recovered.rows[0];
    if (!next) {
      return Object.freeze({ kind: 'in_progress', retryAfterSeconds: 1 });
    }

    return Object.freeze({
      kind: 'claimed',
      recovered: true,
      lease: Object.freeze({
        externalUserId: input.externalUserId,
        requestId: input.requestId,
        ownerRequestId: input.ownerRequestId,
        attemptId: next.owner_attempt_id,
      }),
    });
  });
}

async function finalizeStudentOsBridgeRequest(
  lease: StudentOsBridgeRequestLease,
  terminalStatus: 'completed' | 'failed',
  responseStatus: number,
  responseBody: unknown,
) {
  const result = await query(
    `update student_os_bridge_requests
     set status = $5,
         response_status = $6,
         response_body = $7::jsonb,
         completed_at = now(),
         updated_at = now(),
         lease_expires_at = clock_timestamp()
     where external_user_id = $1
       and request_id = $2
       and status = 'running'
       and owner_request_id = $3
       and owner_attempt_id = $4::uuid
       and lease_expires_at > clock_timestamp()
     returning request_id`,
    [
      lease.externalUserId,
      lease.requestId,
      lease.ownerRequestId,
      lease.attemptId,
      terminalStatus,
      responseStatus,
      JSON.stringify(responseBody),
    ],
  );
  return result.rows.length === 1;
}

export function completeStudentOsBridgeRequest(
  lease: StudentOsBridgeRequestLease,
  responseStatus: number,
  responseBody: unknown,
) {
  return finalizeStudentOsBridgeRequest(lease, 'completed', responseStatus, responseBody);
}

export function failStudentOsBridgeRequest(
  lease: StudentOsBridgeRequestLease,
  responseStatus: number,
  responseBody: unknown,
) {
  return finalizeStudentOsBridgeRequest(lease, 'failed', responseStatus, responseBody);
}

export function mapStudentOsBridgeIdempotencyError(error: unknown) {
  if (!(error instanceof StudentOsBridgeIdempotencyError)) return null;
  return 'This Student OS bridge request ID was already used with a different payload.';
}
