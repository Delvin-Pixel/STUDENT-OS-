#!/usr/bin/env node
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import ts from 'typescript';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [
  pkgText,
  coreSource,
  effectiveCoreSource,
  runtimeSource,
  routeSource,
  readinessSource,
  healthRouteSource,
  migration045,
  migration046,
  migration047,
  readme,
] = await Promise.all([
  read('package.json'),
  read('lib/student-os-bridge-security-admission-core.ts'),
  read('lib/supabase-data-api-effective-security-core.ts'),
  read('lib/student-os-bridge-security-admission.ts'),
  read('app/api/integrations/student-os/route.ts'),
  read('lib/student-os-bridge-readiness.ts'),
  read('app/api/integrations/student-os/health/route.ts'),
  read('db/045_student_os_bridge_security_admission.sql'),
  read('db/046_student_os_bridge_data_api_security_admission.sql'),
  read('db/047_student_os_bridge_data_api_effective_security.sql'),
  read('README.md'),
]);
const pkg = JSON.parse(pkgText);

assert.equal(pkg.name, 'nexa-1-95');
assert.equal(pkg.version, '1.95.0');
assert.equal(
  pkg.scripts['test:student-os-bridge-security-admission'],
  'node scripts/test-student-os-bridge-security-admission.mjs',
);
assert.match(pkg.scripts.test, /test:student-os-bridge-security-admission/);
assert.match(readme, /NEXA 1\.93\.0 — Effective Data API Security Reconciliation/);
assert.match(readme, /NEXA 1\.89\.0 — Data API–Aware Student OS Bridge Security Admission/);
assert.match(readme, /NEXA 1\.82\.0 — Security-Aware Student OS Bridge Admission/);

for (const reason of [
  'runtime_role_security_violation',
  'runtime_role_security_unavailable',
  'data_api_platform_unavailable',
  'data_api_current_exposure',
  'data_api_future_default_risk',
  'data_api_isolation_unavailable',
]) {
  assert.ok(coreSource.includes(reason), reason);
}
assert.match(runtimeSource, /getNexaRuntimeRoleSecurity/);
assert.match(runtimeSource, /getNexaDataApiPlatformReadiness/);
assert.match(runtimeSource, /getNexaDataApiIsolationReadiness/);
assert.match(runtimeSource, /Promise\.all/);
assert.match(runtimeSource, /classifyStudentOsBridgeSecurityAdmission/);

