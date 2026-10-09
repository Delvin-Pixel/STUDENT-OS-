#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const lease = readFileSync(new URL('../lib/workflow-execution-lease.ts', import.meta.url), 'utf8');
const recovery = readFileSync(new URL('./recover-stale-workflows.mjs', import.meta.url), 'utf8');
const trace = readFileSync(new URL('../lib/conversation-activity-trace.ts', import.meta.url), 'utf8');
const account = readFileSync(new URL('../lib/account.ts', import.meta.url), 'utf8');
const prune = readFileSync(new URL('./prune-ops.mjs', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../db/027_workflow_execution_attempt_events.sql', import.meta.url), 'utf8');
const sequenceMigration = readFileSync(new URL('../db/028_execution_attempt_event_sequences.sql', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

assert.equal(pkg.version, '1.70.0');
assert.match(migration, /create table if not exists workflow_execution_attempt_events/);
assert.match(migration, /event_type text not null check/);
assert.match(sequenceMigration, /add column if not exists sequence_no bigint/);
assert.match(migration, /event_type text not null check/);
assert.match(lease, /recordWorkflowExecutionAttemptEvent/);
assert.match(lease, /eventType: 'acquired'/);
assert.match(lease, /eventType: input.status/);
assert.match(lease, /eventType: 'lease_lost'/);
assert.match(lease, /if \(attempt\.rows\[0\]\.status !== 'running'\)/);
assert.match(lease, /select id, status[\s\S]*for update/);
assert.match(lease, /eventType: input.status/);
assert.match(lease, /completed_at = now\(\)/);
assert.match(recovery, /workflow_execution_attempt_events/);
assert.match(recovery, /'recovered'/);
assert.match(trace, /from workflow_execution_attempt_events/);
assert.match(trace, /limit 50/);
assert.match(account, /fetchCollection\(client, 'workflow_execution_attempt_events'/);
assert.match(prune, /workflow_execution_attempt_events/);
assert.match(prune, /status <> 'running'/);

console.log('NEXA execution attempt lifecycle event tests passed.');

assert.match(lease, /coalesce\(max\(sequence_no\), 0\) \+ 1/);
assert.match(sequenceMigration, /workflow_execution_attempt_events_attempt_sequence_idx/);
assert.match(trace, /sequenceNo/);
