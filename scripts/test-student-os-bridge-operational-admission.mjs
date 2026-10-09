#!/usr/bin/env node
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import ts from 'typescript';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [pkgText, coreSource, runtimeSource, routeSource, readme] = await Promise.all([
  read('package.json'),
  read('lib/student-os-bridge-operational-admission-core.ts'),
  read('lib/student-os-bridge-operational-admission.ts'),
  read('app/api/integrations/student-os/route.ts'),
  read('README.md'),
]);
const pkg = JSON.parse(pkgText);

assert.equal(pkg.name, 'nexa-1-70');
assert.equal(pkg.version, '1.70.0');
assert.equal(
  pkg.scripts['test:student-os-bridge-operational-admission'],
  'node scripts/test-student-os-bridge-operational-admission.mjs',
);
assert.match(pkg.scripts.test, /test:student-os-bridge-operational-admission/);
assert.match(readme, /NEXA 1\.67\.0 — Student OS Operational Admission Guard/);

assert.match(runtimeSource, /getNexaAiGatewayReadiness/);
assert.match(runtimeSource, /classifyStudentOsBridgeOperationalAdmission/);
assert.doesNotMatch(runtimeSource, /generateText|ToolLoopAgent|streamText|embed\(/);

assert.match(routeSource, /enforceStudentOsBridgeOperationalAdmission/);
assert.match(routeSource, /createNexaProviderFailure/);
assert.match(routeSource, /'unavailable'/);
assert.match(routeSource, /status: 503/);
assert.match(routeSource, /X-NEXA-Bridge-Operational-Status/);
assert.match(routeSource, /X-NEXA-Bridge-Operational-Reason/);

const authPos = routeSource.indexOf('authorizeStudentOsBridge(');
const identityPos = routeSource.indexOf('headerUserId !== envelope.request.userId');
const operationalPos = routeSource.indexOf('enforceStudentOsBridgeOperationalAdmission()');
const admissionPos = routeSource.indexOf('enforceStudentOsBridgeAdmission(envelope.request.userId)');
const claimPos = routeSource.indexOf('claimStudentOsBridgeRequest({');
const providerPos = routeSource.indexOf('createNexaProviderAdapter({');

assert.ok(authPos >= 0 && identityPos > authPos, 'Identity fencing must follow bridge authentication.');
assert.ok(operationalPos > identityPos, 'Operational admission must follow authenticated identity fencing.');
assert.ok(admissionPos > operationalPos, 'Rate-limit admission must not run when Gateway readiness is degraded.');
assert.ok(claimPos > admissionPos, 'Durable idempotency claim must follow operational and rate-limit admission.');
assert.ok(providerPos > claimPos, 'Provider/model creation must remain after all admission and idempotency guards.');

const transpiled = ts.transpileModule(coreSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const core = await import(`data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`);

assert.deepEqual(
  core.classifyStudentOsBridgeOperationalAdmission({ status: 'operational', reason: null }),
  { allowed: true },
);

for (const reason of [
  'ai_gateway_missing',
  'ai_gateway_authentication_failed',
  'ai_gateway_credits_exhausted',
  'ai_gateway_model_unavailable',
]) {
  assert.deepEqual(
    core.classifyStudentOsBridgeOperationalAdmission({ status: 'degraded', reason }),
    {
      allowed: false,
      status: 'degraded',
      reason,
      retryable: false,
      retryAfterSeconds: null,
    },
  );
}

for (const reason of [
  'ai_gateway_timeout',
  'ai_gateway_provider_unavailable',
  'ai_gateway_status_unavailable',
]) {
  assert.deepEqual(
    core.classifyStudentOsBridgeOperationalAdmission({ status: 'degraded', reason }),
    {
      allowed: false,
      status: 'degraded',
      reason,
      retryable: true,
      retryAfterSeconds: 30,
    },
  );
}

assert.deepEqual(
  core.classifyStudentOsBridgeOperationalAdmission({
    status: 'missing',
    reason: 'ai_gateway_missing',
  }),
  {
    allowed: false,
    status: 'missing',
    reason: 'ai_gateway_missing',
    retryable: false,
    retryAfterSeconds: null,
  },
);

let migration042Exists = true;
try {
  await access(new URL('../db/042_student_os_operational_admission.sql', import.meta.url));
} catch {
  migration042Exists = false;
}
assert.equal(
  migration042Exists,
  false,
  'Student OS operational admission must not introduce a database migration.',
);

console.log('NEXA Student OS operational admission guard tests passed.');
