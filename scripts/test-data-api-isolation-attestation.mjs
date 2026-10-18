#!/usr/bin/env node
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import ts from 'typescript';
import {
  classifyNexaDataApiIsolationEvidence,
} from './attest-supabase-data-api-isolation.mjs';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [pkgText, coreSource, operatorSource, readme] = await Promise.all([
  read('package.json'),
  read('lib/supabase-data-api-isolation-core.ts'),
  read('scripts/attest-supabase-data-api-isolation.mjs'),
  read('README.md'),
]);
const pkg = JSON.parse(pkgText);

assert.equal(pkg.name, 'nexa-1-87');
assert.equal(pkg.version, '1.87.0');
assert.equal(
  pkg.scripts['ops:attest-data-api-isolation'],
  'node scripts/attest-supabase-data-api-isolation.mjs',
);
assert.equal(
  pkg.scripts['test:data-api-isolation-attestation'],
  'node scripts/test-data-api-isolation-attestation.mjs',
);
assert.match(pkg.scripts.test, /test:data-api-isolation-attestation/);
assert.match(readme, /NEXA 1\.87\.0 — Supabase Data API Exposure Attestation/);

for (const token of [
  'pg_default_acl',
  'aclexplode',
  "'PUBLIC'",
  "'anon'",
  "'authenticated'",
  "n.nspname = 'public'",
  "d.defaclnamespace = 0 or n.nspname = 'public'",
  "dataApiIntegration: 'unknown'",
  'automaticRemediation: false',
  "acldefault('f', owner.role_oid)",
]) {
  assert.ok(operatorSource.includes(token), token);
}

assert.doesNotMatch(operatorSource, /service_role/);
assert.doesNotMatch(operatorSource, /graphql_public|storage/);

const transpiled = ts.transpileModule(coreSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const core = await import(`data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`);

const isolated = {
  current_schema_exposures: 0,
  current_table_exposures: 0,
  current_sequence_exposures: 0,
  current_function_exposures: 0,
  public_default_acl_exposures: 0,
  public_default_acl_grant_options: 0,
};
const futureRisk = { ...isolated, public_default_acl_exposures: 1 };
const exposed = { ...isolated, current_table_exposures: 1 };

for (const [row, expected] of [
  [isolated, 'isolated'],
  [futureRisk, 'future-default-risk'],
  [exposed, 'exposed'],
]) {
  assert.equal(core.classifyNexaDataApiIsolation(row), expected);
  assert.equal(classifyNexaDataApiIsolationEvidence(row), expected);
}

for (const invalid of [
  null,
  { ...isolated, current_schema_exposures: -1 },
  { ...isolated, public_default_acl_exposures: 'NaN' },
]) {
  assert.equal(core.classifyNexaDataApiIsolation(invalid), 'exposed');
  assert.equal(classifyNexaDataApiIsolationEvidence(invalid), 'exposed');
}

let migration046Exists = true;
try {
  await access(new URL('../db/046_data_api_exposure_attestation.sql', import.meta.url));
} catch {
  migration046Exists = false;
}
assert.equal(
  migration046Exists,
  false,
  'Data API exposure attestation must not introduce migration 046.',
);

console.log('NEXA Supabase Data API exposure attestation tests passed.');
