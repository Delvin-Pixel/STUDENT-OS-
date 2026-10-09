#!/usr/bin/env node
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import ts from 'typescript';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [pkgText, coreSource, admissionSource, routeSource, readinessSource, envExample, readme] = await Promise.all([
  read('package.json'),
  read('lib/student-os-bridge-admission-core.ts'),
  read('lib/student-os-bridge-admission.ts'),
  read('app/api/integrations/student-os/route.ts'),
  read('lib/student-os-bridge-readiness.ts'),
  read('.env.local.example'),
  read('README.md'),
]);
const pkg = JSON.parse(pkgText);

assert.equal(pkg.name, 'nexa-1-71');
assert.equal(pkg.version, '1.71.0');
assert.equal(pkg.scripts['test:student-os-bridge-admission'], 'node scripts/test-student-os-bridge-admission.mjs');
assert.match(pkg.scripts.test, /test:student-os-bridge-admission/);
assert.match(readme, /NEXA 1\.61\.0 — Student OS Bridge Admission Control & Cost Protection/);

for (const variable of [
  'NEXA_STUDENT_OS_BRIDGE_GLOBAL_LIMIT_PER_MINUTE',
  'NEXA_STUDENT_OS_BRIDGE_USER_LIMIT_PER_MINUTE',
  'NEXA_STUDENT_OS_BRIDGE_USER_LIMIT_PER_HOUR',
]) {
  assert.match(envExample, new RegExp(variable));
}

assert.match(admissionSource, /student-os-bridge-global-minute/);
assert.match(admissionSource, /student-os-bridge-user-minute/);
assert.match(admissionSource, /student-os-bridge-user-hour/);
assert.match(admissionSource, /windowSeconds: 60/);
assert.match(admissionSource, /windowSeconds: 60 \* 60/);
assert.match(routeSource, /enforceStudentOsBridgeAdmission/);
assert.match(routeSource, /X-NEXA-Bridge-Limit-Scope/);
assert.match(routeSource, /Retry-After/);
assert.match(readinessSource, /admission_control_invalid/);
assert.match(readinessSource, /rate_limit_secret_missing/);

const authPos = routeSource.indexOf('authorizeStudentOsBridge(');
const identityPos = routeSource.indexOf('headerUserId !== envelope.request.userId');
const admissionPos = routeSource.indexOf('enforceStudentOsBridgeAdmission(');
const providerPos = routeSource.indexOf('createNexaProviderAdapter({');
assert.ok(authPos >= 0 && identityPos > authPos, 'Bridge identity fencing must follow bridge authentication.');
assert.ok(admissionPos > identityPos, 'Admission control must run after authenticated identity fencing.');
assert.ok(providerPos > admissionPos, 'Admission control must complete before the provider/model path is created.');

const transpiled = ts.transpileModule(coreSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const core = await import(`data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`);

assert.deepEqual(
  core.parseStudentOsBridgeAdmissionConfig({}),
  { globalPerMinute: 300, userPerMinute: 30, userPerHour: 300 },
);
assert.deepEqual(
  core.parseStudentOsBridgeAdmissionConfig({
    NEXA_STUDENT_OS_BRIDGE_GLOBAL_LIMIT_PER_MINUTE: '600',
    NEXA_STUDENT_OS_BRIDGE_USER_LIMIT_PER_MINUTE: '40',
    NEXA_STUDENT_OS_BRIDGE_USER_LIMIT_PER_HOUR: '500',
  }),
  { globalPerMinute: 600, userPerMinute: 40, userPerHour: 500 },
);
assert.throws(() => core.parseStudentOsBridgeAdmissionConfig({
  NEXA_STUDENT_OS_BRIDGE_GLOBAL_LIMIT_PER_MINUTE: '0',
}));
assert.throws(() => core.parseStudentOsBridgeAdmissionConfig({
  NEXA_STUDENT_OS_BRIDGE_USER_LIMIT_PER_MINUTE: '301',
}));
assert.throws(() => core.parseStudentOsBridgeAdmissionConfig({
  NEXA_STUDENT_OS_BRIDGE_USER_LIMIT_PER_MINUTE: '50',
  NEXA_STUDENT_OS_BRIDGE_USER_LIMIT_PER_HOUR: '40',
}));

let migration040Exists = true;
try {
  await access(new URL('../db/040_student_os_bridge_admission.sql', import.meta.url));
} catch {
  migration040Exists = false;
}
assert.equal(migration040Exists, false, 'Bridge admission control must reuse the existing durable rate-limit bucket table.');

console.log('NEXA Student OS bridge admission-control tests passed.');
