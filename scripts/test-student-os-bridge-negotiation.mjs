#!/usr/bin/env node
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import ts from 'typescript';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [
  pkgText,
  coreSource,
  routeSource,
  readinessSource,
  healthRouteSource,
  smokeSource,
  providerSource,
  fallbackSource,
  readme,
] = await Promise.all([
  read('package.json'),
  read('lib/student-os-bridge-core.ts'),
  read('app/api/integrations/student-os/route.ts'),
  read('lib/student-os-bridge-readiness.ts'),
  read('app/api/integrations/student-os/health/route.ts'),
  read('scripts/smoke-student-os-bridge.mjs'),
  read('lib/nexa-provider.ts'),
  read('lib/student-os-bridge-fallback-core.ts'),
  read('README.md'),
]);
const pkg = JSON.parse(pkgText);

assert.equal(pkg.name, 'nexa-1-72');
assert.equal(pkg.version, '1.72.0');
assert.equal(
  pkg.scripts['test:student-os-bridge-negotiation'],
  'node scripts/test-student-os-bridge-negotiation.mjs',
);
assert.match(pkg.scripts.test, /test:student-os-bridge-negotiation/);
assert.match(readme, /NEXA 1\.72\.0 — Student OS Bridge Contract Compatibility Negotiation/);

assert.match(coreSource, /STUDENT_OS_BRIDGE_ACCEPT_CONTRACT_HEADER = 'X-NEXA-Bridge-Accept-Contract'/);
assert.match(coreSource, /STUDENT_OS_BRIDGE_SUPPORTED_CONTRACT_VERSIONS/);
assert.match(coreSource, /STUDENT_OS_BRIDGE_MAX_NEGOTIATED_VERSIONS = 8/);
assert.match(coreSource, /negotiateStudentOsBridgeContract/);

assert.match(providerSource, /NEXA_PROVIDER_CONTRACT_VERSION = '1\.0'/);
assert.match(fallbackSource, /STUDENT_OS_BRIDGE_FALLBACK_CONTRACT_VERSION = '1\.0'/);
assert.match(coreSource, /STUDENT_OS_BRIDGE_CONTRACT_VERSION = '1\.0'/);

assert.match(readinessSource, /supportedBridgeContractVersions: readonly string\[\]/);
assert.match(readinessSource, /supportedBridgeContractVersions: STUDENT_OS_BRIDGE_SUPPORTED_CONTRACT_VERSIONS/);
assert.match(healthRouteSource, /X-NEXA-Bridge-Supported-Contracts/);
assert.match(smokeSource, /supportedBridgeContractVersions\.includes\('1\.0'\)/);
assert.match(smokeSource, /x-nexa-bridge-supported-contracts/);

assert.match(routeSource, /STUDENT_OS_BRIDGE_ACCEPT_CONTRACT_HEADER/);
assert.match(routeSource, /negotiateStudentOsBridgeContract/);
assert.match(routeSource, /supportedContracts: contractNegotiation\.supportedVersions/);
assert.match(routeSource, /invalid_contract_header/);
assert.match(coreSource, /unsupported_contract/);
assert.match(routeSource, /status: contractNegotiation\.reason === 'invalid_contract_header' \? 400 : 409/);
assert.match(routeSource, /X-NEXA-Bridge-Supported-Contracts/);

const authPos = routeSource.indexOf("authorizeStudentOsBridge(request.headers.get('authorization')");
const negotiatePos = routeSource.indexOf('negotiateStudentOsBridgeContract(');
const bodyPos = routeSource.indexOf('readJsonBody<unknown>(');
const operationalPos = routeSource.indexOf('enforceStudentOsBridgeOperationalAdmission()');
const rateLimitPos = routeSource.indexOf('enforceStudentOsBridgeAdmission(envelope.request.userId)');
const claimPos = routeSource.indexOf('claimStudentOsBridgeRequest({');
const providerPos = routeSource.indexOf('createNexaProviderAdapter({');

assert.ok(authPos >= 0);
assert.ok(negotiatePos > authPos, 'Contract negotiation must occur after authentication.');
assert.ok(bodyPos > negotiatePos, 'Contract mismatch must be rejectable before body parsing.');
assert.ok(operationalPos > bodyPos, 'Operational admission must remain after request validation.');
assert.ok(rateLimitPos > operationalPos, 'Rate limits must remain behind operational admission.');
assert.ok(claimPos > rateLimitPos, 'Idempotency claim must remain behind rate limits.');
assert.ok(providerPos > claimPos, 'Provider creation must remain behind all admission guards.');

const transpiled = ts.transpileModule(coreSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const core = await import(`data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`);

assert.equal(core.STUDENT_OS_BRIDGE_CONTRACT_VERSION, '1.0');
assert.equal(core.STUDENT_OS_BRIDGE_ACCEPT_CONTRACT_HEADER, 'X-NEXA-Bridge-Accept-Contract');
assert.deepEqual([...core.STUDENT_OS_BRIDGE_SUPPORTED_CONTRACT_VERSIONS], ['1.0']);

const missing = core.negotiateStudentOsBridgeContract(null);
assert.equal(missing.compatible, true);
assert.equal(missing.version, '1.0');
assert.equal(missing.source, 'legacy-default');
assert.deepEqual([...missing.requestedVersions], []);

const blank = core.negotiateStudentOsBridgeContract('   ');
assert.equal(blank.compatible, true);
assert.equal(blank.version, '1.0');
assert.equal(blank.source, 'legacy-default');

const exact = core.negotiateStudentOsBridgeContract('1.0');
assert.equal(exact.compatible, true);
assert.equal(exact.version, '1.0');
assert.equal(exact.source, 'explicit');
assert.deepEqual([...exact.requestedVersions], ['1.0']);

const compatibleList = core.negotiateStudentOsBridgeContract('2.0, 1.0, 1.0');
assert.equal(compatibleList.compatible, true);
assert.equal(compatibleList.version, '1.0');
assert.deepEqual([...compatibleList.requestedVersions], ['2.0', '1.0']);

const unsupported = core.negotiateStudentOsBridgeContract('2.0,3.0');
assert.equal(unsupported.compatible, false);
assert.equal(unsupported.reason, 'unsupported_contract');
assert.deepEqual([...unsupported.requestedVersions], ['2.0', '3.0']);
assert.deepEqual([...unsupported.supportedVersions], ['1.0']);

for (const invalid of [
  '1',
  'v1.0',
  '1.0,,2.0',
  '1.0,',
  ',1.0',
  '1.0,2.0,3.0,4.0,5.0,6.0,7.0,8.0,9.0',
  '9'.repeat(257),
]) {
  const result = core.negotiateStudentOsBridgeContract(invalid);
  assert.equal(result.compatible, false);
  assert.equal(result.reason, 'invalid_contract_header');
}

assert.equal(Object.isFrozen(exact), true);
assert.equal(Object.isFrozen(exact.requestedVersions), true);
assert.equal(Object.isFrozen(exact.supportedVersions), true);

let migration043Exists = true;
try {
  await access(new URL('../db/043_student_os_bridge_negotiation.sql', import.meta.url));
} catch {
  migration043Exists = false;
}
assert.equal(
  migration043Exists,
  false,
  'Bridge compatibility negotiation must not introduce migration 043.',
);

console.log('NEXA Student OS bridge compatibility negotiation tests passed.');
