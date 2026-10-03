#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const chat = readFileSync(new URL('../app/api/chat/route.ts', import.meta.url), 'utf8');
const lease = readFileSync(new URL('../lib/workflow-execution-lease.ts', import.meta.url), 'utf8');
const trace = readFileSync(new URL('../lib/conversation-activity-trace.ts', import.meta.url), 'utf8');
const recovery = readFileSync(new URL('./recover-stale-workflows.mjs', import.meta.url), 'utf8');
const prune = readFileSync(new URL('./prune-ops.mjs', import.meta.url), 'utf8');
const account = readFileSync(new URL('../lib/account.ts', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../db/026_workflow_execution_attempts.sql', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

assert.equal(pkg.version, '1.60.0');
assert.match(pkg.scripts.test, /test:execution-attempts/);
assert.match(chat, /executionLeaseAttemptId/);
assert.match(chat, /attemptId: executionLeaseAttemptId/);
assert.match(chat, /X-NEXA-Execution-Attempt-Id/);
assert.match(chat, /status: attemptStatus/);
assert.match(chat, /const completed = await completeWorkflow/);
assert.match(chat, /if \(!completed\)/);
assert.match(lease, /workflow_execution_attempts/);
assert.match(lease, /attemptId/);
assert.match(lease, /'lease_lost'/);
assert.match(lease, /withTransaction/);
assert.match(lease, /on conflict \(workflow_id\) do update/);
assert.match(trace, /workflow_execution_attempts/);
assert.match(trace, /terminalReason/);
assert.match(recovery, /workflow_execution_attempts/);
assert.match(recovery, /status = 'recovered'/);
assert.match(prune, /workflow_execution_attempts/);
assert.match(prune, /executionAttemptsDeleted/);
assert.match(account, /EXPORT_SCHEMA_VERSION = '1.23'/);
assert.match(account, /workflow_execution_attempts/);
assert.match(migration, /create table if not exists workflow_execution_attempts/);
assert.match(migration, /status text not null check/);
assert.match(migration, /unique\(workflow_id, request_id\)/);
assert.match(migration, /add column if not exists attempt_id/);
assert.match(migration, /workflow_execution_leases_attempt_idx/);
assert.match(chat, /executionAttemptId: executionLeaseAttemptId/);

console.log('NEXA execution attempt ledger tests passed.');
