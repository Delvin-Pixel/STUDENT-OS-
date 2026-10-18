#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [pkgText, migration043, runtimeSource, routeSource, readme] = await Promise.all([
  read('package.json'),
  read('db/043_student_os_bridge_negotiation_adoption_observability.sql'),
  read('lib/student-os-bridge-observability.ts'),
  read('app/api/integrations/student-os/route.ts'),
  read('README.md'),
]);
const pkg = JSON.parse(pkgText);

assert.equal(pkg.name, 'nexa-1-88');
assert.equal(pkg.version, '1.88.0');
assert.equal(
  pkg.scripts['test:student-os-bridge-negotiation-adoption'],
  'node scripts/test-student-os-bridge-negotiation-adoption.mjs',
);
assert.match(pkg.scripts.test, /test:student-os-bridge-negotiation-adoption/);
assert.match(readme, /NEXA 1\.75\.0 — Bridge Negotiation Adoption Observability/);

assert.match(migration043, /add column bridge_contract_version text/);
assert.match(migration043, /add column contract_negotiation_source text/);
assert.match(migration043, /contract_negotiation_source in \('explicit', 'legacy-default'\)/);
assert.match(migration043, /student_os_bridge_events_contract_negotiation_pair_check/);
assert.match(migration043, /student_os_bridge_events_negotiation_created_idx/);
assert.doesNotMatch(migration043, /prompt|response_body|api[_ ]?key|balance|authorization|requested_versions/i);

assert.match(runtimeSource, /bridgeContractVersion\?: string \| null/);
assert.match(runtimeSource, /contractNegotiationSource\?:/);
assert.match(runtimeSource, /bridge_contract_version, contract_negotiation_source/);
assert.match(runtimeSource, /input\.bridgeContractVersion \?\? null/);
assert.match(runtimeSource, /input\.contractNegotiationSource \?\? null/);
assert.doesNotMatch(runtimeSource, /requestedVersions|accept-contract|authorization/i);

assert.match(routeSource, /bridgeContractVersion,/);
assert.match(routeSource, /contractNegotiationSource: contractNegotiation\.source/);
assert.match(routeSource, /bridgeObservationContext = \{/);
assert.ok(
  routeSource.indexOf('contractNegotiationSource: contractNegotiation.source')
  < routeSource.indexOf('enforceStudentOsBridgeOperationalAdmission()'),
  'Negotiation adoption must be attached before bridge events can be recorded.',
);

console.log('NEXA Student OS bridge negotiation adoption observability tests passed.');
