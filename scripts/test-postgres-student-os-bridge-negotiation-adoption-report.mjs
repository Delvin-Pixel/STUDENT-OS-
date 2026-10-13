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
  const unobservedRequest = `${prefix}-unobserved`;
  const mixedRequest = `${prefix}-mixed`;

  await pool.query(
    `insert into student_os_bridge_events (
       user_fingerprint, bridge_request_id, server_request_id, capability,
       event_type, duration_ms, bridge_contract_version, contract_negotiation_source
     ) values
       ($1,$2,$6,'chat','claimed',1,'1.0','explicit'),
       ($1,$2,$7,'chat','completed',2,'1.0','explicit'),
       ($1,$3,$8,'tutor','claimed',1,'1.0','legacy-default'),
       ($1,$3,$9,'tutor','completed',2,'1.0','legacy-default'),
       ($1,$4,$10,'coach','claimed',1,null,null),
       ($1,$4,$11,'coach','failed',2,null,null),
       ($1,$5,$12,'explain','claimed',1,'1.0','explicit'),
       ($1,$5,$13,'explain','failed',2,null,null)`,
    [
      fingerprint,
      explicitRequest,
      legacyRequest,
      unobservedRequest,
      mixedRequest,
      `srv-${randomUUID()}`,
      `srv-${randomUUID()}`,
      `srv-${randomUUID()}`,
      `srv-${randomUUID()}`,
      `srv-${randomUUID()}`,
      `srv-${randomUUID()}`,
      `srv-${randomUUID()}`,
      `srv-${randomUUID()}`,
    ],
  );

  const adoption = await pool.query(
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

  assert.deepEqual(adoption.rows, [
    { contract_negotiation_source: 'explicit', bridge_contract_version: '1.0', request_count: 2 },
    { contract_negotiation_source: 'legacy-default', bridge_contract_version: '1.0', request_count: 1 },
  ]);

  const coverage = await pool.query(
    `with per_request as (
       select
         bridge_request_id,
         bool_and(
           contract_negotiation_source is not null
           and bridge_contract_version is not null
         ) as fully_observed,
         bool_or(
           contract_negotiation_source is not null
           and bridge_contract_version is not null
         ) as any_observed
       from student_os_bridge_events
       where bridge_request_id like $1
       group by bridge_request_id
     )
     select
       count(*)::int as total_bridge_requests,
       count(*) filter (where fully_observed)::int as fully_observed_requests,
       count(*) filter (where not any_observed)::int as unobserved_requests,
       count(*) filter (where any_observed and not fully_observed)::int as mixed_observability_requests
     from per_request`,
    [`${prefix}%`],
  );

  assert.deepEqual(coverage.rows[0], {
    total_bridge_requests: 4,
    fully_observed_requests: 2,
    unobserved_requests: 1,
    mixed_observability_requests: 1,
  });

  console.log('NEXA PostgreSQL negotiation adoption evidence coverage tests passed.');
} finally {
  try {
    await pool.query('delete from student_os_bridge_events where bridge_request_id like $1', [`${prefix}%`]);
  } catch {}
  await pool.end();
}
