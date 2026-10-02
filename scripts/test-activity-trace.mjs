#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../lib/conversation-activity-trace.ts', import.meta.url), 'utf8');
const route = readFileSync(new URL('../app/api/conversations/[id]/activity/trace/route.ts', import.meta.url), 'utf8');
const panel = readFileSync(new URL('../components/activity-panel.tsx', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../db/024_activity_trace_indexes.sql', import.meta.url), 'utf8');

assert.match(source, /from tool_runs/);
assert.match(source, /from ai_runs/);
assert.match(source, /conversation_id = \$1 and user_id = \$2 and request_id = \$3/);
assert.match(source, /limit 50/);
assert.doesNotMatch(source, /input_hash|error_message|details/);
assert.match(route, /enforceUserReadRateLimit/);
assert.match(route, /conversation-activity-trace/);
assert.match(route, /requestId/);
assert.match(route, /between 1 and 128 characters/);
assert.match(panel, /activity\/trace\?requestId=/);
assert.match(panel, /View request trace/);
assert.match(panel, /setTrace\(/);
assert.match(panel, /REQUEST TRACE/);
assert.match(migration, /tool_runs_conversation_request_created_idx/);
assert.match(migration, /ai_runs_conversation_request_created_idx/);

console.log('NEXA activity trace tests passed.');
