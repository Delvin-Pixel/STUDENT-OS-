#!/usr/bin/env node
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import ts from 'typescript';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [
  pkgText,
  coreSource,
  runtimeSource,
  healthSource,
  securityAdmissionSource,
  envExample,
  readme,
] = await Promise.all([
  read('package.json'),
  read('lib/supabase-data-api-platform-core.ts'),
  read('lib/supabase-data-api-platform.ts'),
  read('lib/health.ts'),
  read('lib/student-os-bridge-security-admission.ts'),
  read('.env.local.example'),
  read('README.md'),
]);
const pkg = JSON.parse(pkgText);

assert.equal(pkg.name, 'nexa-1-91');
assert.equal(pkg.version, '1.91.0');
assert.equal(
  pkg.scripts['test:data-api-platform-readiness'],
  'node scripts/test-data-api-platform-readiness.mjs',
);
assert.match(pkg.scripts.test, /test:data-api-platform-readiness/);
assert.match(readme, /NEXA 1\.91\.0 — Supabase Data API Platform-State Readiness/);

for (const token of [
  'NEXA_DATA_API_PLATFORM_CACHE_MS = 60_000',
  "new URL('/rest/v1/'",
  "Accept: 'application/openapi+json'",
  'apikey: endpoint.apiKey',
  'response.body?.cancel()',
  'AbortSignal.timeout',
  '/^[a-z0-9]{20}\\.supabase\\.co$/',
]) {
  assert.ok(runtimeSource.includes(token), token);
}

assert.doesNotMatch(runtimeSource, /response\.json\(|response\.text\(|\.table\(|from\(['"]/);
assert.doesNotMatch(runtimeSource, /service_role|secret[_ -]?key/i);
assert.match(envExample, /NEXA_SUPABASE_URL=/);
assert.match(envExample, /NEXA_SUPABASE_PUBLISHABLE_KEY=/);
assert.match(envExample, /NEXA_SUPABASE_DATA_API_PROBE_TIMEOUT_MS=5000/);

assert.match(healthSource, /dataApiPlatform: NexaDataApiPlatformStatus/);
assert.match(healthSource, /dataApiPlatformReason: NexaDataApiPlatformReason/);
assert.match(healthSource, /getNexaDataApiPlatformReadiness\(\)/);
assert.match(healthSource, /dataApiPlatform\.status !== 'unavailable'/);
assert.match(healthSource, /dataApiIsolation\.status === 'isolated'/);

assert.doesNotMatch(
  securityAdmissionSource,
  /supabase-data-api-platform|getNexaDataApiPlatformReadiness|dataApiPlatform/,
);

const transpiled = ts.transpileModule(coreSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const core = await import(`data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`);

const cases = [
  [{ configured: false, httpStatus: null, failed: false }, ['unavailable', 'configuration_missing']],
  [{ configured: true, httpStatus: null, failed: true }, ['unavailable', 'probe_failed']],
  [{ configured: true, httpStatus: 200, failed: false }, ['enabled', null]],
  [{ configured: true, httpStatus: 204, failed: false }, ['enabled', null]],
  [{ configured: true, httpStatus: 404, failed: false }, ['disabled', null]],
  [{ configured: true, httpStatus: 410, failed: false }, ['disabled', null]],
  [{ configured: true, httpStatus: 401, failed: false }, ['unavailable', 'credential_rejected']],
  [{ configured: true, httpStatus: 403, failed: false }, ['unavailable', 'credential_rejected']],
  [{ configured: true, httpStatus: 500, failed: false }, ['unavailable', 'unexpected_status']],
];
for (const [input, expected] of cases) {
  const result = core.classifyNexaDataApiPlatformProbe(input);
  assert.equal(result.status, expected[0]);
  assert.equal(result.reason, expected[1]);
  assert.equal(Object.isFrozen(result), true);
}

let migration047Exists = true;
try {
  await access(new URL('../db/047_data_api_platform_readiness.sql', import.meta.url));
} catch {
  migration047Exists = false;
}
assert.equal(
  migration047Exists,
  false,
  'Data API platform-state readiness must not introduce migration 047.',
);

console.log('NEXA Supabase Data API platform-state readiness tests passed.');
