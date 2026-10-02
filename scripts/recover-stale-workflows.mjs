#!/usr/bin/env node
import pg from 'pg';

const minutesIndex = process.argv.indexOf('--minutes');
const minutes = minutesIndex >= 0 ? Number(process.argv[minutesIndex + 1]) : 30;
const execute = process.argv.includes('--execute');
if (!Number.isInteger(minutes) || minutes < 5 || minutes > 1440) {
  console.error('--minutes must be an integer from 5 to 1440.');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required.');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 10_000 });
const client = await pool.connect();
try {
  const stale = await client.query(
    `select w.id, w.user_id, w.status, w.updated_at,
            l.request_id as lease_request_id,
            l.attempt_id as lease_attempt_id,
            l.expires_at as lease_expires_at,
            case
              when l.workflow_id is null then 'none'
              when l.expires_at > now() then 'active'
              else 'expired'
            end as lease_state
     from workflows w
     left join workflow_execution_leases l on l.workflow_id = w.id
     where w.status in ('running','verifying')
       and w.updated_at < now() - ($1::text || ' minutes')::interval
     order by w.updated_at asc
     limit 100`,
    [String(minutes)],
  );
  const staleAiRuns = await client.query(
    `select a.id, a.user_id, a.workflow_id, a.model, a.created_at,
            case
              when a.workflow_id is null then 'none'
              when l.workflow_id is null then 'expired_or_missing'
              else 'active'
            end as workflow_lease_state
     from ai_runs a
     left join workflow_execution_leases l
       on l.workflow_id = a.workflow_id
      and l.expires_at > now()
     where a.status = 'running'
       and a.created_at < now() - ($1::text || ' minutes')::interval
       and (a.workflow_id is null or l.workflow_id is null)
     order by a.created_at asc
     limit 100`,
    [String(minutes)],
  );
  if (!execute) {
    console.log(JSON.stringify({
      dryRun: true,
      minutes,
      workflows: stale.rows,
      aiRuns: staleAiRuns.rows,
      deferredActiveLeases: stale.rows.filter((row) => row.lease_state === 'active').length,
    }, null, 2));
  } else {
    let recovered = 0;
    let deferred = 0;
    let expiredLeasesReleased = 0;
    await client.query('begin');
    try {
      for (const candidate of stale.rows) {
        const current = await client.query(
          `select id, user_id, status, updated_at
           from workflows
           where id = $1 and user_id = $2
           for update`,
          [candidate.id, candidate.user_id],
        );
        if (!current.rows[0] || !['running', 'verifying'].includes(current.rows[0].status)) continue;

        const lease = await client.query(
          `select request_id, attempt_id, expires_at
           from workflow_execution_leases
           where workflow_id = $1
           for update`,
          [candidate.id],
        );
        if (lease.rows[0] && new Date(lease.rows[0].expires_at).getTime() > Date.now()) {
          deferred += 1;
          continue;
        }
        if (lease.rows[0]) {
          if (lease.rows[0].attempt_id) {
            const recoveredAttempt = await client.query(
              `select id, workflow_id, user_id, status
               from workflow_execution_attempts
               where id = $1
               for update`,
              [lease.rows[0].attempt_id],
            );
            if (recoveredAttempt.rows[0]?.status === 'running') {
              const nextSequence = await client.query(
                `select coalesce(max(sequence_no), 0) + 1 as sequence_no
                 from workflow_execution_attempt_events
                 where attempt_id = $1`,
                [recoveredAttempt.rows[0].id],
              );
              await client.query(
                `insert into workflow_execution_attempt_events (attempt_id, workflow_id, user_id, event_type, details, sequence_no)
                 values ($1, $2, $3, 'recovered', $4::jsonb, $5)`,
                [recoveredAttempt.rows[0].id, recoveredAttempt.rows[0].workflow_id, recoveredAttempt.rows[0].user_id, JSON.stringify({ reason: 'Recovered as stale by operator maintenance.' }), nextSequence.rows[0]?.sequence_no ?? 1],
              );
              await client.query(
                `update workflow_execution_attempts
                 set status = 'recovered', terminal_reason = 'Recovered as stale by operator maintenance.', completed_at = now()
                 where id = $1 and status = 'running'`,
                [recoveredAttempt.rows[0].id],
              );
            }
          }
          await client.query('delete from workflow_execution_leases where workflow_id = $1', [candidate.id]);
          expiredLeasesReleased += 1;
        }

        const updated = await client.query(
          `update workflows
           set status = 'failed', result_summary = 'Recovered as stale by operator maintenance.', updated_at = now(), completed_at = now()
           where id = $1 and user_id = $2 and status in ('running','verifying')
           returning id, status`,
          [candidate.id, candidate.user_id],
        );
        if (!updated.rows[0]) continue;
        await client.query(
          `update workflow_steps
           set status = 'failed', completed_at = now(), output = output || jsonb_build_object('error','Recovered as stale by operator maintenance.')
           where workflow_id = $1 and status in ('queued','running')`,
          [candidate.id],
        );
        await client.query(
          `insert into workflow_events (workflow_id, user_id, event_type, from_status, to_status, details)
           values ($1, $2, 'recovered_stale', $3, 'failed', $4::jsonb)`,
          [candidate.id, candidate.user_id, current.rows[0].status, JSON.stringify({ staleMinutes: minutes, recoveredAt: new Date().toISOString(), expiredLeaseReleased: Boolean(lease.rows[0]), executionAttemptRecovered: Boolean(lease.rows[0]?.attempt_id) })],
        );
        recovered += 1;
      }
      await client.query('commit');
    } catch (error) {
      try { await client.query('rollback'); } catch {}
      throw error;
    }
    const aiCandidates = await client.query(
      `select a.id, a.workflow_id, a.user_id
       from ai_runs a
       where a.status = 'running'
         and a.created_at < now() - ($1::text || ' minutes')::interval
       order by a.created_at asc
       limit 100`,
      [String(minutes)],
    );
    let aiRunsRecovered = 0;
    for (const candidate of aiCandidates.rows) {
      await client.query('begin');
      try {
        const ai = await client.query(
          `select id, workflow_id, user_id, status, created_at
           from ai_runs
           where id = $1 and status = 'running'
           for update`,
          [candidate.id],
        );
        if (!ai.rows[0]) {
          await client.query('commit');
          continue;
        }

        if (ai.rows[0].workflow_id) {
          const workflow = await client.query(
            `select id, user_id
             from workflows
             where id = $1 and user_id = $2
             for update`,
            [ai.rows[0].workflow_id, ai.rows[0].user_id],
          );
          if (workflow.rows[0]) {
            const lease = await client.query(
              `select workflow_id
               from workflow_execution_leases
               where workflow_id = $1 and expires_at > now()
               for update`,
              [ai.rows[0].workflow_id],
            );
            if (lease.rows[0]) {
              await client.query('commit');
              continue;
            }
          }
        }

        const updated = await client.query(
          `update ai_runs
           set status = 'failed', error_name = 'StaleRunRecovery', completed_at = now()
           where id = $1 and status = 'running'
           returning id`,
          [ai.rows[0].id],
        );
        aiRunsRecovered += updated.rowCount ?? 0;
        await client.query('commit');
      } catch (error) {
        try { await client.query('rollback'); } catch {}
        throw error;
      }
    }
    console.log(JSON.stringify({
      dryRun: false,
      minutes,
      workflowCandidates: stale.rows.length,
      recovered,
      deferredActiveLeases: deferred,
      expiredLeasesReleased,
      aiRunCandidates: staleAiRuns.rows.length,
      aiRunsRecovered,
    }, null, 2));
  }
} finally {
  client.release();
  await pool.end();
}
