#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const chat = await readFile(new URL('../app/api/chat/route.ts', import.meta.url), 'utf8');
const conversations = await readFile(new URL('../app/api/conversations/[id]/route.ts', import.meta.url), 'utf8');
const account = await readFile(new URL('../lib/account.ts', import.meta.url), 'utf8');
const migration = await readFile(new URL('../db/032_message_execution_attempts.sql', import.meta.url), 'utf8');
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

assert.equal(pkg.version, '1.69.0');
assert.match(chat, /insert into messages \(conversation_id, role, content, metadata, execution_attempt_id\)/);
assert.match(chat, /a\.status = 'running'/);
assert.match(chat, /where a\.id = \$1 and a\.user_id = \$2 and a\.workflow_id = \$3 and w\.conversation_id = \$4/);
assert.match(chat, /for update/);
assert.match(chat, /workflow \? executionLeaseAttemptId : null/);
assert.match(conversations, /execution_attempt_id/);
assert.match(account, /execution_attempt_id/);
assert.match(migration, /add column if not exists execution_attempt_id/);
console.log('NEXA attempt-fenced assistant message tests passed.');
