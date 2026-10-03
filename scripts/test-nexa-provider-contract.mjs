#!/usr/bin/env node
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [pkgText, version, contract, readme] = await Promise.all([
  read('package.json'),
  read('lib/version.ts'),
  read('lib/nexa-provider.ts'),
  read('README.md'),
]);
const pkg = JSON.parse(pkgText);

assert.equal(pkg.name, 'nexa-1-61');
assert.equal(pkg.version, '1.61.0');
assert.match(version, /NEXA_VERSION = '1\.61\.0'/);
assert.match(contract, /NEXA_PROVIDER_CONTRACT_VERSION = '1\.0'/);
assert.match(contract, /NEXA_STUDENT_OS_ACADEMIC_AUTHORITY = 'student-os-learning-intelligence'/);
for (const capability of ['chat', 'explain', 'tutor', 'generateMaterial', 'generateQuiz', 'coach']) {
  assert.match(contract, new RegExp(`['"]${capability}['"]`));
  assert.match(contract, new RegExp(`\\b${capability}\\(request: NexaProviderRequest\\)`));
}
assert.match(contract, /mayOverrideAcademicDecisions: false/);
assert.match(contract, /studentOsCoreRequiresNexa: false/);
assert.match(contract, /NexaProviderFailureCode = 'unavailable' \| 'timeout' \| 'rate_limited' \| 'error'/);
assert.match(contract, /createNexaProviderFailure/);
assert.match(contract, /isNexaProvider/);
assert.match(contract, /hasExactCapabilities/);
assert.match(contract, /academicDecisionAuthority: NEXA_STUDENT_OS_ACADEMIC_AUTHORITY/);
assert.match(readme, /NEXA 1\.57\.0 — Stable Student OS Provider Contract/);
assert.match(readme, /learningIntelligence/);
assert.match(pkg.scripts['test'], /test:nexa-provider-contract/);
assert.equal(pkg.scripts['test:nexa-provider-contract'], 'node scripts/test-nexa-provider-contract.mjs');

let migration040Exists = true;
try {
  await access(new URL('../db/040_nexa_provider.sql', import.meta.url));
} catch {
  migration040Exists = false;
}
assert.equal(migration040Exists, false, 'The provider contract release must not introduce a database migration.');

console.log('NEXA Student OS provider contract tests passed.');