assert.match(routeSource, /enforceStudentOsBridgeSecurityAdmission/);
assert.match(routeSource, /X-NEXA-Bridge-Security-Status/);
assert.match(routeSource, /X-NEXA-Bridge-Security-Source/);
assert.match(routeSource, /X-NEXA-Bridge-Security-Reason/);
assert.match(routeSource, /X-NEXA-Bridge-Serving-Mode': 'unavailable'/);
assert.match(routeSource, /operationalReason: securityAdmission\.reason/);
assert.match(routeSource, /NEXA security is not ready/);

const parsePos = routeSource.indexOf('parseStudentOsBridgeEnvelope(body)');
const contextPos = routeSource.indexOf('bridgeObservationContext = {');
const securityPos = routeSource.indexOf('enforceStudentOsBridgeSecurityAdmission()');
const gatewayPos = routeSource.indexOf('enforceStudentOsBridgeOperationalAdmission()');
const rateLimitPos = routeSource.indexOf('enforceStudentOsBridgeAdmission(envelope.request.userId)');
const claimPos = routeSource.indexOf('claimStudentOsBridgeRequest({');
const providerPos = routeSource.indexOf('createNexaProviderAdapter({');

assert.ok(parsePos >= 0);
assert.ok(contextPos > parsePos);
assert.ok(securityPos > contextPos);
assert.ok(gatewayPos > securityPos);
assert.ok(rateLimitPos > gatewayPos);
assert.ok(claimPos > rateLimitPos);
assert.ok(providerPos > claimPos);

assert.match(readinessSource, /getNexaRuntimeRoleSecurity/);
assert.match(readinessSource, /getNexaDataApiPlatformReadiness/);
assert.match(readinessSource, /getNexaDataApiIsolationReadiness/);
assert.match(readinessSource, /classifyNexaDataApiEffectiveSecurity/);
assert.match(readinessSource, /classifyStudentOsBridgeSecurityAdmission/);
assert.match(readinessSource, /runtimeRoleSecurity:/);
assert.match(readinessSource, /dataApiPlatform:/);
assert.match(readinessSource, /dataApiIsolation:/);
assert.match(readinessSource, /dataApiEffectiveSecurity:/);
assert.match(readinessSource, /dataApiPlatformStatus: dataApiPlatform\.status/);
assert.match(readinessSource, /dataApiIsolationStatus: dataApiIsolation\.status/);
assert.match(readinessSource, /securityAdmission\.allowed/);
assert.match(healthRouteSource, /X-NEXA-Bridge-Runtime-Security/);
assert.match(healthRouteSource, /X-NEXA-Bridge-Data-API-Platform/);
assert.match(healthRouteSource, /X-NEXA-Bridge-Data-API-Isolation/);
assert.match(healthRouteSource, /X-NEXA-Bridge-Data-API-Effective-Security/);

assert.match(migration045, /runtime_role_security_violation/);
assert.match(migration045, /runtime_role_security_unavailable/);
assert.match(migration046, /data_api_current_exposure/);
assert.match(migration046, /data_api_future_default_risk/);
assert.match(migration046, /data_api_isolation_unavailable/);
assert.match(migration047, /data_api_platform_unavailable/);
assert.doesNotMatch(migration047, /prompt|response_body|external_user_id|api[_ ]?key|balance/i);

const effectiveTranspiled = ts.transpileModule(effectiveCoreSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const effectiveUrl = `data:text/javascript;base64,${Buffer.from(effectiveTranspiled).toString('base64')}`;

const isolatedCoreSource = coreSource.replace(
  "'@/lib/supabase-data-api-effective-security-core'",
  JSON.stringify(effectiveUrl),
);
const transpiled = ts.transpileModule(isolatedCoreSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const core = await import(`data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`);

const classify = (runtimeRoleStatus, dataApiPlatformStatus, dataApiIsolationStatus) =>
  core.classifyStudentOsBridgeSecurityAdmission({
    runtimeRoleStatus,
    dataApiPlatformStatus,
    dataApiIsolationStatus,
  });

assert.deepEqual(classify('secure', 'enabled', 'isolated'), { allowed: true });
assert.deepEqual(classify('secure', 'disabled', 'future-default-risk'), { allowed: true });
assert.deepEqual(classify('secure', 'disabled', 'exposed'), { allowed: true });

assert.deepEqual(classify('insecure', 'disabled', 'isolated'), {
  allowed: false,
  source: 'runtime-role',
  status: 'insecure',
  reason: 'runtime_role_security_violation',
  retryable: false,
  retryAfterSeconds: null,
});
assert.deepEqual(classify('unavailable', 'disabled', 'isolated'), {
  allowed: false,
  source: 'runtime-role',
  status: 'unavailable',
  reason: 'runtime_role_security_unavailable',
  retryable: true,
  retryAfterSeconds: 30,
});
assert.deepEqual(classify('secure', 'enabled', 'exposed'), {
  allowed: false,
  source: 'data-api',
  status: 'insecure',
  reason: 'data_api_current_exposure',
  retryable: false,
  retryAfterSeconds: null,
});
assert.deepEqual(classify('secure', 'enabled', 'future-default-risk'), {
  allowed: false,
  source: 'data-api',
  status: 'insecure',
  reason: 'data_api_future_default_risk',
  retryable: false,
  retryAfterSeconds: null,
});
assert.deepEqual(classify('secure', 'enabled', 'unavailable'), {
  allowed: false,
  source: 'data-api',
  status: 'unavailable',
  reason: 'data_api_isolation_unavailable',
  retryable: true,
  retryAfterSeconds: 30,
});
assert.deepEqual(classify('secure', 'unavailable', 'isolated'), {
  allowed: false,
  source: 'data-api',
  status: 'unavailable',
  reason: 'data_api_platform_unavailable',
  retryable: true,
  retryAfterSeconds: 30,
});
assert.equal(
  classify('insecure', 'enabled', 'exposed').reason,
  'runtime_role_security_violation',
  'Runtime-role security must take precedence when multiple security boundaries fail.',
);

let migration048Exists = true;
try {
  await access(new URL('../db/048_student_os_bridge_security_admission.sql', import.meta.url));
} catch {
  migration048Exists = false;
}
assert.equal(migration048Exists, false);

console.log('NEXA Student OS bridge effective security admission tests passed.');
