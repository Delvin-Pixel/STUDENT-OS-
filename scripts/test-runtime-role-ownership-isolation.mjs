#!/usr/bin/env node
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import ts from 'typescript';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [
  pkgText,
  coreSource,
  runtimeSource,
  operatorSource,
  healthSource,
  postgresTest,
  readme,
] = await Promise.all([
  read('package.json'),
  read('lib/runtime-role-security-core.ts'),
  read('lib/runtime-role-security.ts'),
  read('scripts/attest-nexa-runtime-role.mjs'),
  read('lib/health.ts'),
  read('scripts/test-postgres-runtime-role-attestation.mjs'),
  read('README.md'),
]);
const pkg = JSON.parse(pkgText);

assert.equal(pkg.name, 'nexa-1-84');
assert.equal(pkg.version, '1.84.0');
assert.equal(
  pkg.scripts['test:runtime-role-ownership-isolation'],
  'node scripts/test-runtime-role-ownership-isolation.mjs',
);
assert.match(pkg.scripts.test, /test:runtime-role-ownership-isolation/);
assert.match(readme, /NEXA 1\.83\.0 — Runtime Object Ownership Isolation/);

for (const source of [coreSource, runtimeSource, operatorSource]) {
  assert.match(source, /database_owned_by_runtime/);
  assert.match(source, /public_schema_owned_by_runtime/);
  assert.match(source, /runtime_owned_relations/);
  assert.match(source, /runtime_owned_functions/);
}

assert.match(operatorSource, /noDatabaseOwnership/);
assert.match(operatorSource, /noPublicSchemaOwnership/);
assert.match(operatorSource, /noPublicRelationOwnership/);
assert.match(operatorSource, /noPublicFunctionOwnership/);
assert.match(postgresTest, /alter table public\.nexa_runtime_ownership_probe owner to nexa_runtime/);
assert.match(postgresTest, /noPublicRelationOwnership/);

assert.match(healthSource, /runtimeRoleSecurity/);
assert.doesNotMatch(healthSource, /database_owned_by_runtime|public_schema_owned_by_runtime|runtime_owned_relations|runtime_owned_functions/);

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
  public_sequences: 4,
  runtime_sequences: 4,
  public_functions: 3,
  runtime_functions: 3,
  role_memberships: 0,
};

assert.equal(core.classifyNexaRuntimeRoleSecurity(secureRow), 'secure');
for (const [field, value] of [
  ['database_owned_by_runtime', true],
  ['public_schema_owned_by_runtime', true],
  ['runtime_owned_relations', 1],
  ['runtime_owned_functions', 1],
]) {
  assert.equal(
    core.classifyNexaRuntimeRoleSecurity({ ...secureRow, [field]: value }),
    'insecure',
    field,
  );
}

let migration046Exists = true;
try {
  await access(new URL('../db/046_runtime_object_ownership_isolation.sql', import.meta.url));
} catch {
  migration046Exists = false;
}
assert.equal(
  migration046Exists,
  false,
  'Runtime object ownership isolation must not introduce migration 046.',
);

console.log('NEXA runtime object ownership isolation tests passed.');
