#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const chat = await readFile(new URL('../app/api/chat/route.ts', import.meta.url), 'utf8');
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

assert.equal(pkg.version, '1.58.0');
assert.match(chat, /where execution_attempt_id = \$1::uuid and role = 'assistant'/);
assert.match(chat, /order by created_at asc, id asc/);
assert.match(chat, /if \(existingAssistant\.rows\[0\]\)/);
assert.match(chat, /assistantMessageId = existingAssistant\.rows\[0\]\.id/);
assert.match(chat, /select a\.id[\s\S]*a\.status = 'running'[\s\S]*for update/);
assert.match(chat, /insert into messages \(conversation_id, role, content, metadata, execution_attempt_id\)/);
assert.match(chat, /assertChatTurnLease\(client/);
assert.match(chat, /completeChatTurn\(user\.id, chatTurnId, chatTurnLease, assistantMessageId, client\)/);
console.log('NEXA exactly-once assistant response commit tests passed.');
