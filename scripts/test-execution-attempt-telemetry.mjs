#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync(new URL('../db/030_execution_attempt_telemetry.sql', import.meta.url), 'utf8');
const fences = readFileSync(new URL('../db/031_execution_telemetry_fences.sql', import.meta.url), 'utf8');
const ai = readFileSync(new URL('../lib/ai-runs.ts', import.meta.url), 'utf8');
const tools = readFileSync(new URL('../lib/tool-engine.ts', import.meta.url), 'utf8');
const agent = readFileSync(new URL('../lib/agent.ts', import.meta.url), 'utf8');
const chat = readFileSync(new URL('../app/api/chat/route.ts', import.meta.url), 'utf8');
const activity = readFileSync(new URL('../lib/conversation-activity.ts', import.meta.url), 'utf8');
const trace = readFileSync(new URL('../lib/conversation-activity-trace.ts', import.meta.url), 'utf8');
const account = readFileSync(new URL('../lib/account.ts', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

assert.equal(pkg.version, '1.72.0');
assert.match(migration, /alter table ai_runs/);
assert.match(migration, /alter table tool_runs/);
assert.match(migration, /add column if not exists execution_attempt_id uuid references workflow_execution_attempts/);
assert.match(migration, /ai_runs_execution_attempt_created_idx/);
assert.match(migration, /tool_runs_execution_attempt_created_idx/);
assert.match(fences, /alter table tool_runs[\s\S]*add column if not exists workflow_id uuid references workflows/);
assert.match(fences, /tool_runs_workflow_created_idx/);
assert.match(ai, /executionAttemptId\?: string \| null/);
assert.match(ai, /execution_attempt_id/);
assert.match(tools, /executionAttemptId\?: string \| null/);
assert.match(tools, /execution_attempt_id/);
assert.match(tools, /insert into tool_runs \(user_id, conversation_id, project_id, workflow_id, request_id, execution_attempt_id/);
assert.match(tools, /input\.workflowId \?\? null/);
assert.match(agent, /executionAttemptId\?: string \| null/);
assert.match(chat, /executionAttemptId: executionLeaseAttemptId/);
assert.match(activity, /execution_attempt_id/);
assert.match(trace, /execution_attempt_id/);
assert.match(account, /execution_attempt_id/);

console.log('NEXA execution attempt telemetry tests passed.');
