#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const route = readFileSync(new URL('../app/api/conversations/[id]/execution-attempts/[attemptId]/route.ts', import.meta.url), 'utf8');
const source = readFileSync(new URL('../lib/conversation-execution-attempts.ts', import.meta.url), 'utf8');
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

assert.equal(packageJson.version, '1.71.0');
assert.match(packageJson.scripts.test, /test:execution-attempt-detail/);
assert.match(route, /requireUser/);
assert.match(route, /conversation-execution-attempt-detail/);
assert.match(route, /Invalid execution attempt id/);
assert.match(route, /\[1-5\]\[0-9a-fA-F\]/);
assert.match(route, /Invalid cursor/);
assert.match(route, /Execution attempt not found/);
assert.match(source, /getConversationExecutionAttemptDetail/);
assert.match(source, /join workflows w on w.id = a.workflow_id/);
assert.match(source, /join conversations c on c.id = w.conversation_id/);
assert.match(source, /where a\.id = \$1::uuid and a\.user_id = \$2/);
assert.match(source, /order by e\.sequence_no asc, e\.id asc/);
assert.match(source, /limit \$\{boundedLimit \+ 1\}/);
assert.match(source, /encodeExecutionAttemptEventCursor/);
assert.match(source, /decodeExecutionAttemptEventCursor/);
assert.match(source, /UUID_RE/);
assert.match(source, /nextCursor/);
assert.doesNotMatch(source, /details: event\.details/);

console.log('NEXA execution attempt detail tests passed.');
