#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const route = readFileSync(new URL('../app/api/conversations/[id]/execution-attempts/route.ts', import.meta.url), 'utf8');
const source = readFileSync(new URL('../lib/conversation-execution-attempts.ts', import.meta.url), 'utf8');
const panel = readFileSync(new URL('../components/activity-panel.tsx', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

assert.equal(pkg.version, '1.56.0');
assert.match(pkg.scripts.test, /test:execution-attempt-history/);
assert.match(route, /requireUser/);
assert.match(route, /enforceUserReadRateLimit/);
assert.match(route, /Invalid cursor/);
assert.match(route, /limit must be an integer from 1 to 100/);
assert.match(route, /Conversation not found/);
assert.match(source, /create table|workflow_execution_attempts/);
assert.match(source, /order by a\.acquired_at desc, a\.id desc/);
assert.match(source, /limit \$\{boundedLimit \+ 1\}/);
assert.match(source, /encodeExecutionAttemptCursor/);
assert.match(source, /decodeExecutionAttemptCursor/);
assert.match(source, /\(a\.acquired_at, a\.id\) < \(\$3::timestamptz, \$4::uuid\)/);
assert.match(panel, /hasLoadedOlderRef/);
assert.match(panel, /hasLoadedOlderAttemptsRef/);
assert.match(panel, /refreshLatest/);
assert.match(panel, /refreshLatestAttempts/);
assert.match(panel, /slice\(0, 300\)/);
assert.match(panel, /loadAttempts/);
assert.match(panel, /Load older attempts/);
assert.match(panel, /View request trace/);

console.log('NEXA execution attempt history tests passed.');
