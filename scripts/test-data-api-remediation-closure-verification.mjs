#!/usr/bin/env node
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [pkgText, verifierSource, plannerSource, readme] = await Promise.all([
  read('package.json'),
  read('scripts/verify-data-api-remediation-closure.mjs'),
  read('scripts/plan-supabase-data-api-remediation.mjs'),
  read('README.md'),
]);
const pkg = JSON.parse(pkgText);

assert.equal(pkg.name, 'nexa-1-98');
assert.equal(pkg.version, '1.98.0');
assert.equal(
  pkg.scripts['ops:verify-data-api-remediation-closure'],
  'node scripts/verify-data-api-remediation-closure.mjs',
);
assert.equal(
  pkg.scripts['test:data-api-remediation-closure-verification'],
  'node scripts/test-data-api-remediation-closure-verification.mjs',
);
assert.match(pkg.scripts.test, /test:data-api-remediation-closure-verification/);
assert.match(readme, /NEXA 1\.98\.0 — Data API Remediation Closure Verification Command/);

assert.match(verifierSource, /queryDataApiRemediationPlan/);
assert.match(verifierSource, /verifyDataApiRemediationClosure/);
assert.match(verifierSource, /status === 'closed'/);
assert.match(verifierSource, /status === 'verification-required'/);
assert.match(verifierSource, /process\.exit\(3\)/);
assert.doesNotMatch(
  verifierSource,
  /ALTER DEFAULT PRIVILEGES|\bREVOKE\b|\bGRANT\b|disable.*data.*api.*fetch|patch.*supabase/i,
);
assert.doesNotMatch(
  verifierSource,
  /riskyDefaultOwnerCount|alterableRiskyDefaultOwnerCount|protectedRiskyDefaultOwnerCount|owner_name|rolname|api[_ -]?key|credential|prompt|response_body/i,
);

assert.match(plannerSource, /queryDataApiRemediationPlan/);

const verifier = await import(
  `../scripts/verify-data-api-remediation-closure.mjs?test=${Date.now()}`
);

assert.deepEqual(
  verifier.classifyClosure({
    status: 'no-action',
    recommendedAction: 'none',
  }),
  {
    status: 'closed',
    reason: 'no-remediation-required',
    securityBoundaryClosed: true,
    requiresVerification: false,
  },
);

assert.deepEqual(
  verifier.classifyClosure({
    status: 'owner-action-required',
    recommendedAction: 'disable-data-api-in-dashboard',
  }),
  {
    status: 'open',
    reason: 'owner-action-pending',
    securityBoundaryClosed: false,
    requiresVerification: true,
  },
);

assert.deepEqual(
  verifier.classifyClosure({
    status: 'security-review-required',
    recommendedAction: 'review-current-data-api-exposure',
  }),
  {
    status: 'open',
    reason: 'security-review-pending',
    securityBoundaryClosed: false,
    requiresVerification: true,
  },
);

for (const [recommendedAction, expectedReason] of [
  ['verify-data-api-platform-state', 'platform-verification-pending'],
  ['verify-data-api-isolation-attestation', 'isolation-verification-pending'],
  ['verify-data-api-remediation-attestation', 'remediation-verification-pending'],
]) {
  assert.deepEqual(
    verifier.classifyClosure({
      status: 'verification-required',
      recommendedAction,
    }),
    {
      status: 'verification-required',
      reason: expectedReason,
      securityBoundaryClosed: false,
      requiresVerification: true,
    },
  );
}

let migration048Exists = true;
try {
  await access(new URL('../db/048_data_api_remediation_closure_verification.sql', import.meta.url));
} catch {
  migration048Exists = false;
}
assert.equal(
  migration048Exists,
  false,
  'Data API remediation closure verification must not introduce migration 048.',
);

console.log('NEXA Data API remediation closure verification command tests passed.');
