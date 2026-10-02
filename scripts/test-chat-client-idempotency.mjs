#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const chat = await readFile(new URL('../components/nexa-chat.tsx', import.meta.url), 'utf8');
const testScript = await readFile(new URL('../scripts/test-chat-turn-idempotency.mjs', import.meta.url), 'utf8');

assert.equal(pkg.version, '1.58.0');
assert.match(chat, /crypto\.randomUUID\(\)/);
assert.match(chat, /'Idempotency-Key': idempotencyKey/);
assert.match(chat, /for \(let attempt = 0; attempt < 10; attempt \+= 1\)/);
assert.match(chat, /X-NEXA-Idempotency-Status/);
assert.match(chat, /in-progress/);
assert.match(chat, /setTimeout/);
assert.match(chat, /nonRetryableHttp/);
assert.match(chat, /if \(!transportFailed \|\| attempt >= 9\) throw error/);
assert.doesNotMatch(chat, /response = await fetch\('\/api\/chat'/);
assert.match(testScript, /claimChatTurn/);
console.log('NEXA chat client idempotency tests passed.');
