#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import pg from 'pg';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required for Student OS bridge observability integration testing.');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,
  connectionTimeoutMillis: 10_000,
  statement_timeout: 15_000,
});
const rawUserId = `student-${randomUUID()}`;
const bridgeRequestId = `req-${randomUUID()}`;
const fingerprint = createHmac('sha256', 'test-observability-secret-0123456789abcdef')
  .update(rawUserId)
  .digest('hex');

try {
  const migrated = await pool.query(
    "select version from schema_migrations where version = '041_student_os_bridge_observability.sql'",
  );
  assert.equal(migrated.rows.length, 1, 'Migration 041 must be applied before bridge observability tests.');

  const columns = await pool.query(
    `select column_name from information_schema.columns
     where table_schema = 'public' and table_name = 'student_os_bridge_events'`,
  );
  const names = new Set(columns.rows.map((row) => row.column_name));
  assert.equal(names.has('external_user_id'), false);
  assert.equal(names.has('prompt'), false);
  assert.equal(names.has('response_body'), false);
  assert.equal(names.has('metadata'), false);

  await pool.query(
    `insert into student_os_bridge_events (
       user_fingerprint, bridge_request_id, server_request_id, capability,
       event_type, http_status, duration_ms, provider_ok
     ) values
       ($1, $2, $3, 'tutor', 'claimed', null, 7, null),
       ($1, $2, $4, 'tutor', 'completed', 200, 321, true)`,
    [fingerprint, bridgeRequestId, `srv-${randomUUID()}`, `srv-${randomUUID()}`],
  );

  const events = await pool.query(
    `select user_fingerprint, bridge_request_id, event_type, http_status, duration_ms, provider_ok
     from student_os_bridge_events
     where bridge_request_id = $1
     order by created_at asc, event_type asc`,
    [bridgeRequestId],
  );
  assert.equal(events.rows.length, 2);
  assert.ok(events.rows.every((row) => row.user_fingerprint === fingerprint));
  assert.ok(events.rows.every((row) => row.user_fingerprint !== rawUserId));
  assert.ok(events.rows.some((row) => row.event_type === 'completed' && Number(row.http_status) === 200 && row.provider_ok === true));

  await pool.query('savepoint invalid_fingerprint');
  await assert.rejects(
    () => pool.query(
      `insert into student_os_bridge_events (
         user_fingerprint, bridge_request_id, server_request_id, capability, event_type, duration_ms
       ) values ($1, $2, 'server-test', 'chat', 'claimed', 0)`,
      [rawUserId, `req-${randomUUID()}`],
    ),
    (error) => error?.code === '23514',
  );
  await pool.query('rollback to savepoint invalid_fingerprint');

  await pool.query(
    `insert into student_os_bridge_events (
       user_fingerprint, bridge_request_id, server_request_id, capability,
       event_type, http_status, duration_ms, limit_scope, created_at
     ) values ($1, $2, 'server-old', 'chat', 'rate_limited', 429, 1, 'global-minute', now() - interval '120 days')`,
    [fingerprint, `old-${randomUUID()}`],
  );
  const pruned = await pool.query(
    `delete from student_os_bridge_events
     where created_at < now() - interval '90 days'
     returning id`,
  );
  assert.equal(pruned.rows.length, 1);

  console.log('NEXA PostgreSQL Student OS bridge observability integration tests passed.');
} finally {
  try {
    await pool.query('delete from student_os_bridge_events where user_fingerprint = $1', [fingerprint]);
  } catch {}
  await pool.end();
}
