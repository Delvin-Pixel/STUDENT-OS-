#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [pkgText, migration, ledger, route, readme] = await Promise.all([
  read('package.json'),
  read('db/040_student_os_bridge_idempotency.sql'),
  read('lib/student-os-bridge-idempotency.ts'),
  read('app/api/integrations/student-os/route.ts'),
  read('README.md'),
]);
const pkg = JSON.parse(pkgText);

assert.equal(pkg.name, 'nexa-1-72');
assert.equal(pkg.version, '1.72.0');
assert.equal(pkg.scripts['test:student-os-bridge-idempotency'], 'node scripts/test-student-os-bridge-idempotency.mjs');
assert.match(pkg.scripts.test, /test:student-os-bridge-idempotency/);
assert.match(readme, /NEXA 1\.62\.0 — Durable Student OS Bridge Idempotency & Replay Safety/);

assert.match(migration, /create table if not exists student_os_bridge_requests/);
assert.match(migration, /primary key \(external_user_id, request_id\)/);
assert.match(migration, /request_hash text not null/);
assert.match(migration, /owner_attempt_id uuid not null/);
assert.match(migration, /lease_expires_at timestamptz not null/);
assert.match(migration, /recovery_count integer not null default 0/);
assert.match(migration, /status in \('running','completed','failed'\)/);

assert.match(ledger, /hashStudentOsBridgeRequest/);
assert.match(ledger, /claimStudentOsBridgeRequest/);
assert.match(ledger, /completeStudentOsBridgeRequest/);
assert.match(ledger, /failStudentOsBridgeRequest/);
assert.match(ledger, /KEY_REUSE_MISMATCH/);
assert.match(ledger, /for update/);
assert.match(ledger, /recovery_count = recovery_count \+ 1/);
assert.match(ledger, /owner_attempt_id = \$4::uuid/);
assert.match(ledger, /lease_expires_at > clock_timestamp\(\)/);

const admissionPos = route.indexOf('enforceStudentOsBridgeAdmission(');
const claimPos = route.indexOf('claimStudentOsBridgeRequest(');
const providerPos = route.indexOf('createNexaProviderAdapter({');
assert.ok(admissionPos >= 0 && claimPos > admissionPos, 'Admission control must run before durable bridge request claim.');
assert.ok(providerPos > claimPos, 'Durable bridge request claim must run before provider/model creation.');
assert.match(route, /X-NEXA-Bridge-Idempotency-Status/);
assert.match(route, /X-NEXA-Bridge-Idempotent-Replayed/);
assert.match(route, /academicContextHeaders\(claim\.body\)/);
assert.match(route, /completeStudentOsBridgeRequest/);
assert.match(route, /failStudentOsBridgeRequest/);
assert.match(route, /mapStudentOsBridgeIdempotencyError/);

console.log('NEXA Student OS bridge idempotency contract tests passed.');
