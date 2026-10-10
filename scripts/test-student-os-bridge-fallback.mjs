#!/usr/bin/env node
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import ts from 'typescript';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [pkgText, fallbackSource, routeSource, providerSource, readme] = await Promise.all([
  read('package.json'),
  read('lib/student-os-bridge-fallback-core.ts'),
  read('app/api/integrations/student-os/route.ts'),
  read('lib/nexa-provider.ts'),
  read('README.md'),
]);
const pkg = JSON.parse(pkgText);

assert.equal(pkg.name, 'nexa-1-73');
assert.equal(pkg.version, '1.73.0');
assert.equal(
  pkg.scripts['test:student-os-bridge-fallback'],
  'node scripts/test-student-os-bridge-fallback.mjs',
);
assert.match(pkg.scripts.test, /test:student-os-bridge-fallback/);
assert.match(readme, /NEXA 1\.69\.0 — Deterministic Student OS Fallback Signaling/);

assert.match(fallbackSource, /STUDENT_OS_BRIDGE_FALLBACK_CONTRACT_VERSION = '1\.0'/);
assert.match(fallbackSource, /STUDENT_OS_BRIDGE_FALLBACK_MODE = 'student-os-deterministic'/);
assert.match(fallbackSource, /STUDENT_OS_BRIDGE_FALLBACK_AUTHORITY = 'student-os-learning-intelligence'/);
assert.match(providerSource, /NEXA_PROVIDER_CONTRACT_VERSION = '1\.0'/);
assert.match(providerSource, /NEXA_STUDENT_OS_ACADEMIC_AUTHORITY = 'student-os-learning-intelligence'/);

assert.match(routeSource, /createStudentOsBridgeFallbackDirective/);
assert.match(routeSource, /return jsonResponse\(\{ \.\.\.failure, fallback \}/);
assert.match(routeSource, /'X-NEXA-Bridge-Fallback': STUDENT_OS_BRIDGE_FALLBACK_MODE/);
assert.match(routeSource, /'X-NEXA-Bridge-Fallback-Contract': STUDENT_OS_BRIDGE_FALLBACK_CONTRACT_VERSION/);

const operationalPos = routeSource.indexOf('enforceStudentOsBridgeOperationalAdmission()');
const fallbackPos = routeSource.indexOf('createStudentOsBridgeFallbackDirective({');
const admissionPos = routeSource.indexOf('enforceStudentOsBridgeAdmission(envelope.request.userId)');
const claimPos = routeSource.indexOf('claimStudentOsBridgeRequest({');
const providerPos = routeSource.indexOf('createNexaProviderAdapter({');

assert.ok(operationalPos >= 0);
assert.ok(fallbackPos > operationalPos);
assert.ok(admissionPos > fallbackPos, 'Fallback signaling must occur before rate-limit admission.');
assert.ok(claimPos > admissionPos, 'Idempotency claim must remain after operational fallback.');
assert.ok(providerPos > claimPos, 'Model/provider creation must remain behind every admission guard.');

const transpiled = ts.transpileModule(fallbackSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const core = await import(`data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`);

const reasons = [
  'ai_gateway_missing',
  'ai_gateway_timeout',
  'ai_gateway_authentication_failed',
  'ai_gateway_credits_exhausted',
  'ai_gateway_model_unavailable',
  'ai_gateway_provider_unavailable',
  'ai_gateway_status_unavailable',
];

for (const reason of reasons) {
  const retryable = [
    'ai_gateway_timeout',
    'ai_gateway_provider_unavailable',
    'ai_gateway_status_unavailable',
  ].includes(reason);
  const directive = core.createStudentOsBridgeFallbackDirective({
    reason,
    retryable,
    retryAfterSeconds: retryable ? 30 : null,
  });
  assert.deepEqual(directive, {
    contractVersion: '1.0',
    mode: 'student-os-deterministic',
    academicDecisionAuthority: 'student-os-learning-intelligence',
    reason,
    retryable,
    retryAfterSeconds: retryable ? 30 : null,
  });
  assert.equal(Object.isFrozen(directive), true);
}

assert.equal(
  core.createStudentOsBridgeFallbackDirective({
    reason: 'ai_gateway_timeout',
    retryable: true,
    retryAfterSeconds: 0,
  }).retryAfterSeconds,
  1,
);
assert.equal(
  core.createStudentOsBridgeFallbackDirective({
    reason: 'ai_gateway_timeout',
    retryable: true,
    retryAfterSeconds: 99_999,
  }).retryAfterSeconds,
  3600,
);

let migration043Exists = true;
try {
  await access(new URL('../db/043_student_os_bridge_fallback.sql', import.meta.url));
} catch {
  migration043Exists = false;
}
assert.equal(
  migration043Exists,
  false,
  'Deterministic fallback signaling must not introduce migration 043.',
);

console.log('NEXA Student OS deterministic fallback signaling tests passed.');
