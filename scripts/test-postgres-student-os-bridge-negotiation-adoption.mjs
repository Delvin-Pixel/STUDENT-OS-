#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import pg from 'pg';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required for negotiation adoption integration testing.');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,
  connectionTimeoutMillis: 10_000,
  statement_timeout: 15_000,
});
const rawUserId = `student-${randomUUID()}`;
const fingerprint = createHmac('sha256', 'test-negotiation-adoption-secret-0123456789abcdef')
  .update(rawUserId)
  .digest('hex');

try {
  const migrated = await pool.query(
    `select version from schema_migrations
     where version = '043_student_os_bridge_negotiation_adoption_observability.sql'`,
  );
  assert.equal(migrated.rows.length, 1);

  const columns = await pool.query(
    `select column_name from information_schema.columns
     where table_schema='public'
       and table_name='student_os_bridge_events'
       and column_name in ('bridge_contract_version','contract_negotiation_source')
     order by column_name`,
  );
  assert.deepEqual(
    columns.rows.map((row) => row.column_name),
    ['bridge_contract_version','contract_negotiation_source'],
  );

  const explicitRequest = `explicit-${randomUUID()}`;
  const legacyRequest = `legacy-${randomUUID()}`;

  await pool.query(
    `insert into student_os_bridge_events (
       user_fingerprint, bridge_request_id, server_request_id, capability,
       event_type, duration_ms, bridge_contract_version, contract_negotiation_source
     ) values
       ($1, $2, $3, 'chat', 'claimed', 3, '1.0', 'explicit'),
       ($1, $4, $5, 'tutor', 'claimed', 4, '1.0', 'legacy-default')`,
    [fingerprint, explicitRequest, `srv-${randomUUID()}`, legacyRequest, `srv-${randomUUID()}`],
  );

  const rows = await pool.query(
    `select bridge_request_id, bridge_contract_version, contract_negotiation_source
     from student_os_bridge_events
     where user_fingerprint=$1
       and bridge_request_id in ($2,$3)
     order by bridge_request_id`,
    [fingerprint, explicitRequest, legacyRequest],
  );
  assert.equal(rows.rows.length, 2);
  assert.ok(rows.rows.some((row) =>
    row.bridge_contract_version === '1.0'
    && row.contract_negotiation_source === 'explicit'
  ));
  assert.ok(rows.rows.some((row) =>
    row.bridge_contract_version === '1.0'
    && row.contract_negotiation_source === 'legacy-default'
  ));

  await assert.rejects(
    () => pool.query(
      `insert into student_os_bridge_events (
         user_fingerprint, bridge_request_id, server_request_id, capability,
         event_type, duration_ms, bridge_contract_version, contract_negotiation_source
       ) values ($1,$2,'server-test','chat','claimed',0,'1.0','raw-header')`,
      [fingerprint, `bad-source-${randomUUID()}`],
    ),
    (error) => error?.code === '23514',
  );

  await assert.rejects(
    () => pool.query(
      `insert into student_os_bridge_events (
         user_fingerprint, bridge_request_id, server_request_id, capability,
         event_type, duration_ms, bridge_contract_version
       ) values ($1,$2,'server-test','chat','claimed',0,'1.0')`,
      [fingerprint, `missing-source-${randomUUID()}`],
    ),
    (error) => error?.code === '23514',
  );

  await assert.rejects(
    () => pool.query(
      `insert into student_os_bridge_events (
         user_fingerprint, bridge_request_id, server_request_id, capability,
         event_type, duration_ms, bridge_contract_version, contract_negotiation_source
       ) values ($1,$2,'server-test','chat','claimed',0,'v1','explicit')`,
      [fingerprint, `bad-version-${randomUUID()}`],
    ),
    (error) => error?.code === '23514',
  );

  console.log('NEXA PostgreSQL bridge negotiation adoption observability tests passed.');
} finally {
  try {
    await pool.query('delete from student_os_bridge_events where user_fingerprint=$1', [fingerprint]);
  } catch {}
  await pool.end();
}
