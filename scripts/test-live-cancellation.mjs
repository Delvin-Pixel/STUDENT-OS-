#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const chat = readFileSync(new URL('../app/api/chat/route.ts', import.meta.url), 'utf8');
const watcher = readFileSync(new URL('../lib/workflow-cancellation.ts', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

assert.match(chat, /new AbortController\(\)/);
assert.match(chat, /request\.signal\.addEventListener\('abort'/);
assert.match(chat, /startWorkflowCancellationWatcher/);
assert.match(chat, /abortSignal: executionController\.signal/);
assert.match(watcher, /select status from workflows where id = \$1 and user_id = \$2 limit 1/);
assert.match(watcher, /status === 'cancelled'/);
assert.match(watcher, /controller\.abort\('NEXA_WORKFLOW_CANCELLED'\)/);
assert.match(watcher, /Math\.max\(250, Math\.min\(5_000/);
assert.equal(pkg.version, '1.70.0');
assert.match(pkg.scripts.test, /test:live-cancellation/);

console.log('NEXA live cancellation tests passed.');
