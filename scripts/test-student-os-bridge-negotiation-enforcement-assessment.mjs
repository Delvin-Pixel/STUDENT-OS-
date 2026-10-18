#!/usr/bin/env node
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [pkgText, assessmentSource, readme] = await Promise.all([
  read('package.json'),
  read('scripts/assess-student-os-bridge-negotiation-enforcement.mjs'),
  read('README.md'),
]);
const pkg = JSON.parse(pkgText);
const assessmentModule = await import('../scripts/assess-student-os-bridge-negotiation-enforcement.mjs');

assert.equal(pkg.name, 'nexa-1-91');
assert.equal(pkg.version, '1.91.0');
assert.equal(
  pkg.scripts['ops:assess-student-os-bridge-negotiation-enforcement'],
  'node scripts/assess-student-os-bridge-negotiation-enforcement.mjs',
);
assert.equal(
  pkg.scripts['test:student-os-bridge-negotiation-enforcement-assessment'],
  'node scripts/test-student-os-bridge-negotiation-enforcement-assessment.mjs',
);
assert.match(pkg.scripts.test, /test:student-os-bridge-negotiation-enforcement-assessment/);
assert.match(readme, /NEXA 1\.78\.0 — Explicit Negotiation Enforcement Evidence Gate/);

assert.match(assessmentSource, /minimum negotiation-enforcement request sample is required/i);
assert.match(assessmentSource, /insufficient-traffic/);
assert.match(assessmentSource, /insufficient-observability/);
assert.match(assessmentSource, /legacy-default-observed/);
assert.match(assessmentSource, /reviewable/);
assert.match(assessmentSource, /automaticPolicyChange: false/);
assert.doesNotMatch(assessmentSource, /process\.env\.NEXA_STUDENT_OS_BRIDGE_NEGOTIATION_REQUIRED\s*=/);
assert.doesNotMatch(assessmentSource, /update\s+|insert\s+into|delete\s+from/i);

assert.throws(() => assessmentModule.parseNegotiationEnforcementMinimumRequests(undefined));
assert.equal(assessmentModule.parseNegotiationEnforcementMinimumRequests('1'), 1);
assert.equal(assessmentModule.parseNegotiationEnforcementMinimumRequests('1000000'), 1_000_000);
for (const invalid of ['0', '1000001', '1.5', 'many', -1]) {
  assert.throws(() => assessmentModule.parseNegotiationEnforcementMinimumRequests(invalid));
}

function report({
  totalBridgeRequests,
  coverageStatus,
  coveragePercent,
  totalRequests,
  explicitRequests,
  legacyDefaultRequests,
}) {
  return {
    windowDays: 7,
    totalRequests,
    explicitRequests,
    legacyDefaultRequests,
    explicitPercent: totalRequests > 0 ? Math.round((explicitRequests / totalRequests) * 10000) / 100 : null,
    legacyDefaultPercent: totalRequests > 0 ? Math.round((legacyDefaultRequests / totalRequests) * 10000) / 100 : null,
    evidenceCoverage: {
      status: coverageStatus,
      totalBridgeRequests,
      coveragePercent,
    },
  };
}

const noTraffic = assessmentModule.buildNegotiationEnforcementAssessment(
  report({
    totalBridgeRequests: 0,
    coverageStatus: 'no-traffic',
    coveragePercent: null,
    totalRequests: 0,
    explicitRequests: 0,
    legacyDefaultRequests: 0,
  }),
  { minimumRequests: 10 },
);
assert.equal(noTraffic.reviewable, false);
assert.equal(noTraffic.decision, 'insufficient-traffic');
assert.equal(noTraffic.automaticPolicyChange, false);

const partial = assessmentModule.buildNegotiationEnforcementAssessment(
  report({
    totalBridgeRequests: 50,
    coverageStatus: 'partial-observability',
    coveragePercent: 90,
    totalRequests: 45,
    explicitRequests: 45,
    legacyDefaultRequests: 0,
  }),
  { minimumRequests: 10 },
);
assert.equal(partial.reviewable, false);
assert.equal(partial.decision, 'insufficient-observability');

const legacy = assessmentModule.buildNegotiationEnforcementAssessment(
  report({
    totalBridgeRequests: 100,
    coverageStatus: 'covered',
    coveragePercent: 100,
    totalRequests: 100,
    explicitRequests: 99,
    legacyDefaultRequests: 1,
  }),
  { minimumRequests: 50 },
);
assert.equal(legacy.reviewable, false);
assert.equal(legacy.decision, 'legacy-default-observed');

const reviewable = assessmentModule.buildNegotiationEnforcementAssessment(
  report({
    totalBridgeRequests: 100,
    coverageStatus: 'covered',
    coveragePercent: 100,
    totalRequests: 100,
    explicitRequests: 100,
    legacyDefaultRequests: 0,
  }),
  { minimumRequests: 50 },
);
assert.deepEqual(reviewable, {
  windowDays: 7,
  minimumRequests: 50,
  reviewable: true,
  decision: 'reviewable',
  automaticPolicyChange: false,
  evidence: {
    totalBridgeRequests: 100,
    coverageStatus: 'covered',
    coveragePercent: 100,
    adoptionSampleRequests: 100,
    explicitRequests: 100,
    legacyDefaultRequests: 0,
    explicitPercent: 100,
    legacyDefaultPercent: 0,
  },
});

assert.throws(() => assessmentModule.buildNegotiationEnforcementAssessment(
  report({
    totalBridgeRequests: 100,
    coverageStatus: 'covered',
    coveragePercent: 100,
    totalRequests: 99,
    explicitRequests: 99,
    legacyDefaultRequests: 0,
  }),
  { minimumRequests: 50 },
));

let migration044Exists = true;
try {
  await access(new URL('../db/044_student_os_bridge_negotiation_enforcement_assessment.sql', import.meta.url));
} catch {
  migration044Exists = false;
}
assert.equal(
  migration044Exists,
  false,
  'Negotiation enforcement evidence assessment must not introduce migration 044.',
);

console.log('NEXA negotiation enforcement evidence assessment tests passed.');
