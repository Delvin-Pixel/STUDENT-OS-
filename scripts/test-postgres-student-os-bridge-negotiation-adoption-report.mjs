#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import pg from 'pg';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required for negotiation adoption reporting integration testing.');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,
  connectionTimeoutMillis: 10_000,
  statement_timeout: 15_000,
});
const prefix = `adoption-report-${randomUUID()}`;
const rawUserId = `student-${randomUUID()}`;
const fingerprint = createHmac('sha256', 'test-negotiation-report-secret-0123456789abcdef')
  .update(rawUserId)
  .digest('hex');

try {
  const explicitRequest = `${prefix}-explicit`;
  const legacyRequest = `${prefix}-legacy`;

  await pool.query(
    `insert into student_os_bridge_events (
       user_fingerprint, bridge_request_id, server_request_id, capability,
       event_type, duration_ms, bridge_contract_version, contract_negotiation_source
     ) values
       ($1,$2,$4,'chat','claimed',1,'1.0','explicit'),
       ($1,$2,$5,'chat','completed',2,'1.0','explicit'),
       ($1,$3,$6,'tutor','claimed',1,'1.0','legacy-default'),
       ($1,$3,$7,'tutor','completed',2,'1.0','legacy-default')`,
    [
      fingerprint,
      explicitRequest,
      legacyRequest,
      `srv-${randomUUID()}`,
      `srv-${randomUUID()}`,
      `srv-${randomUUID()}`,
      `srv-${randomUUID()}`,
    ],
  );

  const result = await pool.query(
    `select
       contract_negotiation_source,
       bridge_contract_version,
       count(distinct bridge_request_id)::int as request_count
     from student_os_bridge_events
     where bridge_request_id like $1
       and contract_negotiation_source is not null
       and bridge_contract_version is not null
     group by contract_negotiation_source, bridge_contract_version
     order by contract_negotiation_source asc`,
    [`${prefix}%`],
  );

  assert.deepEqual(result.rows, [
    { contract_negotiation_source: 'explicit', bridge_contract_version: '1.0', request_count: 1 },
    { contract_negotiation_source: 'legacy-default', bridge_contract_version: '1.0', request_count: 1 },
  ]);

  console.log('NEXA PostgreSQL negotiation adoption reporting tests passed.');
} finally {
  try {
    await pool.query('delete from student_os_bridge_events where bridge_request_id like $1', [`${prefix}%`]);
  } catch {}
  await pool.end();
}
