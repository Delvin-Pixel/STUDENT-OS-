#!/usr/bin/env node
import pg from 'pg';

const daysArgIndex = process.argv.indexOf('--days');
const days = daysArgIndex >= 0 ? Number(process.argv[daysArgIndex + 1]) : 90;
if (!Number.isInteger(days) || days < 7 || days > 3650) {
  console.error('--days must be an integer from 7 to 3650.');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required.');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 10_000 });
const client = await pool.connect();
try {
  await client.query('begin');
  const audit = await client.query(
    `with doomed as (\n       select id from security_audit_events\n       where created_at < now() - ($1::text || ' days')::interval\n       order by created_at asc\n       limit 5000\n     )\n     delete from security_audit_events e\n     using doomed d\n     where e.id = d.id\n     returning e.id`,
    [String(days)],
  );
  const toolRuns = await client.query(
    `with doomed as (\n       select id from tool_runs\n       where created_at < now() - ($1::text || ' days')::interval\n       order by created_at asc\n       limit 5000\n     )\n     delete from tool_runs t\n     using doomed d\n     where t.id = d.id\n     returning t.id`,
    [String(days)],
  );
  const rateLimits = await client.query(
    `delete from rate_limit_buckets where expires_at <= now() returning bucket_key`,
  );
  const idempotency = await client.query(
    `delete from idempotency_keys where expires_at <= now() returning id`,
  );
  const workflowEvents = await client.query(
    `with doomed as (
       select id from workflow_events
       where created_at < now() - ($1::text || ' days')::interval
       order by created_at asc
       limit 5000
     )
     delete from workflow_events e
     using doomed d
     where e.id = d.id
     returning e.id`,
    [String(days)],
  );
  const aiRuns = await client.query(
    `with doomed as (
       select id from ai_runs
       where created_at < now() - ($1::text || ' days')::interval
       order by created_at asc
       limit 5000
     )
     delete from ai_runs a
     using doomed d
     where a.id = d.id
     returning a.id`,
    [String(days)],
  );
  const executionAttemptEvents = await client.query(
    `with doomed as (
       select e.id
       from workflow_execution_attempt_events e
       join workflow_execution_attempts a on a.id = e.attempt_id
       where a.status <> 'running'
         and e.created_at < now() - ($1::text || ' days')::interval
       order by e.created_at asc
       limit 5000
     )
     delete from workflow_execution_attempt_events e
     using doomed d
     where e.id = d.id
     returning e.id`,
    [String(days)],
  );
  const executionAttempts = await client.query(
    `with doomed as (
       select id from workflow_execution_attempts
       where status <> 'running'
         and acquired_at < now() - ($1::text || ' days')::interval
       order by acquired_at asc
       limit 5000
     )
     delete from workflow_execution_attempts a
     using doomed d
     where a.id = d.id
     returning a.id`,
    [String(days)],
  );
  const chatTurns = await client.query(
    `delete from chat_turns
     where expires_at <= now()
     returning id`,
  );
  await client.query('commit');
  console.log(JSON.stringify({
    securityAuditDeleted: audit.rowCount ?? 0,
    toolRunsDeleted: toolRuns.rowCount ?? 0,
    expiredRateLimitBucketsDeleted: rateLimits.rowCount ?? 0,
    expiredIdempotencyKeysDeleted: idempotency.rowCount ?? 0,
    workflowEventsDeleted: workflowEvents.rowCount ?? 0,
    aiRunsDeleted: aiRuns.rowCount ?? 0,
    executionAttemptEventsDeleted: executionAttemptEvents.rowCount ?? 0,
    executionAttemptsDeleted: executionAttempts.rowCount ?? 0,
    retentionDays: days,
  }, null, 2));
} catch (error) {
  try { await client.query('rollback'); } catch {}
  throw error;
} finally {
  client.release();
  await pool.end();
}
