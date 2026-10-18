#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [
  pkgText,
  effectiveCore,
  healthSource,
  admissionCore,
  admissionRuntime,
  readinessSource,
  healthRoute,
  migration047,
  readme,
] = await Promise.all([
  read('package.json'),
  read('lib/supabase-data-api-effective-security-core.ts'),
  read('lib/health.ts'),
  read('lib/student-os-bridge-security-admission-core.ts'),
  read('lib/student-os-bridge-security-admission.ts'),
  read('lib/student-os-bridge-readiness.ts'),
  read('app/api/integrations/student-os/health/route.ts'),
  read('db/047_student_os_bridge_data_api_effective_security.sql'),
  read('README.md'),
]);
const pkg = JSON.parse(pkgText);

assert.equal(pkg.name, 'nexa-1-93');
assert.equal(pkg.version, '1.93.0');
assert.equal(
  pkg.scripts['test:data-api-effective-security'],
  'node scripts/test-data-api-effective-security.mjs',
);
assert.match(pkg.scripts.test, /test:data-api-effective-security/);
assert.match(readme, /NEXA 1\.93\.0 — Effective Data API Security Reconciliation/);

assert.match(healthSource, /classifyNexaDataApiEffectiveSecurity/);
assert.match(healthSource, /dataApiEffectiveSecurity: NexaDataApiEffectiveSecurityStatus/);
assert.match(healthSource, /dataApiEffectiveSecurityReason: NexaDataApiEffectiveSecurityReason/);
assert.match(healthSource, /dataApiEffectiveSecurity\.status === 'secure'/);
assert.doesNotMatch(healthSource, /dataApiIsolation\.status === 'isolated'\s*&&\s*dataApiPlatform/);

assert.match(admissionRuntime, /getNexaDataApiPlatformReadiness/);
assert.match(admissionRuntime, /dataApiPlatformStatus: dataApiPlatform\.status/);
assert.match(admissionCore, /classifyNexaDataApiEffectiveSecurity/);
assert.match(admissionCore, /data_api_platform_unavailable/);

assert.match(readinessSource, /getNexaDataApiPlatformReadiness/);
assert.match(readinessSource, /dataApiEffectiveSecurity/);
assert.match(readinessSource, /dataApiPlatform:/);
assert.match(readinessSource, /classifyNexaDataApiEffectiveSecurity/);
assert.doesNotMatch(
  readinessSource,
  /if \(dataApiIsolation\.status !== 'isolated'\)/,
);

assert.match(healthRoute, /X-NEXA-Bridge-Data-API-Platform/);
assert.match(healthRoute, /X-NEXA-Bridge-Data-API-Effective-Security/);
assert.match(healthRoute, /dataApiEffectiveSecurity: readiness\.dataApiEffectiveSecurity\.status/);

assert.match(migration047, /data_api_platform_unavailable/);
assert.match(migration047, /student_os_bridge_events_operational_reason_check/);
assert.doesNotMatch(migration047, /prompt|response_body|external_user_id|api[_ ]?key|balance/i);

const transpiled = ts.transpileModule(effectiveCore, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const effective = await import(
  `data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`
);

const classify = (platformStatus, isolationStatus) =>
  effective.classifyNexaDataApiEffectiveSecurity({ platformStatus, isolationStatus });

assert.deepEqual(classify('disabled', 'isolated'), { status: 'secure', reason: null });
assert.deepEqual(classify('disabled', 'future-default-risk'), { status: 'secure', reason: null });
assert.deepEqual(classify('disabled', 'exposed'), { status: 'secure', reason: null });
assert.deepEqual(classify('disabled', 'unavailable'), { status: 'secure', reason: null });

assert.deepEqual(classify('enabled', 'isolated'), { status: 'secure', reason: null });
assert.deepEqual(classify('enabled', 'future-default-risk'), {
  status: 'insecure',
  reason: 'data_api_future_default_risk',
});
assert.deepEqual(classify('enabled', 'exposed'), {
  status: 'insecure',
  reason: 'data_api_current_exposure',
});
assert.deepEqual(classify('enabled', 'unavailable'), {
  status: 'unavailable',
  reason: 'data_api_isolation_unavailable',
});
assert.deepEqual(classify('unavailable', 'isolated'), {
  status: 'unavailable',
  reason: 'data_api_platform_unavailable',
});
assert.deepEqual(classify('unavailable', 'future-default-risk'), {
  status: 'unavailable',
  reason: 'data_api_platform_unavailable',
});

for (const result of [
  classify('disabled', 'future-default-risk'),
  classify('enabled', 'exposed'),
  classify('unavailable', 'isolated'),
]) {
  assert.equal(Object.isFrozen(result), true);
}

console.log('NEXA effective Data API security reconciliation tests passed.');
