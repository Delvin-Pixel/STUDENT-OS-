#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const correlation = await readFile(new URL('../lib/execution-attempt-correlation.ts', import.meta.url), 'utf8');
const ai = await readFile(new URL('../lib/ai-runs.ts', import.meta.url), 'utf8');
const tools = await readFile(new URL('../lib/tool-engine.ts', import.meta.url), 'utf8');
const agent = await readFile(new URL('../lib/agent.ts', import.meta.url), 'utf8');
const chat = await readFile(new URL('../app/api/chat/route.ts', import.meta.url), 'utf8');
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

assert.equal(pkg.version, '1.73.0');
assert.match(correlation, /ExecutionAttemptCorrelationError/);
assert.match(correlation, /workflow_execution_attempts/);
assert.match(correlation, /join workflows w on w\.id = a\.workflow_id/);
assert.match(correlation, /for share/);
assert.match(correlation, /row\.user_id !== input\.userId/);
assert.match(correlation, /row\.workflow_id !== workflowId/);
assert.match(correlation, /row\.conversation_id \?\? null/);
assert.match(ai, /withTransaction/);
assert.match(ai, /assertExecutionAttemptCorrelation/);
assert.match(ai, /execution_attempt_id/);
assert.match(tools, /withTransaction/);
assert.match(tools, /assertExecutionAttemptCorrelation/);
assert.match(tools, /workflowId\?: string \| null/);
assert.match(tools, /execution_attempt_id/);
assert.match(agent, /executionAttemptId\?: string \| null/);
assert.match(chat, /executionAttemptId: executionLeaseAttemptId/);

console.log('NEXA exact execution-attempt correlation guard tests passed.');
