#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const helper = await readFile(new URL('../lib/chat-turn-idempotency.ts', import.meta.url), 'utf8');
const chat = await readFile(new URL('../app/api/chat/route.ts', import.meta.url), 'utf8');
const workflowLease = await readFile(new URL('../lib/workflow-execution-lease.ts', import.meta.url), 'utf8');
const client = await readFile(new URL('../components/nexa-chat.tsx', import.meta.url), 'utf8');
const migration = await readFile(new URL('../db/034_chat_turn_recovery_leases.sql', import.meta.url), 'utf8');

assert.equal(pkg.version, '1.69.0');
assert.match(helper, /DEFAULT_CHAT_TURN_LEASE_MS = 15_000/);
assert.match(helper, /DEFAULT_CHAT_TURN_HEARTBEAT_MS = 3_000/);
assert.match(helper, /startChatTurnLeaseHeartbeat/);
assert.match(helper, /renewChatTurnLease/);
assert.match(helper, /assertChatTurnLease/);
assert.match(helper, /NEXA_CHAT_TURN_LEASE_LOST/);
assert.match(helper, /leaseIsLive/);
assert.match(helper, /lease_expires_at > clock_timestamp\(\)/);
assert.match(helper, /recovery_count = recovery_count \+ 1/);
assert.match(helper, /consumeChatTurnQuota/);
assert.match(helper, /quota_consumed_at/);
assert.match(helper, /initializeChatTurnInput/);
assert.match(chat, /startChatTurnLeaseHeartbeat/);
assert.match(chat, /assertChatTurnLease\(client/);
assert.match(chat, /completeChatTurn\(user\.id, chatTurnId, chatTurnLease, assistantMessageId, client\)/);
assert.match(chat, /supersedeRequestId: recoveredPreviousRequestId/);
assert.match(workflowLease, /supersedeRequestId\?: string \| null/);
assert.match(workflowLease, /canSupersede/);
assert.match(workflowLease, /superseded by recovered chat-turn ownership/);
assert.match(client, /for \(let attempt = 0; attempt < 10; attempt \+= 1\)/);
assert.match(client, /attempt < 9/);
assert.match(client, /Math\.min\(250 \* 2 \*\* attempt, 3000\)/);
assert.match(migration, /chat_turns_running_lease_idx/);
assert.match(migration, /chat_turns_owner_attempt_idx/);
console.log('NEXA crashed chat-turn recovery tests passed.');
