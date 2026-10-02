#!/usr/bin/env node
import pg from 'pg';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required.');
  process.exit(1);
}

const constraints = [
  ['ai_runs', 'ai_runs_workflow_attempt_presence_ck'],
  ['tool_runs', 'tool_runs_workflow_attempt_presence_ck'],
  ['ai_runs', 'ai_runs_execution_attempt_identity_fk'],
  ['tool_runs', 'tool_runs_execution_attempt_identity_fk'],
];
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 10_000 });
const client = await pool.connect();
try {
  const checks = await Promise.all([
    client.query(`select count(*)::int as count from ai_runs where (workflow_id is null) <> (execution_attempt_id is null)`),
    client.query(`select count(*)::int as count from tool_runs where (workflow_id is null) <> (execution_attempt_id is null)`),
    client.query(`
      select count(*)::int as count
      from ai_runs r
      left join workflow_execution_attempts a
        on a.id = r.execution_attempt_id and a.workflow_id = r.workflow_id and a.user_id = r.user_id
      where r.execution_attempt_id is not null and a.id is null
    `),
    client.query(`
      select count(*)::int as count
      from tool_runs r
      left join workflow_execution_attempts a
        on a.id = r.execution_attempt_id and a.workflow_id = r.workflow_id and a.user_id = r.user_id
      where r.execution_attempt_id is not null and a.id is null
    `),
  ]);
  const issues = {
    aiPresenceMismatches: checks[0].rows[0].count,
    toolPresenceMismatches: checks[1].rows[0].count,
    aiAttemptIdentityMismatches: checks[2].rows[0].count,
    toolAttemptIdentityMismatches: checks[3].rows[0].count,
  };
  const issueCount = Object.values(issues).reduce((sum, value) => sum + Number(value), 0);
  if (issueCount > 0) {
    console.error(JSON.stringify({ validated: false, issueCount, issues }, null, 2));
    process.exitCode = 2;
  } else {
    await client.query('begin');
    try {
      for (const [table, constraint] of constraints) {
        await client.query(`alter table ${table} validate constraint ${constraint}`);
      }
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    }
    const validation = await client.query(`
      select conname, convalidated
      from pg_constraint
      where conname = any($1::text[])
      order by conname
    `, [constraints.map(([, constraint]) => constraint)]);
    const allValidated = validation.rows.length === constraints.length && validation.rows.every((row) => row.convalidated === true);
    if (!allValidated) throw new Error('Telemetry fence validation did not persist for every constraint.');
    console.log(JSON.stringify({ validated: true, constraints: validation.rows.map((row) => row.conname) }, null, 2));
  }
} finally {
  client.release();
  await pool.end();
}
