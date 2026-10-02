#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const activity = readFileSync(new URL('../lib/conversation-activity.ts', import.meta.url), 'utf8');
const route = readFileSync(new URL('../app/api/conversations/[id]/activity/route.ts', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../db/022_conversation_activity_pagination.sql', import.meta.url), 'utf8');

assert.match(activity, /where conversation_id = \$1 and user_id = \$2/);
assert.match(activity, /join workflows w on w.id = e.workflow_id/);
assert.match(activity, /w\.conversation_id = \$1/);
assert.doesNotMatch(activity, /error_message/);
assert.doesNotMatch(activity, /details/);
assert.match(route, /limit must be an integer between 1 and 100/);
assert.match(route, /cursor/);
assert.match(activity, /nextCursor/);
assert.match(activity, /fetchedRows = tools\.rows\.length \+ aiRuns\.rows\.length \+ workflows\.rows\.length/);
assert.match(activity, /const hasMore = fetchedRows > bounded/);
assert.match(activity, /base64url/);
assert.match(migration, /workflow_events_conversation_created_idx/);
assert.match(route, /getRequestId\(request\)/);
assert.match(route, /requestId/);
assert.match(migration, /tool_runs_conversation_created_id_idx/);
assert.match(migration, /ai_runs_conversation_created_id_idx/);

console.log('NEXA conversation activity tests passed.');
