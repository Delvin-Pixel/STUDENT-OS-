#!/usr/bin/env node
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import ts from 'typescript';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [pkgText, coreSource, healthSource, bridgeSource, routeSource, readme] = await Promise.all([
  read('package.json'),
  read('lib/supabase-data-api-remediation-closure-core.ts'),
  read('lib/health.ts'),
  read('lib/student-os-bridge-readiness.ts'),
  read('app/api/integrations/student-os/health/route.ts'),
  read('README.md'),
]);
const pkg = JSON.parse(pkgText);

assert.equal(pkg.name, 'nexa-1-97');
assert.equal(pkg.version, '1.97.0');
assert.equal(
  pkg.scripts['test:data-api-remediation-closure'],
  'node scripts/test-data-api-remediation-closure.mjs',
);
assert.match(pkg.scripts.test, /test:data-api-remediation-closure/);
assert.match(readme, /NEXA 1\.97\.0 — Data API Remediation Closure Readiness/);

for (const token of [
  'closed','open','verification-required',
  'no-remediation-required','owner-action-pending','security-review-pending',
  'platform-verification-pending','isolation-verification-pending',
  'remediation-verification-pending',
  'securityBoundaryClosed','requiresHumanAction','requiresVerification',
]) assert.match(coreSource, new RegExp(token));

for (const token of [
  'dataApiRemediationClosureStatus',
  'dataApiRemediationClosureReason',
  'dataApiRemediationSecurityBoundaryClosed',
  'dataApiRemediationClosureRequiresVerification',
]) assert.match(healthSource, new RegExp(token));

assert.match(bridgeSource, /dataApiRemediationClosure:/);

for (const header of [
  'X-NEXA-Bridge-Data-API-Remediation-Closure-Status',
  'X-NEXA-Bridge-Data-API-Remediation-Closure-Reason',
  'X-NEXA-Bridge-Data-API-Remediation-Security-Boundary-Closed',
  'X-NEXA-Bridge-Data-API-Remediation-Closure-Requires-Verification',
]) assert.match(routeSource, new RegExp(header));

assert.doesNotMatch(
  coreSource,
  /riskyDefaultOwnerCount|alterableRiskyDefaultOwnerCount|protectedRiskyDefaultOwnerCount|owner_name|rolname|api[_ -]?key|credential|prompt|response_body/i,
);

const closureSurface = [healthSource, bridgeSource, routeSource]
  .flatMap((source) => source.split('\n'))
  .filter((line) => /dataApiRemediationClosure|Remediation-Closure/.test(line))
  .join('\n');

assert.doesNotMatch(
  closureSurface,
  /riskyDefaultOwnerCount|alterableRiskyDefaultOwnerCount|protectedRiskyDefaultOwnerCount|owner_name|rolname|api[_ -]?key|credential|prompt|response_body/i,
);

const transpiled = ts.transpileModule(coreSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const core = await import(`data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`);

assert.deepEqual(
  core.classifyNexaDataApiRemediationClosure({
    status: 'no-action',
    recommendedAction: 'none',
  }),
  {
    status: 'closed',
    reason: 'no-remediation-required',
    securityBoundaryClosed: true,
    requiresHumanAction: false,
    requiresVerification: false,
  },
);

assert.deepEqual(
  core.classifyNexaDataApiRemediationClosure({
    status: 'owner-action-required',
    recommendedAction: 'disable-data-api-in-dashboard',
  }),
  {
    status: 'open',
    reason: 'owner-action-pending',
    securityBoundaryClosed: false,
    requiresHumanAction: true,
    requiresVerification: true,
  },
);

assert.deepEqual(
  core.classifyNexaDataApiRemediationClosure({
    status: 'security-review-required',
    recommendedAction: 'review-current-data-api-exposure',
  }),
  {
    status: 'open',
    reason: 'security-review-pending',
    securityBoundaryClosed: false,
    requiresHumanAction: true,
    requiresVerification: true,
  },
);

for (const [recommendedAction, expectedReason] of [
  ['verify-data-api-platform-state', 'platform-verification-pending'],
  ['verify-data-api-isolation-attestation', 'isolation-verification-pending'],
  ['verify-data-api-remediation-attestation', 'remediation-verification-pending'],
]) {
  assert.deepEqual(
    core.classifyNexaDataApiRemediationClosure({
      status: 'unavailable',
      recommendedAction,
    }),
    {
      status: 'verification-required',
      reason: expectedReason,
      securityBoundaryClosed: false,
      requiresHumanAction: false,
      requiresVerification: true,
    },
  );
}

assert.equal(
  Object.isFrozen(
    core.classifyNexaDataApiRemediationClosure({
      status: 'no-action',
      recommendedAction: 'none',
    }),
  ),
  true,
);

let migration048Exists = true;
try {
  await access(new URL('../db/048_data_api_remediation_closure.sql', import.meta.url));
} catch {
  migration048Exists = false;
}
assert.equal(
  migration048Exists,
  false,
  'Data API remediation closure readiness must not introduce migration 048.',
);

console.log('NEXA Data API remediation closure readiness tests passed.');
