#!/usr/bin/env node
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import pg from 'pg';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required for Student OS bridge idempotency integration testing.');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,
  connectionTimeoutMillis: 10_000,
  statement_timeout: 15_000,
});

const userId = `student-${randomUUID()}`;
const requestId = `req-${randomUUID()}`;
const requestHash = createHash('sha256').update('bridge-request-a').digest('hex');
const otherHash = createHash('sha256').update('bridge-request-b').digest('hex');
const ownerA = `owner-${randomUUID()}`;
const ownerB = `owner-${randomUUID()}`;
const attemptA = randomUUID();
const attemptB = randomUUID();

try {
  const migrated = await pool.query(
    "select version from schema_migrations where version = '040_student_os_bridge_idempotency.sql'",
  );
  assert.equal(migrated.rows.length, 1, 'Migration 040 must be applied before bridge idempotency tests.');

  const inserted = await pool.query(
    `insert into student_os_bridge_requests (
       external_user_id, request_id, request_hash, capability, status,
       owner_request_id, owner_attempt_id, lease_expires_at, expires_at
     ) values (
       $1, $2, $3, 'tutor', 'running',
       $4, $5::uuid, clock_timestamp() + interval '90 seconds',
       now() + interval '24 hours'
     )
     returning request_id`,
    [userId, requestId, requestHash, ownerA, attemptA],
  );
  assert.equal(inserted.rows[0]?.request_id, requestId);

  const duplicate = await pool.query(
    `insert into student_os_bridge_requests (
       external_user_id, request_id, request_hash, capability, status,
       owner_request_id, owner_attempt_id, lease_expires_at, expires_at
     ) values (
       $1, $2, $3, 'tutor', 'running',
       $4, $5::uuid, clock_timestamp() + interval '90 seconds',
       now() + interval '24 hours'
     )
     on conflict (external_user_id, request_id) do nothing
     returning request_id`,
    [userId, requestId, requestHash, ownerB, attemptB],
  );
  assert.equal(duplicate.rows.length, 0, 'Duplicate bridge request must not create a second ledger row.');

  const live = await pool.query(
    `select request_hash, owner_request_id, owner_attempt_id, lease_expires_at
     from student_os_bridge_requests
     where external_user_id = $1 and request_id = $2`,
    [userId, requestId],
  );
  assert.equal(live.rows[0].request_hash, requestHash);
  assert.equal(live.rows[0].owner_request_id, ownerA);
  assert.equal(live.rows[0].owner_attempt_id, attemptA);
  assert.ok(new Date(live.rows[0].lease_expires_at).getTime() > Date.now());

  const response = {
    ok: true,
    requestId,
    capability: 'tutor',
    content: 'Replay-safe answer.',
    metadata: {
      contractVersion: '1.0',
      academicDecisionAuthority: 'student-os-learning-intelligence',
    },
  };
  const completed = await pool.query(
    `update student_os_bridge_requests
     set status = 'completed',
         response_status = 200,
         response_body = $5::jsonb,
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
    [userId, requestId, ownerA, attemptA, JSON.stringify(response)],
  );
  assert.equal(completed.rows.length, 1);

  const replay = await pool.query(
    `select status, response_status, response_body, request_hash
     from student_os_bridge_requests
     where external_user_id = $1 and request_id = $2`,
    [userId, requestId],
  );
  assert.equal(replay.rows[0].status, 'completed');
  assert.equal(Number(replay.rows[0].response_status), 200);
  assert.deepEqual(replay.rows[0].response_body, response);
  assert.notEqual(replay.rows[0].request_hash, otherHash, 'Request hash mismatch remains detectable for key-reuse fencing.');

  const staleOwner = await pool.query(
    `update student_os_bridge_requests
     set response_body = '{"bad":true}'::jsonb
     where external_user_id = $1
       and request_id = $2
       and status = 'running'
       and owner_request_id = $3
       and owner_attempt_id = $4::uuid
     returning request_id`,
    [userId, requestId, ownerB, attemptB],
  );
  assert.equal(staleOwner.rows.length, 0, 'Non-owner must not mutate a completed bridge request.');

  const recoverRequestId = `req-${randomUUID()}`;
  const recoverHash = createHash('sha256').update('recoverable-request').digest('hex');
  await pool.query(
    `insert into student_os_bridge_requests (
       external_user_id, request_id, request_hash, capability, status,
       owner_request_id, owner_attempt_id, lease_expires_at, expires_at
     ) values (
       $1, $2, $3, 'coach', 'running',
       $4, $5::uuid, clock_timestamp() - interval '1 second',
       now() + interval '24 hours'
     )`,
    [userId, recoverRequestId, recoverHash, ownerA, attemptA],
  );

  const recovered = await pool.query(
    `update student_os_bridge_requests
     set owner_request_id = $3,
         owner_attempt_id = $4::uuid,
         lease_expires_at = clock_timestamp() + interval '90 seconds',
         recovery_count = recovery_count + 1,
         updated_at = now()
     where external_user_id = $1
       and request_id = $2
       and status = 'running'
       and lease_expires_at <= clock_timestamp()
     returning owner_request_id, owner_attempt_id, recovery_count`,
    [userId, recoverRequestId, ownerB, attemptB],
  );
  assert.equal(recovered.rows[0].owner_request_id, ownerB);
  assert.equal(recovered.rows[0].owner_attempt_id, attemptB);
  assert.equal(Number(recovered.rows[0].recovery_count), 1);

  const staleComplete = await pool.query(
    `update student_os_bridge_requests
     set status = 'failed', response_status = 500, response_body = '{"error":"stale"}'::jsonb,
         completed_at = now()
     where external_user_id = $1
       and request_id = $2
       and status = 'running'
       and owner_request_id = $3
       and owner_attempt_id = $4::uuid
       and lease_expires_at > clock_timestamp()
     returning request_id`,
    [userId, recoverRequestId, ownerA, attemptA],
  );
  assert.equal(staleComplete.rows.length, 0, 'Recovered ownership must fence the stale bridge owner.');

  console.log('NEXA PostgreSQL Student OS bridge idempotency integration tests passed.');
} finally {
  try {
    await pool.query('delete from student_os_bridge_requests where external_user_id = $1', [userId]);
  } catch {}
  await pool.end();
}
