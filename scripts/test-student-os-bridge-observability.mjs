#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [pkgText, migration, coreSource, runtimeSource, route, prune, readme] = await Promise.all([
  read('package.json'),
  read('db/041_student_os_bridge_observability.sql'),
  read('lib/student-os-bridge-observability-core.ts'),
  read('lib/student-os-bridge-observability.ts'),
  read('app/api/integrations/student-os/route.ts'),
  read('scripts/prune-ops.mjs'),
  read('README.md'),
]);
const pkg = JSON.parse(pkgText);

assert.equal(pkg.name, 'nexa-1-63');
assert.equal(pkg.version, '1.63.0');
assert.equal(pkg.scripts['test:student-os-bridge-observability'], 'node scripts/test-student-os-bridge-observability.mjs');
assert.match(pkg.scripts.test, /test:student-os-bridge-observability/);
assert.match(readme, /NEXA 1\.63\.0 — Privacy-Bounded Student OS Bridge Observability/);

assert.match(migration, /create table if not exists student_os_bridge_events/);
assert.match(migration, /user_fingerprint text not null/);
assert.doesNotMatch(migration, /external_user_id/);
assert.doesNotMatch(migration, /prompt|response_body|metadata jsonb/i);
assert.match(migration, /event_type in/);
assert.match(migration, /duration_ms integer not null/);
assert.match(migration, /provider_ok boolean/);

assert.match(runtimeSource, /fingerprintStudentOsBridgeUser/);
assert.match(runtimeSource, /insert into student_os_bridge_events/);
assert.doesNotMatch(runtimeSource, /prompt|responseBody|response_body/);
assert.match(runtimeSource, /Bridge observability must never break Student OS request handling/);

for (const event of ['rate_limited','mismatch','in_progress','replayed','claimed','recovered','completed','ownership_lost','failed']) {
  assert.match(route, new RegExp(`observeBridge\\(['"]${event}['"]`));
}
assert.match(prune, /student_os_bridge_events/);
assert.match(prune, /studentOsBridgeEventsDeleted/);

const transpiled = ts.transpileModule(coreSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const core = await import(`data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`);

const secret = 's'.repeat(32);
const left = core.fingerprintStudentOsBridgeUser('student-123', secret);
const right = core.fingerprintStudentOsBridgeUser('student-123', secret);
const other = core.fingerprintStudentOsBridgeUser('student-456', secret);
assert.match(left, /^[0-9a-f]{64}$/);
assert.equal(left, right);
assert.notEqual(left, other);
assert.notEqual(left, 'student-123');
assert.throws(() => core.fingerprintStudentOsBridgeUser('student-123', 'short'));
assert.equal(core.normalizeStudentOsBridgeDurationMs(-10), 0);
assert.equal(core.normalizeStudentOsBridgeDurationMs(123.9), 123);
assert.equal(core.normalizeStudentOsBridgeDurationMs(Number.POSITIVE_INFINITY), 0);

console.log('NEXA Student OS bridge observability contract tests passed.');
