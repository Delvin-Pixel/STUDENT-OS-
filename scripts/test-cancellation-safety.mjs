#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const chat = readFileSync(new URL('../app/api/chat/route.ts', import.meta.url), 'utf8');
const workflows = readFileSync(new URL('../lib/workflows.ts', import.meta.url), 'utf8');
const panel = readFileSync(new URL('../components/workflow-panel.tsx', import.meta.url), 'utf8');

assert.match(chat, /select status from workflows where id = \$1 and user_id = \$2 and status in \('running','verifying'\) for update/);
assert.match(chat, /if \(!liveWorkflow\.rows\[0\]\) return false;/);
assert.match(chat, /if \(!checkpointed\) return;/);
assert.match(chat, /workflowCancelled = Boolean\(workflow && liveWorkflow\?\.status === 'cancelled'\)/);
assert.match(chat, /finishReason: workflowCancelled \? 'cancelled'/);
assert.match(chat, /if \(!workflowCancelled && !leaseLost && activeConversationId && text\.trim\(\)\)/);
assert.match(chat, /const beganVerification = await beginVerification/);
assert.match(chat, /if \(!beganVerification\) \{/);
assert.match(chat, /if \(!completed\) \{/);
assert.match(chat, /afterError.*\['queued', 'running', 'verifying'\]/s);
assert.match(workflows, /status in \('queued','running','verifying'\) for update/);
assert.match(workflows, /eventType: 'cancelled'/);
assert.match(panel, /method: 'DELETE'/);
assert.match(panel, /Stopping…/);

console.log('NEXA cancellation safety tests passed.');
