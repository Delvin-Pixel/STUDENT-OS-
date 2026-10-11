#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [pkgText, reportSource, readme] = await Promise.all([
  read('package.json'),
  read('scripts/report-student-os-bridge-negotiation-adoption.mjs'),
  read('README.md'),
]);
const pkg = JSON.parse(pkgText);
const reportModule = await import('../scripts/report-student-os-bridge-negotiation-adoption.mjs');

assert.equal(pkg.name, 'nexa-1-76');
assert.equal(pkg.version, '1.76.0');
assert.equal(
  pkg.scripts['ops:report-student-os-bridge-negotiation-adoption'],
  'node scripts/report-student-os-bridge-negotiation-adoption.mjs',
);
assert.equal(
  pkg.scripts['test:student-os-bridge-negotiation-adoption-report'],
  'node scripts/test-student-os-bridge-negotiation-adoption-report.mjs',
);
assert.match(pkg.scripts.test, /test:student-os-bridge-negotiation-adoption-report/);
assert.match(readme, /NEXA 1\.76\.0 — Privacy-Bounded Negotiation Adoption Reporting/);

assert.match(reportSource, /count\(distinct bridge_request_id\)::int as request_count/);
assert.match(reportSource, /contract_negotiation_source/);
assert.match(reportSource, /bridge_contract_version/);
assert.match(reportSource, /group by contract_negotiation_source, bridge_contract_version/);
assert.doesNotMatch(reportSource, /select\s+user_fingerprint/i);
assert.doesNotMatch(reportSource, /external_user_id|prompt|response_body|authorization|api[_ ]?key|provider_credential/i);
assert.doesNotMatch(reportSource, /update\s+student_os_bridge_events|delete\s+from\s+student_os_bridge_events/i);

assert.equal(reportModule.parseNegotiationAdoptionWindowDays(undefined), 7);
assert.equal(reportModule.parseNegotiationAdoptionWindowDays('1'), 1);
assert.equal(reportModule.parseNegotiationAdoptionWindowDays('90'), 90);
for (const invalid of ['0', '91', '1.5', 'seven', -1, 120]) {
  assert.throws(() => reportModule.parseNegotiationAdoptionWindowDays(invalid));
}

const report = reportModule.buildNegotiationAdoptionReport([
  { contract_negotiation_source: 'explicit', bridge_contract_version: '1.0', request_count: 8 },
  { contract_negotiation_source: 'legacy-default', bridge_contract_version: '1.0', request_count: 2 },
  { contract_negotiation_source: 'explicit', bridge_contract_version: '2.0', request_count: 5 },
], { windowDays: 7, generatedAt: '2026-10-11T00:00:00.000Z' });

assert.deepEqual(report, {
  windowDays: 7,
  generatedAt: '2026-10-11T00:00:00.000Z',
  totalRequests: 15,
  explicitRequests: 13,
  legacyDefaultRequests: 2,
  explicitPercent: 86.67,
  legacyDefaultPercent: 13.33,
  legacyDefaultObserved: true,
  byContractVersion: [
    { bridgeContractVersion: '1.0', explicitRequests: 8, legacyDefaultRequests: 2, totalRequests: 10 },
    { bridgeContractVersion: '2.0', explicitRequests: 5, legacyDefaultRequests: 0, totalRequests: 5 },
  ],
});

const empty = reportModule.buildNegotiationAdoptionReport([], {
  windowDays: 30,
  generatedAt: '2026-10-11T00:00:00.000Z',
});
assert.equal(empty.totalRequests, 0);
assert.equal(empty.explicitPercent, null);
assert.equal(empty.legacyDefaultPercent, null);
assert.equal(empty.legacyDefaultObserved, false);

assert.throws(() => reportModule.buildNegotiationAdoptionReport([
  { contract_negotiation_source: 'raw-header', bridge_contract_version: '1.0', request_count: 1 },
]));
assert.throws(() => reportModule.buildNegotiationAdoptionReport([
  { contract_negotiation_source: 'explicit', bridge_contract_version: 'v1', request_count: 1 },
]));

console.log('NEXA negotiation adoption reporting tests passed.');
