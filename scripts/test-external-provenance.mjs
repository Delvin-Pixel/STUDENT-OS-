#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [pkgText, migration, externalSources, engine, agent, chat, conversation, account, ui] = await Promise.all([
  read('package.json'),
  read('db/039_external_source_provenance.sql'),
  read('lib/external-sources.ts'),
  read('lib/tool-engine.ts'),
  read('lib/agent.ts'),
  read('app/api/chat/route.ts'),
  read('app/api/conversations/[id]/route.ts'),
  read('lib/account.ts'),
  read('components/nexa-chat.tsx'),
]);
const pkg = JSON.parse(pkgText);
assert.equal(pkg.version, '1.68.0');
assert.equal(pkg.name, 'nexa-1-68');
assert.match(migration, /create table if not exists assistant_message_external_sources/);
assert.match(migration, /source_label ~ '\^W\[1-8\]\$'/);
assert.match(migration, /source_url ~ '\^https\?:\/\/'/);
assert.match(migration, /foreign key \(message_id, conversation_id\)/);
assert.match(migration, /foreign key \(conversation_id, user_id\)/);
assert.match(externalSources, /MAX_EXTERNAL_MESSAGE_SOURCES = 8/);
assert.match(externalSources, /normalizeExternalSourceUrl/);
assert.match(externalSources, /collectExternalSourceSnapshots/);
assert.match(externalSources, /persistExternalMessageSources/);
assert.match(externalSources, /\['http:', 'https:'\]/);
assert.match(engine, /tako_search[\s\S]*risk: 'external'/);
assert.match(engine, /tako_search[\s\S]*resultTrust: 'untrusted'/);
assert.match(engine, /collectExternalSourceSnapshots\('tako', result\)/);
assert.match(agent, /onExternalSources/);
assert.match(chat, /persistExternalMessageSources/);
assert.match(chat, /mergeExternalSourceSnapshots/);
assert.match(conversation, /assistant_message_external_sources/);
assert.match(conversation, /source_url as "sourceUrl"/);
assert.match(account, /EXPORT_SCHEMA_VERSION = '1\.23'/);
assert.match(account, /'assistant_message_external_sources'/);
assert.match(ui, /sourceUrl\?: string \| null/);
assert.match(ui, /rel="noreferrer noopener"/);
console.log('NEXA durable external-source provenance contract tests passed.');
