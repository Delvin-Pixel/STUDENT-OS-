#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const panel = readFileSync(new URL('../components/activity-panel.tsx', import.meta.url), 'utf8');
const route = readFileSync(new URL('../app/api/conversations/[id]/activity/route.ts', import.meta.url), 'utf8');
const chat = readFileSync(new URL('../components/nexa-chat.tsx', import.meta.url), 'utf8');
const rateLimit = readFileSync(new URL('../lib/rate-limit.ts', import.meta.url), 'utf8');

assert.match(panel, /activity\?limit=60/);
assert.match(panel, /setInterval\([^\n]*5000/);
assert.match(panel, /Load older activity/);
assert.match(panel, /nextCursor/);
assert.match(panel, /const loadOlder = useCallback/);
assert.match(panel, /cursor=\$\{encodeURIComponent\(nextCursor\)\}/);
assert.match(panel, /setItems\(\(current\) =>/);
assert.match(panel, /private prompts/);
assert.doesNotMatch(panel, /toolArguments|rawArguments/);
assert.match(route, /enforceUserReadRateLimit/);
assert.match(route, /conversation-activity/);
assert.match(route, /30/);
assert.match(rateLimit, /enforceUserReadRateLimit/);
assert.match(chat, /ActivityPanel/);
assert.match(chat, /view === 'activity'/);

console.log('NEXA activity UI tests passed.');

assert.match(panel, /View attempt details/);
assert.match(panel, /loadAttemptDetail/);
assert.match(panel, /Load older events/);
assert.match(panel, /Execution attempt details/);