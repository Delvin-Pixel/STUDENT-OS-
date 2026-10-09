#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [pkgText, migration041, migration042, coreSource, runtimeSource, route, prune, readme] = await Promise.all([
  read('package.json'),
  read('db/041_student_os_bridge_observability.sql'),
  read('db/042_student_os_bridge_operational_observability.sql'),
  read('lib/student-os-bridge-observability-core.ts'),
  read('lib/student-os-bridge-observability.ts'),
  read('app/api/integrations/student-os/route.ts'),
  read('scripts/prune-ops.mjs'),
  read('README.md'),
]);
const pkg = JSON.parse(pkgText);

assert.equal(pkg.name, 'nexa-1-68');
assert.equal(pkg.version, '1.68.0');
assert.equal(pkg.scripts['test:student-os-bridge-observability'], 'node scripts/test-student-os-bridge-observability.mjs');
assert.match(pkg.scripts.test, /test:student-os-bridge-observability/);
assert.match(readme, /NEXA 1\.68\.0 — Privacy-Bounded Operational Rejection Observability/);
assert.match(readme, /NEXA 1\.63\.0 — Privacy-Bounded Student OS Bridge Observability/);

assert.match(migration041, /create table if not exists student_os_bridge_events/);
assert.match(migration041, /user_fingerprint text not null/);
assert.doesNotMatch(migration041, /external_user_id/);
assert.doesNotMatch(migration041, /prompt|response_body|metadata jsonb/i);
assert.match(migration041, /duration_ms integer not null/);
assert.match(migration041, /provider_ok boolean/);

assert.match(migration042, /add column operational_reason text/);
assert.match(migration042, /operational_rejected/);
assert.match(migration042, /ai_gateway_credits_exhausted/);
assert.match(migration042, /student_os_bridge_events_operational_reason_event_check/);
assert.match(migration042, /where operational_reason is not null/);
assert.doesNotMatch(migration042, /balance|api[_ ]?key|prompt|response_body|external_user_id/i);

assert.match(coreSource, /'operational_rejected'/);
assert.match(runtimeSource, /fingerprintStudentOsBridgeUser/);
assert.match(runtimeSource, /operational_reason/);
assert.match(runtimeSource, /operationalReason/);
assert.match(runtimeSource, /insert into student_os_bridge_events/);
assert.doesNotMatch(runtimeSource, /prompt|responseBody|response_body/);
assert.match(runtimeSource, /Bridge observability must never break Student OS request handling/);

for (const event of ['rate_limited','mismatch','in_progress','replayed','completed','ownership_lost','failed','operational_rejected']) {
  assert.match(route, new RegExp(`observeBridge\\(['"]${event}['"]`));
}
assert.match(route, /operationalReason: operationalAdmission\.reason/);
assert.match(route, /claim\.recovered \? 'recovered' : 'claimed'/);
assert.match(prune, /student_os_bridge_events/);
assert.match(prune, /studentOsBridgeEventsDeleted/);

const transpiled = ts.transpileModule(coreSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const core = await import(`data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`);

assert.ok(core.STUDENT_OS_BRIDGE_EVENT_TYPES.includes('operational_rejected'));
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
