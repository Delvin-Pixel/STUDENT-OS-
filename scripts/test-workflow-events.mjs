#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migration = await readFile('db/015_workflow_events.sql', 'utf8');
const events = await readFile('lib/workflow-events.ts', 'utf8');
const workflows = await readFile('lib/workflows.ts', 'utf8');
const route = await readFile('app/api/workflows/[id]/route.ts', 'utf8');
const chat = await readFile('app/api/chat/route.ts', 'utf8');
const recover = await readFile('scripts/recover-stale-workflows.mjs', 'utf8');

assert.match(migration, /create table if not exists workflow_events/);
assert.match(migration, /event_type text not null/);
assert.match(migration, /workflow_events_workflow_created_idx/);
assert.match(events, /recordWorkflowEvent/);
assert.match(events, /listWorkflowEvents/);
assert.match(workflows, /eventType: 'created'/);
assert.match(workflows, /eventType: 'started'/);
assert.match(workflows, /eventType: 'resumed'/);
assert.match(workflows, /eventType: 'verifying'/);
assert.match(workflows, /eventType: 'completed'/);
assert.match(workflows, /eventType: 'failed'/);
assert.match(workflows, /eventType: 'cancelled'/);
assert.match(chat, /eventType: 'step_checkpointed'/);
assert.match(route, /listWorkflowEvents/);
assert.match(recover, /process\.argv\.includes\('--execute'\)/);
assert.match(recover, /recovered_stale/);
assert.match(recover, /completed_at = now\(\)/);
assert.match(recover, /status in \('queued','running'\)/);
console.log('NEXA workflow event tests passed.');
