#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const workflows = await readFile('lib/workflows.ts', 'utf8');
const chat = await readFile('app/api/chat/route.ts', 'utf8');
const checkpoints = await readFile('lib/agent-checkpoints.ts', 'utf8');
const ui = await readFile('components/nexa-chat.tsx', 'utf8');
const authUi = await readFile('components/auth-screen.tsx', 'utf8');

assert.match(workflows, /status = 'running'[\s\S]*status = 'failed'/);
assert.match(workflows, /status = 'verifying'[\s\S]*status = 'running'/);
assert.match(workflows, /status = 'completed'[\s\S]*status = 'verifying'/);
assert.match(workflows, /status in \('queued','running','verifying'\)/);
assert.match(workflows, /status = 'cancelled'/);
assert.match(workflows, /status in \('queued','running'\)/);
assert.match(workflows, /fromStatus, toStatus: 'cancelled'/);
assert.match(workflows, /fromStatus, toStatus: 'failed'/);
assert.match(workflows, /for update/);
assert.match(chat, /resumeWorkflow\(user\.id, workflow\.id, resumeStepOrder\)/);
assert.match(chat, /withTransaction\(async \(client\) => \{/);
assert.match(chat, /upsertCheckpoint\([\s\S]*client,/);
assert.match(checkpoints, /status in \('running','verifying'\)/);
assert.match(checkpoints, /w\.status = 'failed'/);
assert.doesNotMatch(ui, /NEXA 1\.5/);
assert.doesNotMatch(authUi, /NEXA 1\.5/);

console.log('NEXA workflow state consistency tests passed.');
