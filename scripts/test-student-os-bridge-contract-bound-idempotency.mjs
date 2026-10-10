#!/usr/bin/env node
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [
  pkgText,
  idempotencySource,
  routeSource,
  bridgeCoreSource,
  providerSource,
  fallbackSource,
  readme,
] = await Promise.all([
  read('package.json'),
  read('lib/student-os-bridge-idempotency.ts'),
  read('app/api/integrations/student-os/route.ts'),
  read('lib/student-os-bridge-core.ts'),
  read('lib/nexa-provider.ts'),
  read('lib/student-os-bridge-fallback-core.ts'),
  read('README.md'),
]);
const pkg = JSON.parse(pkgText);

assert.equal(pkg.name, 'nexa-1-74');
assert.equal(pkg.version, '1.74.0');
assert.equal(
  pkg.scripts['test:student-os-bridge-contract-bound-idempotency'],
  'node scripts/test-student-os-bridge-contract-bound-idempotency.mjs',
);
assert.match(pkg.scripts.test, /test:student-os-bridge-contract-bound-idempotency/);
assert.match(readme, /NEXA 1\.73\.0 — Contract-Bound Idempotency Replay Safety/);

assert.match(bridgeCoreSource, /STUDENT_OS_BRIDGE_CONTRACT_VERSION = '1\.0'/);
assert.match(providerSource, /NEXA_PROVIDER_CONTRACT_VERSION = '1\.0'/);
assert.match(fallbackSource, /STUDENT_OS_BRIDGE_FALLBACK_CONTRACT_VERSION = '1\.0'/);

assert.match(
  idempotencySource,
  /bridgeContractVersion: string = STUDENT_OS_BRIDGE_CONTRACT_VERSION/,
);
assert.match(
  idempotencySource,
  /if \(bridgeContractVersion === STUDENT_OS_BRIDGE_CONTRACT_VERSION\) \{\s*return hashRequestBody\(envelope\);/,
);
assert.match(
  idempotencySource,
  /return hashRequestBody\(\{\s*bridgeContractVersion,\s*envelope,\s*\}\);/,
);

assert.match(
  routeSource,
  /requestHash: hashStudentOsBridgeRequest\(envelope, bridgeContractVersion\)/,
);

const hashFunctionPos = idempotencySource.indexOf('export function hashStudentOsBridgeRequest(');
const claimFunctionPos = idempotencySource.indexOf('export async function claimStudentOsBridgeRequest(');
assert.ok(hashFunctionPos >= 0 && claimFunctionPos > hashFunctionPos);

const legacyBranchPos = idempotencySource.indexOf(
  'if (bridgeContractVersion === STUDENT_OS_BRIDGE_CONTRACT_VERSION)',
);
const legacyHashPos = idempotencySource.indexOf('return hashRequestBody(envelope);');
const futureHashPos = idempotencySource.indexOf('bridgeContractVersion,', legacyHashPos);
assert.ok(legacyBranchPos >= 0);
assert.ok(legacyHashPos > legacyBranchPos);
assert.ok(futureHashPos > legacyHashPos);

let migration043Exists = true;
try {
  await access(new URL('../db/043_student_os_bridge_contract_bound_idempotency.sql', import.meta.url));
} catch {
  migration043Exists = false;
}
assert.equal(
  migration043Exists,
  false,
  'Contract-bound idempotency must not introduce migration 043.',
);

console.log('NEXA Student OS contract-bound idempotency tests passed.');
