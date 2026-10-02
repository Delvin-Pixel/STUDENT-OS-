#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const chat = await readFile(new URL('../app/api/chat/route.ts', import.meta.url), 'utf8');
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

assert.equal(pkg.version, '1.55.0');
const claimPos = chat.indexOf('claimChatTurn(');
const lastUserValidationPos = chat.indexOf("if (!lastUser || (!lastUser.content.trim() && attachments.length === 0 && !voice?.transcript))");
const burstEnd = chat.indexOf("if (!burst.allowed) return rateLimitResponse(burst, requestId);") + "if (!burst.allowed) return rateLimitResponse(burst, requestId);".length;
assert.ok(claimPos > lastUserValidationPos, 'Chat turn claim must happen after user-input validation.');
assert.ok(claimPos > burstEnd, 'Chat turn claim must happen after burst rate-limit rejection.');
console.log('NEXA chat turn idempotency ordering tests passed.');
