#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const route = await readFile(new URL('../app/api/conversations/[id]/execution-attempts/[attemptId]/trace/route.ts', import.meta.url), 'utf8');
const source = await readFile(new URL('../lib/conversation-execution-attempt-trace.ts', import.meta.url), 'utf8');
const panel = await readFile(new URL('../components/activity-panel.tsx', import.meta.url), 'utf8');
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

assert.equal(pkg.version, '1.57.0');
assert.match(pkg.scripts.test, /test:execution-attempt-trace/);
assert.match(route, /requireUser/);
assert.match(route, /conversation-execution-attempt-trace/);
assert.match(route, /conversation-execution-attempt-trace/);
assert.match(route, /Invalid execution attempt id/);
assert.match(route, /Invalid cursor/);
assert.match(route, /Execution attempt not found/);
assert.match(route, /enforceUserReadRateLimit/);
assert.match(source, /getConversationExecutionAttemptTrace/);
assert.match(source, /workflow_execution_attempt_events/);
assert.match(source, /ai_runs/);
assert.match(source, /tool_runs/);
assert.match(source, /execution_attempt_id/);
assert.match(source, /KIND_RANK/);
assert.match(source, /snapshotAt: string; createdAt: string; id: string; kind/);
assert.match(source, /set transaction isolation level repeatable read/);
assert.match(source, /set transaction read only/);
assert.match(source, /created_at <= \$4::timestamptz/);
assert.match(source, /lifecycle/);
assert.match(source, /ai/);
assert.match(source, /tool/);
assert.match(source, /rows\.length \+ ai\.rows\.length \+ tools\.rows\.length > boundedLimit/);
assert.doesNotMatch(source, /error_message/);
assert.doesNotMatch(source, /input_hash/);
assert.doesNotMatch(source, /details: /);
assert.match(panel, /loadAttemptTrace/);
assert.match(panel, /loadOlderAttemptTrace/);
assert.match(panel, /Open attempt trace/);
assert.match(panel, /ATTEMPT TRACE/);
assert.match(panel, /Snapshot/);
assert.match(panel, /Load older trace events/);

console.log('NEXA execution attempt trace tests passed.');
