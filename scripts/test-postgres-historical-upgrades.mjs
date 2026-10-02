#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required.');
  process.exit(1);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dbDir = path.join(root, 'db');
const schema = `nexa_upgrade_${process.pid}_${Date.now()}`.replace(/[^a-zA-Z0-9_]/g, '_');
const ident = `"${schema.replaceAll('"', '""')}"`;
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 10_000 });
const client = await pool.connect();

async function apply(number) {
  const prefix = String(number).padStart(3, '0') + '_';
  const { readdir } = await import('node:fs/promises');
  const name = (await readdir(dbDir)).find((entry) => entry.startsWith(prefix) && entry.endsWith('.sql'));
  assert.ok(name, `Missing migration ${prefix}`);
  await client.query(await readFile(path.join(dbDir, name), 'utf8'));
}

try {
  await client.query(`create schema ${ident}`);
  await client.query(`set search_path to ${ident}, public`);
  for (let i = 1; i <= 27; i += 1) await apply(i);

  const user = (await client.query(`insert into users(email,name,password_hash) values ('upgrade@nexa.local','Upgrade','x') returning id`)).rows[0];
  const workflow = (await client.query(`
    insert into workflows(user_id,title,request,workflow_type,status)
    values ($1,'Upgrade fixture','verify historical upgrade','general','running') returning id
  `, [user.id])).rows[0];
  const attempt = (await client.query(`
    insert into workflow_execution_attempts(workflow_id,user_id,request_id,status)
    values ($1,$2,'upgrade-request','running') returning id
  `, [workflow.id, user.id])).rows[0];
  const eventTime = new Date('2026-01-01T00:00:00.000Z');
  for (const eventType of ['acquired', 'recovered', 'acquired']) {
    await client.query(`
      insert into workflow_execution_attempt_events(attempt_id,workflow_id,user_id,event_type,created_at)
      values ($1,$2,$3,$4,$5)
    `, [attempt.id, workflow.id, user.id, eventType, eventTime]);
  }

  await apply(28);
  const sequences = (await client.query(`
    select sequence_no from workflow_execution_attempt_events where attempt_id = $1 order by sequence_no
  `, [attempt.id])).rows.map((row) => Number(row.sequence_no));
  assert.deepEqual(sequences, [1, 2, 3], 'Migration 028 must backfill stable contiguous event sequences.');

  await apply(29);
  await apply(30);
  const legacyAi = (await client.query(`
    insert into ai_runs(user_id,workflow_id,model,status) values ($1,$2,'test/model','running') returning id
  `, [user.id, workflow.id])).rows[0];
  const legacyTool = (await client.query(`
    insert into tool_runs(user_id,tool_name,status,execution_attempt_id) values ($1,'upgrade-tool','success',$2) returning id
  `, [user.id, attempt.id])).rows[0];

  await apply(31);
  const preValidation = await client.query(`
    select conname, convalidated from pg_constraint
    where conname in ('ai_runs_workflow_attempt_presence_ck','tool_runs_workflow_attempt_presence_ck','ai_runs_execution_attempt_identity_fk','tool_runs_execution_attempt_identity_fk')
      and conrelid in ('ai_runs'::regclass, 'tool_runs'::regclass)
  `);
  assert.equal(preValidation.rows.length, 4);
  assert.ok(preValidation.rows.every((row) => row.convalidated === false), 'Migration 031 constraints must start NOT VALID.');

  await assert.rejects(
    client.query(`insert into ai_runs(user_id,workflow_id,model,status) values ($1,$2,'test/model','running')`, [user.id, workflow.id]),
    (error) => error?.code === '23514',
    'Migration 031 must fence new presence mismatches immediately.',
  );
  await assert.rejects(
    client.query(`alter table ai_runs validate constraint ai_runs_workflow_attempt_presence_ck`),
    (error) => error?.code === '23514',
    'Historical invalid rows must block validation until repaired.',
  );

  await client.query(`update ai_runs set execution_attempt_id = $1 where id = $2`, [attempt.id, legacyAi.id]);
  await client.query(`update tool_runs set workflow_id = $1 where id = $2`, [workflow.id, legacyTool.id]);
  for (const [table, constraint] of [
    ['ai_runs','ai_runs_workflow_attempt_presence_ck'],
    ['tool_runs','tool_runs_workflow_attempt_presence_ck'],
    ['ai_runs','ai_runs_execution_attempt_identity_fk'],
    ['tool_runs','tool_runs_execution_attempt_identity_fk'],
  ]) {
    await client.query(`alter table ${table} validate constraint ${constraint}`);
  }
  const postValidation = await client.query(`
    select conname, convalidated from pg_constraint
    where conname in ('ai_runs_workflow_attempt_presence_ck','tool_runs_workflow_attempt_presence_ck','ai_runs_execution_attempt_identity_fk','tool_runs_execution_attempt_identity_fk')
      and conrelid in ('ai_runs'::regclass, 'tool_runs'::regclass)
  `);
  assert.ok(postValidation.rows.every((row) => row.convalidated === true), 'Repaired historical telemetry must validate cleanly.');

  await apply(32);
  await apply(33);
  const staleTurn = (await client.query(`
    insert into chat_turns(user_id,idempotency_key,request_hash,status,updated_at)
    values ($1,'upgrade-turn-key','${'a'.repeat(64)}','running',clock_timestamp() - interval '60 seconds')
    returning id, updated_at
  `, [user.id])).rows[0];
  await apply(34);
  const upgradedTurn = (await client.query(`
    select owner_request_id, owner_attempt_id, heartbeat_at, lease_expires_at, recovery_count, updated_at
    from chat_turns where id = $1
  `, [staleTurn.id])).rows[0];
  assert.match(upgradedTurn.owner_request_id, /^legacy-/);
  assert.ok(upgradedTurn.owner_attempt_id);
  assert.equal(Number(upgradedTurn.recovery_count), 0);
  assert.equal(new Date(upgradedTurn.heartbeat_at).getTime(), new Date(upgradedTurn.updated_at).getTime());
  assert.equal(new Date(upgradedTurn.lease_expires_at).getTime(), new Date(upgradedTurn.updated_at).getTime() + 30_000);
  const expired = await client.query(`select lease_expires_at < clock_timestamp() as expired from chat_turns where id = $1`, [staleTurn.id]);
  assert.equal(expired.rows[0].expired, true, 'A stale pre-034 running turn should become immediately recoverable.');

  console.log('Historical PostgreSQL upgrade fixtures passed for migrations 028, 031, and 034.');
} finally {
  try {
    await client.query('reset search_path');
    await client.query(`drop schema if exists ${ident} cascade`);
  } catch {}
  client.release();
  await pool.end();
}
