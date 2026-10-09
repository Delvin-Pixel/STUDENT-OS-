#!/usr/bin/env node
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import ts from 'typescript';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [
  pkgText,
  bridgeCore,
  readiness,
  bridgeRoute,
  healthRoute,
  smoke,
  provider,
  fallback,
  readme,
] = await Promise.all([
  read('package.json'),
  read('lib/student-os-bridge-core.ts'),
  read('lib/student-os-bridge-readiness.ts'),
  read('app/api/integrations/student-os/route.ts'),
  read('app/api/integrations/student-os/health/route.ts'),
  read('scripts/smoke-student-os-bridge.mjs'),
  read('lib/nexa-provider.ts'),
  read('lib/student-os-bridge-fallback-core.ts'),
  read('README.md'),
]);
const pkg = JSON.parse(pkgText);

assert.equal(pkg.name, 'nexa-1-71');
assert.equal(pkg.version, '1.71.0');
assert.equal(
  pkg.scripts['test:student-os-bridge-contract-version'],
  'node scripts/test-student-os-bridge-contract-version.mjs',
);
assert.match(pkg.scripts.test, /test:student-os-bridge-contract-version/);
assert.match(readme, /NEXA 1\.71\.0 — Student OS Bridge Transport Contract Versioning/);

assert.match(bridgeCore, /STUDENT_OS_BRIDGE_CONTRACT_VERSION = '1\.0'/);
assert.match(provider, /NEXA_PROVIDER_CONTRACT_VERSION = '1\.0'/);
assert.match(fallback, /STUDENT_OS_BRIDGE_FALLBACK_CONTRACT_VERSION = '1\.0'/);

assert.match(readiness, /bridgeContractVersion: string/);
assert.match(readiness, /bridgeContractVersion: STUDENT_OS_BRIDGE_CONTRACT_VERSION/);

assert.match(bridgeRoute, /X-NEXA-Bridge-Contract/);
assert.match(bridgeRoute, /STUDENT_OS_BRIDGE_CONTRACT_VERSION/);
assert.match(healthRoute, /X-NEXA-Bridge-Contract/);
assert.match(healthRoute, /STUDENT_OS_BRIDGE_CONTRACT_VERSION/);

assert.match(smoke, /body\?\.bridgeContractVersion === '1\.0'/);
assert.match(smoke, /x-nexa-bridge-contract/);

const transpiled = ts.transpileModule(bridgeCore, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const core = await import(`data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`);
assert.equal(core.STUDENT_OS_BRIDGE_CONTRACT_VERSION, '1.0');

let migration043Exists = true;
try {
  await access(new URL('../db/043_student_os_bridge_contract_version.sql', import.meta.url));
} catch {
  migration043Exists = false;
}
assert.equal(
  migration043Exists,
  false,
  'Bridge transport contract versioning must not introduce migration 043.',
);

console.log('NEXA Student OS bridge transport contract versioning tests passed.');
