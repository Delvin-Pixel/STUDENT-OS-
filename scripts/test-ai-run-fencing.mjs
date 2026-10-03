#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const ai = await readFile(new URL('../lib/ai-runs.ts', import.meta.url), 'utf8');
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
assert.equal(pkg.version, '1.60.0');
assert.match(ai, /execution_attempt_id/);
assert.match(ai, /workflow_execution_attempts/);
assert.match(ai, /for update/);
assert.match(ai, /executionAttemptId\?: string \| null/);
assert.match(ai, /status = 'running'/);
assert.match(ai, /where id = \$1 and status = 'running'/);
assert.match(ai, /execution_attempt_id = \$8::uuid/);
assert.match(ai, /execution_attempt_id = \$6::uuid/);
assert.match(ai, /finishAiRun/);
assert.match(ai, /failAiRun/);
console.log('NEXA AI execution-attempt fencing tests passed.');
