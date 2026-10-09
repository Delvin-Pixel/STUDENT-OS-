#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const chat = readFileSync(new URL('../app/api/chat/route.ts', import.meta.url), 'utf8');
const lease = readFileSync(new URL('../lib/workflow-execution-lease.ts', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../db/025_workflow_execution_leases.sql', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

assert.equal(pkg.version, '1.67.0');
assert.match(pkg.scripts.test, /test:execution-lease/);
assert.match(chat, /acquireWorkflowExecutionLease/);
assert.match(chat, /This workflow is already being executed by another request/);
assert.match(chat, /startWorkflowExecutionLeaseHeartbeat/);
assert.match(chat, /NEXA_WORKFLOW_LEASE_LOST/);
assert.match(chat, /leaseLost = executionController\.signal\.reason === 'NEXA_WORKFLOW_LEASE_LOST'/);
assert.match(chat, /if \(workflow && !leaseLost\)/);
assert.match(chat, /if \(!workflowCancelled && !leaseLost && activeConversationId && text\.trim\(\)\)/);
assert.match(chat, /if \(!workflowCancelled && !leaseLost && workflow\)/);
assert.match(chat, /releaseWorkflowExecutionLease/);
assert.match(lease, /on conflict \(workflow_id\) do update/);
assert.match(lease, /expires_at > clock_timestamp\(\)/);
assert.match(lease, /expired before ownership was replaced/);
assert.match(lease, /requestId/);
assert.match(lease, /Math\.max\(10_000, Math\.min\(120_000/);
assert.match(lease, /Math\.max\(1_000, Math\.min\(30_000/);
assert.match(migration, /create table if not exists workflow_execution_leases/);
assert.match(migration, /expires_at timestamptz not null/);
assert.match(migration, /workflow_execution_leases_expires_idx/);

console.log('NEXA execution lease tests passed.');

assert.match(lease, /terminalStatus/);
assert.match(lease, /status !== 'running'/);
assert.match(lease, /currentAttempt\.rows\[0\]\.status !== 'running'[\s\S]*terminalStatus/);
assert.match(lease, /delete from workflow_execution_leases[\s\S]*terminalStatus/);
assert.match(lease, /sameActiveRequest/);
assert.match(chat, /execution request has already reached a terminal state/);
