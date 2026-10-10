#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const script = readFileSync(new URL('./recover-stale-workflows.mjs', import.meta.url), 'utf8');
const lease = readFileSync(new URL('../lib/workflow-execution-lease.ts', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

assert.equal(pkg.version, '1.74.0');
assert.match(script, /workflow_execution_leases/);
assert.match(script, /lease_state/);
assert.match(script, /lease_state === 'active'/);
assert.match(script, /for update/);
assert.match(script, /delete from workflow_execution_leases/);
assert.match(script, /expiredLeaseReleased/);
assert.match(script, /lease\.rows\[0\]\.attempt_id/);
assert.match(script, /status = 'recovered'/);
assert.match(script, /insert into workflow_execution_attempt_events \(attempt_id, workflow_id, user_id, event_type, details, sequence_no\)/);
assert.match(script, /coalesce\(max\(sequence_no\), 0\) \+ 1/);
assert.match(script, /select id, workflow_id, user_id, status, created_at[\s\S]*for update/);
assert.match(script, /select workflow_id[\s\S]*where workflow_id = \$1 and expires_at > now\(\)[\s\S]*for update/);
assert.match(script, /update ai_runs[\s\S]*status = 'failed'/);
assert.match(lease, /select id, user_id[\s\S]*for update/);
assert.match(lease, /from workflows[\s\S]*for update/);
assert.match(lease, /withTransaction/);

console.log('NEXA stale recovery tests passed.');
