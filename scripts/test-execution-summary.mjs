#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../lib/conversation-execution-summary.ts', import.meta.url), 'utf8');
const route = readFileSync(new URL('../app/api/conversations/[id]/activity/summary/route.ts', import.meta.url), 'utf8');
const panel = readFileSync(new URL('../components/activity-panel.tsx', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../db/023_conversation_execution_summary.sql', import.meta.url), 'utf8');
const livenessMigration = readFileSync(new URL('../db/029_execution_liveness_indexes.sql', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

assert.equal(pkg.version, '1.56.0');
assert.match(source, /from ai_runs/);
assert.match(source, /status = 'running'/);
assert.match(source, /from workflows/);
assert.match(source, /status in \('queued','running','verifying'\)/);
assert.match(source, /now\(\) - interval '2 minutes'/);
assert.match(source, /working: activeAiRuns > 0 \|\| activeWorkflows > 0/);
assert.match(source, /heartbeat_age_ms/);
assert.match(source, /lease_remaining_ms/);
assert.match(source, /healthFor/);
assert.match(source, /heartbeat_delayed/);
assert.match(source, /lease_expired/);
assert.match(source, /degradedExecutions/);
assert.match(source, /liveness:/);
assert.match(source, /NEXA_EXECUTION_HEARTBEAT_GRACE_MS/);
assert.match(source, /heartbeatGraceMs/);
assert.match(panel, /Live execution health/);
assert.match(panel, /Heartbeat grace/);
assert.match(route, /enforceUserReadRateLimit/);
assert.match(route, /conversation-activity-summary/);
assert.match(panel, /NEXA is working/);
assert.match(panel, /activeAiRuns/);
assert.match(panel, /recentToolRuns/);
assert.match(panel, /Execution heartbeat healthy/);
assert.match(panel, /Execution heartbeat needs attention/);
assert.match(migration, /ai_runs_conversation_status_idx/);
assert.match(migration, /workflows_conversation_status_idx/);
assert.match(migration, /tool_runs_conversation_user_created_idx/);
assert.match(livenessMigration, /workflow_execution_attempts_workflow_running_heartbeat_idx/);
assert.match(livenessMigration, /workflow_execution_leases_attempt_expiry_idx/);

console.log('NEXA execution summary tests passed.');
