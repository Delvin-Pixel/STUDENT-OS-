#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const script = readFileSync(new URL('./check-execution-integrity.mjs', import.meta.url), 'utf8');
const validate = readFileSync(new URL('./validate.mjs', import.meta.url), 'utf8');
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

assert.equal(packageJson.version, '1.67.0');
assert.match(packageJson.scripts['ops:check-execution'], /check-execution-integrity\.mjs/);
assert.match(packageJson.scripts.test, /test:execution-integrity/);
assert.match(script, /begin transaction isolation level repeatable read, read only/);
assert.match(script, /runningAttemptsWithoutLease/);
assert.match(script, /toolRunsWithMissingAttempt/);
assert.match(script, /aiRunsWithMissingAttempt/);
assert.match(script, /toolRunAttemptOwnershipMismatches/);
assert.match(script, /aiRunAttemptOwnershipMismatches/);
assert.match(script, /a\.request_id <> l\.request_id/);
assert.match(script, /leaseAttemptOwnershipMismatches/);
assert.match(script, /leasesWithoutLinkedAttempt/);
assert.match(script, /terminalAttemptsWithLease/);
assert.match(script, /leasesForTerminalWorkflows/);
assert.match(script, /runningAttemptsOnTerminalWorkflows/);
assert.match(script, /attemptEventOwnershipMismatches/);
assert.match(script, /attemptEventSequenceGaps/);
assert.match(script, /terminalAttemptsWithoutMatchingEvent/);
assert.match(script, /rollback/);
assert.doesNotMatch(script, /\b(insert into|update |delete from)\b/i);
assert.match(validate, /check-execution-integrity\.mjs/);

console.log('NEXA execution integrity tests passed.');
