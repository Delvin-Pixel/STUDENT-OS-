#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [pkgText, migration, intelligence, messageSources, chat, conversation, account, agent, ui] = await Promise.all([
  read('package.json'),
  read('db/038_grounded_answer_provenance.sql'),
  read('lib/project-intelligence.ts'),
  read('lib/message-sources.ts'),
  read('app/api/chat/route.ts'),
  read('app/api/conversations/[id]/route.ts'),
  read('lib/account.ts'),
  read('lib/agent.ts'),
  read('components/nexa-chat.tsx'),
]);
const pkg = JSON.parse(pkgText);
assert.equal(pkg.version, '1.67.0');
assert.match(migration, /create table if not exists assistant_message_sources/);
assert.match(migration, /foreign key \(message_id, conversation_id\)/);
assert.match(migration, /foreign key \(conversation_id, user_id\)/);
assert.match(migration, /source_label ~ '\^S/);
assert.match(intelligence, /Grounding sources \(cite these exact labels inline/);
assert.match(intelligence, /sources: groundingSources/);
assert.match(messageSources, /MAX_ASSISTANT_MESSAGE_SOURCES = 12/);
assert.match(messageSources, /on conflict \(message_id, source_order\) do nothing/);
assert.match(chat, /persistAssistantMessageSources/);
assert.match(chat, /projectIntelligence\.sources/);
assert.match(conversation, /from assistant_message_sources/);
assert.match(conversation, /sourcesByMessage/);
assert.match(account, /EXPORT_SCHEMA_VERSION = '1.23'/);
assert.match(account, /'assistant_message_sources'/);
assert.match(agent, /cite the exact labels inline/);
assert.match(ui, /Sources used/);
assert.match(ui, /message\.sources/);
assert.match(ui, /openConversation\(persistedConversationId\)/);
console.log('NEXA grounded-answer provenance contract tests passed.');
