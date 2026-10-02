#!/usr/bin/env node
import pg from 'pg';

const limit = 100;
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required.');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 10_000 });
const client = await pool.connect();
try {
  await client.query('begin transaction isolation level repeatable read, read only');

  const checks = await Promise.all([
    client.query(`
      select count(*)::int as count
      from workflow_execution_attempts a
      left join workflow_execution_leases l on l.attempt_id = a.id
      where a.status = 'running' and l.workflow_id is null
    `),
    client.query(`
      select count(*)::int as count
      from workflow_execution_leases l
      left join workflow_execution_attempts a on a.id = l.attempt_id
      where l.attempt_id is null or a.id is null
    `),
    client.query(`
      select count(*)::int as count
      from workflow_execution_leases l
      join workflow_execution_attempts a on a.id = l.attempt_id
      where a.workflow_id <> l.workflow_id or a.user_id <> l.user_id or a.request_id <> l.request_id
    `),
    client.query(`
      select count(*)::int as count
      from workflow_execution_leases l
      join workflow_execution_attempts a on a.id = l.attempt_id
      where a.status <> 'running'
    `),
    client.query(`
      select count(*)::int as count
      from workflow_execution_leases l
      join workflows w on w.id = l.workflow_id
      where w.status not in ('running','verifying')
    `),
    client.query(`
      select count(*)::int as count
      from workflow_execution_attempts a
      join workflows w on w.id = a.workflow_id
      where a.status = 'running' and w.status not in ('running','verifying')
    `),
    client.query(`
      select count(*)::int as count
      from workflow_execution_attempt_events e
      left join workflow_execution_attempts a on a.id = e.attempt_id
      where a.id is null or a.workflow_id <> e.workflow_id or a.user_id <> e.user_id
    `),
    client.query(`
      with ranked as (
        select attempt_id, sequence_no,
               lag(sequence_no) over (partition by attempt_id order by sequence_no asc, id asc) as prev_sequence
        from workflow_execution_attempt_events
      )
      select count(*)::int as count
      from ranked
      where (prev_sequence is not null and sequence_no <> prev_sequence + 1) or (prev_sequence is null and sequence_no <> 1)
    `),
    client.query(`
      select count(*)::int as count
      from workflow_execution_attempts a
      where a.status <> 'running'
        and not exists (
          select 1 from workflow_execution_attempt_events e
          where e.attempt_id = a.id and e.event_type = a.status
        )
    `),
    client.query(`
      select count(*)::int as count
      from ai_runs r
      join workflow_execution_attempts a on a.id = r.execution_attempt_id
      where r.execution_attempt_id is not null
        and (r.user_id <> a.user_id or r.workflow_id is distinct from a.workflow_id or r.request_id is distinct from a.request_id)
    `),
    client.query(`
      select count(*)::int as count
      from tool_runs r
      join workflow_execution_attempts a on a.id = r.execution_attempt_id
      where r.execution_attempt_id is not null
        and (r.user_id <> a.user_id or r.workflow_id is distinct from a.workflow_id or r.request_id is distinct from a.request_id)
    `),
    client.query(`
      select count(*)::int as count
      from ai_runs r
      left join workflow_execution_attempts a on a.id = r.execution_attempt_id
      where r.execution_attempt_id is not null and a.id is null
    `),
    client.query(`
      select count(*)::int as count
      from tool_runs r
      left join workflow_execution_attempts a on a.id = r.execution_attempt_id
      where r.execution_attempt_id is not null and a.id is null
    `),
  ]);

  const issues = {
    runningAttemptsWithoutLease: checks[0].rows[0].count,
    leasesWithoutLinkedAttempt: checks[1].rows[0].count,
    leaseAttemptOwnershipMismatches: checks[2].rows[0].count,
    terminalAttemptsWithLease: checks[3].rows[0].count,
    leasesForTerminalWorkflows: checks[4].rows[0].count,
    runningAttemptsOnTerminalWorkflows: checks[5].rows[0].count,
    attemptEventOwnershipMismatches: checks[6].rows[0].count,
    attemptEventSequenceGaps: checks[7].rows[0].count,
    terminalAttemptsWithoutMatchingEvent: checks[8].rows[0].count,
    aiRunAttemptOwnershipMismatches: checks[9].rows[0].count,
    toolRunAttemptOwnershipMismatches: checks[10].rows[0].count,
    aiRunsWithMissingAttempt: checks[11].rows[0].count,
    toolRunsWithMissingAttempt: checks[12].rows[0].count,
  };
  const issueCount = Object.values(issues).reduce((sum, count) => sum + Number(count), 0);

  let samples = [];
  if (issueCount > 0) {
    const sampleResult = await client.query(`
      select a.id, a.workflow_id, a.status, 'running_attempt_without_lease' as issue
      from workflow_execution_attempts a
      left join workflow_execution_leases l on l.attempt_id = a.id
      where a.status = 'running' and l.workflow_id is null
      union all
      select l.attempt_id as id, l.workflow_id, coalesce(a.status, 'missing_attempt') as status, 'lease_without_linked_attempt' as issue
      from workflow_execution_leases l
      left join workflow_execution_attempts a on a.id = l.attempt_id
      where l.attempt_id is null or a.id is null
      union all
      select l.attempt_id as id, l.workflow_id, a.status, 'lease_attempt_ownership_mismatch' as issue
      from workflow_execution_leases l
      join workflow_execution_attempts a on a.id = l.attempt_id
      where a.workflow_id <> l.workflow_id or a.user_id <> l.user_id or a.request_id <> l.request_id
      union all
      select a.id, a.workflow_id, a.status, 'terminal_attempt_with_lease' as issue
      from workflow_execution_attempts a
      join workflow_execution_leases l on l.attempt_id = a.id
      where a.status <> 'running'
      union all
      select l.attempt_id as id, l.workflow_id, w.status, 'lease_for_terminal_workflow' as issue
      from workflow_execution_leases l
      join workflows w on w.id = l.workflow_id
      where w.status not in ('running','verifying')
      limit ${limit}
    `);
    samples = sampleResult.rows;
  }

  await client.query('rollback');
  console.log(JSON.stringify({ healthy: issueCount === 0, issueCount, issues, samples }, null, 2));
  process.exit(issueCount === 0 ? 0 : 2);
} catch (error) {
  try { await client.query('rollback'); } catch {}
  console.error(error instanceof Error ? error.message : 'Execution integrity check failed.');
  process.exit(1);
} finally {
  client.release();
  await pool.end();
}
