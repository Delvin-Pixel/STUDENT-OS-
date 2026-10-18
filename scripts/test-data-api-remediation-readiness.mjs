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
  bridgeReadinessSource,
  bridgeHealthRoute,
  operatorSource,
  readme,
] = await Promise.all([
  read('package.json'),
  read('lib/supabase-data-api-remediation-core.ts'),
  read('lib/supabase-data-api-remediation-readiness.ts'),
  read('lib/health.ts'),
  read('lib/student-os-bridge-readiness.ts'),
  read('app/api/integrations/student-os/health/route.ts'),
  read('scripts/plan-supabase-data-api-remediation.mjs'),
  read('README.md'),
]);
const pkg = JSON.parse(pkgText);

assert.equal(pkg.name, 'nexa-1-94');
assert.equal(pkg.version, '1.94.0');
assert.equal(
  pkg.scripts['test:data-api-remediation-readiness'],
  'node scripts/test-data-api-remediation-readiness.mjs',
);
assert.match(pkg.scripts.test, /test:data-api-remediation-readiness/);
assert.match(readme, /NEXA 1\.94\.0 — Data API Remediation Readiness/);

assert.match(runtimeSource, /NEXA_DATA_API_REMEDIATION_READINESS_CACHE_MS = 60_000/);
assert.match(runtimeSource, /getNexaDataApiRemediationReadiness/);
assert.match(runtimeSource, /pg_default_acl/);
assert.match(runtimeSource, /aclexplode/);
assert.match(runtimeSource, /pg_has_role\(current_user, owner\.rolname, 'MEMBER'\)/);
assert.match(runtimeSource, /classifyNexaDataApiRemediationPlan/);
assert.match(runtimeSource, /review-data-api-platform-state/);
assert.match(runtimeSource, /review-remediation-attestation/);
assert.doesNotMatch(runtimeSource, /alter\s+default\s+privileges/i);
assert.doesNotMatch(runtimeSource, /\brevoke\s+/i);
assert.doesNotMatch(runtimeSource, /\bgrant\s+/i);
assert.doesNotMatch(runtimeSource, /api[_ -]?key|prompt|response_body/i);

for (const token of [
  'dataApiRemediationStatus',
  'dataApiRemediationAction',
  'dataApiRemediationSqlFeasibility',
  'dataApiRemediationReason',
]) {
  assert.match(healthSource, new RegExp(token));
}
assert.match(healthSource, /getNexaDataApiRemediationReadiness/);
assert.doesNotMatch(
  healthSource,
  /riskyDefaultOwnerCount|alterableRiskyDefaultOwnerCount|protectedRiskyDefaultOwnerCount|owner_name|rolname/,
);

assert.match(bridgeReadinessSource, /dataApiRemediation:/);
assert.match(bridgeReadinessSource, /recommendedAction/);
assert.match(bridgeReadinessSource, /sqlRemediationFeasibility/);
assert.doesNotMatch(
  bridgeReadinessSource,
  /riskyDefaultOwnerCount|alterableRiskyDefaultOwnerCount|protectedRiskyDefaultOwnerCount/,
);

assert.match(bridgeHealthRoute, /X-NEXA-Bridge-Data-API-Remediation-Status/);
assert.match(bridgeHealthRoute, /X-NEXA-Bridge-Data-API-Remediation-Action/);
assert.match(bridgeHealthRoute, /X-NEXA-Bridge-Data-API-Remediation-SQL-Feasibility/);
assert.doesNotMatch(bridgeHealthRoute, /owner_name|rolname|riskyDefaultOwnerCount/);

for (const token of [
  'pg_default_acl',
  'alterable_risky_default_owner_count',
  'disable-data-api-in-dashboard',
  'automaticRemediation: false',
]) {
  assert.ok(operatorSource.includes(token), token);
}

const transpiled = ts.transpileModule(coreSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const core = await import(`data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`);

const protectedPlan = core.classifyNexaDataApiRemediationPlan({
  isolationStatus: 'future-default-risk',
  riskyDefaultOwnerCount: 1,
  alterableRiskyDefaultOwnerCount: 0,
});
assert.deepEqual(protectedPlan, {
  status: 'owner-action-required',
  recommendedAction: 'disable-data-api-in-dashboard',
  sqlRemediationFeasibility: 'blocked-by-default-owner',
  automaticRemediation: false,
  currentExposure: false,
  futureDefaultRisk: true,
  riskyDefaultOwnerCount: 1,
  alterableRiskyDefaultOwnerCount: 0,
  protectedRiskyDefaultOwnerCount: 1,
});
assert.equal(Object.isFrozen(protectedPlan), true);

const alterablePlan = core.classifyNexaDataApiRemediationPlan({
  isolationStatus: 'future-default-risk',
  riskyDefaultOwnerCount: 1,
  alterableRiskyDefaultOwnerCount: 1,
});
assert.equal(alterablePlan.status, 'owner-action-required');
assert.equal(alterablePlan.recommendedAction, 'disable-data-api-in-dashboard');
assert.equal(
  alterablePlan.sqlRemediationFeasibility,
  'technically-possible-but-automatic-remediation-disabled',
);
assert.equal(alterablePlan.automaticRemediation, false);

const isolatedPlan = core.classifyNexaDataApiRemediationPlan({
  isolationStatus: 'isolated',
  riskyDefaultOwnerCount: 0,
  alterableRiskyDefaultOwnerCount: 0,
});
assert.equal(isolatedPlan.status, 'no-action');
assert.equal(isolatedPlan.recommendedAction, 'none');
assert.equal(isolatedPlan.sqlRemediationFeasibility, 'not-needed');

let migration048Exists = true;
try {
  await access(new URL('../db/048_data_api_remediation_readiness.sql', import.meta.url));
} catch {
  migration048Exists = false;
}
assert.equal(
  migration048Exists,
  false,
  'Data API remediation readiness must not introduce migration 048.',
);

console.log('NEXA Data API remediation readiness tests passed.');
