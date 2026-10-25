#!/usr/bin/env node
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import ts from 'typescript';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [
  pkgText,
  coreSource,
  runtimeSource,
  operatorSource,
  healthSource,
  readme,
] = await Promise.all([
  read('package.json'),
  read('lib/supabase-data-api-isolation-core.ts'),
  read('lib/supabase-data-api-isolation.ts'),
  read('scripts/attest-supabase-data-api-isolation.mjs'),
  read('lib/health.ts'),
  read('README.md'),
]);
const pkg = JSON.parse(pkgText);

assert.equal(pkg.name, 'nexa-1-97');
assert.equal(pkg.version, '1.97.0');
assert.equal(
  pkg.scripts['test:data-api-isolation-readiness'],
  'node scripts/test-data-api-isolation-readiness.mjs',
);
assert.match(pkg.scripts.test, /test:data-api-isolation-readiness/);
assert.match(readme, /NEXA 1\.88\.0 — Supabase Data API Runtime Readiness/);

assert.match(runtimeSource, /NEXA_DATA_API_ISOLATION_CACHE_MS = 60_000/);
assert.match(runtimeSource, /getNexaDataApiIsolationReadiness/);
assert.match(runtimeSource, /future_default_privilege_risk/);
assert.match(runtimeSource, /current_data_api_exposure/);
assert.match(runtimeSource, /attestation_unavailable/);
assert.match(runtimeSource, /classifyNexaDataApiIsolation/);
assert.match(runtimeSource, /pg_default_acl/);
assert.match(runtimeSource, /aclexplode/);
assert.match(runtimeSource, /x\.grantee = 0/);
assert.doesNotMatch(runtimeSource, /automaticRemediation|alter default privileges|grant .* to anon|grant .* to authenticated/i);

assert.match(healthSource, /dataApiIsolation: NexaDataApiIsolationReadinessStatus/);
assert.match(healthSource, /dataApiIsolationReason: NexaDataApiIsolationReadinessReason/);
assert.match(healthSource, /dataApiEffectiveSecurity: NexaDataApiEffectiveSecurityStatus/);
assert.match(healthSource, /dataApiEffectiveSecurityReason: NexaDataApiEffectiveSecurityReason/);
assert.match(healthSource, /getNexaDataApiIsolationReadiness\(\)/);
assert.match(healthSource, /classifyNexaDataApiEffectiveSecurity\(\{/);
assert.match(healthSource, /isolationStatus: dataApiIsolation\.status/);
assert.match(healthSource, /dataApiEffectiveSecurity\.status === 'secure'/);
assert.doesNotMatch(healthSource, /dataApiIsolation\.status === 'isolated'/);
assert.doesNotMatch(
  healthSource,
  /currentSchemaExposures|currentTableExposures|currentSequenceExposures|currentFunctionExposures|publicDefaultAclExposures|publicDefaultAclGrantOptions/,
);

function normalizedSql(source, pattern) {
  const match = source.match(pattern);
  assert.ok(match, 'Expected SQL block was not found.');
  return match[1].replace(/\s+/g, ' ').trim();
}

const runtimeSql = normalizedSql(
  runtimeSource,
  /query<NexaDataApiIsolationRow>\(\`([\s\S]*?)\`\)/,
);
const operatorSql = normalizedSql(
  operatorSource,
  /const result = await pool\.query\(\`([\s\S]*?)\`\);/,
);
assert.equal(runtimeSql, operatorSql, 'Runtime readiness must use the exact operator attestation SQL.');

const transpiled = ts.transpileModule(coreSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const core = await import(`data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`);

const isolated = {
  current_schema_exposures: 0,
  current_table_exposures: 0,
  current_sequence_exposures: 0,
  current_function_exposures: 0,
  public_default_acl_exposures: 0,
  public_default_acl_grant_options: 0,
};
assert.equal(core.classifyNexaDataApiIsolation(isolated), 'isolated');
assert.equal(
  core.classifyNexaDataApiIsolation({ ...isolated, public_default_acl_exposures: 1 }),
  'future-default-risk',
);
assert.equal(
  core.classifyNexaDataApiIsolation({ ...isolated, current_table_exposures: 1 }),
  'exposed',
);

let migration046Exists = true;
try {
  await access(new URL('../db/046_data_api_runtime_readiness.sql', import.meta.url));
} catch {
  migration046Exists = false;
}
assert.equal(
  migration046Exists,
  false,
  'Data API runtime readiness must not introduce migration 046.',
);

console.log('NEXA Supabase Data API runtime readiness tests passed.');
