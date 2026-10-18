#!/usr/bin/env node
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import ts from 'typescript';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [pkgText, coreSource, runtimeSource, operatorSource, pgTestSource, readme] = await Promise.all([
  read('package.json'),
  read('lib/runtime-role-security-core.ts'),
  read('lib/runtime-role-security.ts'),
  read('scripts/attest-nexa-runtime-role.mjs'),
  read('scripts/test-postgres-runtime-role-attestation.mjs'),
  read('README.md'),
]);
const pkg = JSON.parse(pkgText);

assert.equal(pkg.name, 'nexa-1-92');
assert.equal(pkg.version, '1.92.0');
assert.equal(
  pkg.scripts['test:runtime-role-exact-privileges'],
  'node scripts/test-runtime-role-exact-privileges.mjs',
);
assert.match(pkg.scripts.test, /test:runtime-role-exact-privileges/);
assert.match(readme, /NEXA 1\.85\.0 — Exact Runtime Privilege Surface/);

for (const source of [coreSource, runtimeSource, operatorSource]) {
  for (const field of [
    'runtime_truncate_tables',
    'runtime_references_tables',
    'runtime_trigger_tables',
    'runtime_maintain_tables',
    'runtime_update_sequences',
  ]) {
    assert.match(source, new RegExp(field));
  }
}

for (const privilege of ['TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN']) {
  assert.match(runtimeSource, new RegExp(`has_table_privilege\\(\\$1, c\\.oid, '${privilege}'\\)`));
}
assert.match(runtimeSource, /has_sequence_privilege\(\$1, c\.oid, 'UPDATE'\)/);

for (const check of [
  'noTableTruncate',
  'noTableReferences',
  'noTableTrigger',
  'noTableMaintain',
  'noSequenceUpdate',
]) {
  assert.match(operatorSource, new RegExp(check));
  assert.match(pgTestSource, new RegExp(check));
}

const transpiled = ts.transpileModule(coreSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const core = await import(`data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`);

const secureRow = {
  role_exists: true,
  rolcanlogin: true,
  rolsuper: false,
  rolcreaterole: false,
  rolcreatedb: false,
  rolreplication: false,
  rolbypassrls: false,
  public_usage: true,
  public_create: false,
  db_connect: true,
  db_create: false,
  database_owned_by_runtime: false,
  public_schema_owned_by_runtime: false,
  runtime_owned_relations: 0,
  runtime_owned_functions: 0,
  runtime_security_definer_functions: 0,
  public_tables: 12,
  runtime_crud_tables: 12,
  runtime_truncate_tables: 0,
  runtime_references_tables: 0,
  runtime_trigger_tables: 0,
  runtime_maintain_tables: 0,
  public_sequences: 4,
  runtime_sequences: 4,
  runtime_update_sequences: 0,
  public_functions: 0,
  runtime_functions: 0,
  role_memberships: 0,
};

assert.equal(core.classifyNexaRuntimeRoleSecurity(secureRow), 'secure');

for (const field of [
  'runtime_truncate_tables',
  'runtime_references_tables',
  'runtime_trigger_tables',
  'runtime_maintain_tables',
  'runtime_update_sequences',
]) {
  assert.equal(
    core.classifyNexaRuntimeRoleSecurity({ ...secureRow, [field]: 1 }),
    'insecure',
    field,
  );
}

let migration046Exists = true;
try {
  await access(new URL('../db/046_exact_runtime_privileges.sql', import.meta.url));
} catch {
  migration046Exists = false;
}
assert.equal(
  migration046Exists,
  false,
  'Exact runtime privilege enforcement must not introduce migration 046.',
);

console.log('NEXA exact runtime privilege surface tests passed.');
