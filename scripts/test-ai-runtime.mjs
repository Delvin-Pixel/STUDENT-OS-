#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const runtime = await readFile(new URL('../lib/ai-runtime.ts', import.meta.url), 'utf8');
const agent = await readFile(new URL('../lib/agent.ts', import.meta.url), 'utf8');
const chat = await readFile(new URL('../app/api/chat/route.ts', import.meta.url), 'utf8');
const migration = await readFile(new URL('../db/018_ai_runs.sql', import.meta.url), 'utf8');
const account = await readFile(new URL('../lib/account.ts', import.meta.url), 'utf8');
const prune = await readFile(new URL('../scripts/prune-ops.mjs', import.meta.url), 'utf8');
const recovery = await readFile(new URL('../scripts/recover-stale-workflows.mjs', import.meta.url), 'utf8');

assert.match(runtime, /NEXA_MODEL/);
assert.match(runtime, /NEXA_AI_TOTAL_TIMEOUT_MS/);
assert.match(runtime, /NEXA_AI_STEP_TIMEOUT_MS/);
assert.match(runtime, /NEXA_AI_CHUNK_TIMEOUT_MS/);
assert.match(runtime, /NEXA_AI_MAX_RETRIES/);
assert.match(agent, /timeout: runtime\.timeout/);
assert.match(agent, /maxRetries: runtime\.maxRetries/);
assert.match(chat, /startAiRun/);
assert.match(chat, /finishAiRun/);
assert.match(chat, /failAiRun/);
assert.match(migration, /create table if not exists ai_runs/);
assert.match(migration, /request_id text/);
assert.match(account, /fetchCollection\(client, 'ai_runs'/);
assert.match(account, /EXPORT_SCHEMA_VERSION = '1.23'/);
assert.match(prune, /delete from ai_runs/);
assert.match(prune, /aiRunsDeleted/);
assert.match(recovery, /from ai_runs/);
assert.match(recovery, /StaleRunRecovery/);
const aiRuns = await readFile(new URL('../lib/ai-runs.ts', import.meta.url), 'utf8');
assert.equal((aiRuns.match(/where id = \$1 and status = 'running'/g) ?? []).length, 2);
assert.match(recovery, /where a\.status = 'running'/);
console.log('NEXA AI runtime contract tests passed.');
