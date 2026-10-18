#!/usr/bin/env node
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import ts from 'typescript';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [pkgText, coreSource, runtimeSource, healthSource, operatorSource, readme] = await Promise.all([
  read('package.json'),
  read('lib/runtime-role-security-core.ts'),
  read('lib/runtime-role-security.ts'),
  read('lib/health.ts'),
  read('scripts/attest-nexa-runtime-role.mjs'),
  read('README.md'),
]);
const pkg = JSON.parse(pkgText);

assert.equal(pkg.name, 'nexa-1-88');
assert.equal(pkg.version, '1.88.0');
assert.equal(
  pkg.scripts['test:runtime-role-security-readiness'],
  'node scripts/test-runtime-role-security-readiness.mjs',
);
assert.match(pkg.scripts.test, /test:runtime-role-security-readiness/);
assert.match(readme, /NEXA 1\.81\.0 — Runtime Security Readiness/);

assert.match(coreSource, /NEXA_RUNTIME_ROLE = 'nexa_runtime'/);
assert.match(runtimeSource, /NEXA_RUNTIME_ROLE_SECURITY_CACHE_MS = 60_000/);
assert.match(runtimeSource, /has_schema_privilege/);
assert.match(runtimeSource, /has_database_privilege/);
assert.match(runtimeSource, /has_table_privilege/);
assert.match(runtimeSource, /has_sequence_privilege/);
assert.match(runtimeSource, /has_function_privilege/);
assert.match(runtimeSource, /pg_auth_members/);
assert.match(runtimeSource, /attestation_unavailable/);
assert.match(runtimeSource, /database_owned_by_runtime/);
assert.match(runtimeSource, /public_schema_owned_by_runtime/);
assert.match(runtimeSource, /runtime_owned_relations/);
assert.match(runtimeSource, /runtime_owned_functions/);
assert.match(runtimeSource, /runtime_security_definer_functions/);
assert.match(runtimeSource, /runtime_truncate_tables/);
assert.match(runtimeSource, /runtime_references_tables/);
assert.match(runtimeSource, /runtime_trigger_tables/);
assert.match(runtimeSource, /runtime_maintain_tables/);
assert.match(runtimeSource, /runtime_update_sequences/);
assert.match(runtimeSource, /prosecdef/);

assert.match(healthSource, /runtimeRoleSecurity: NexaRuntimeRoleSecurityStatus/);
assert.match(healthSource, /runtimeRoleSecurityReason: NexaRuntimeRoleSecurityReason/);
assert.match(healthSource, /getNexaRuntimeRoleSecurity\(\)/);
assert.match(healthSource, /runtimeRoleSecurity\.status === 'secure'/);
assert.doesNotMatch(healthSource, /failedChecks|publicTables|roleMemberships|runtimeCrudTables/);

assert.match(operatorSource, /NEXA_RUNTIME_ROLE = 'nexa_runtime'/);

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
  public_functions: 3,
  runtime_functions: 3,
  role_memberships: 0,
};

assert.equal(core.classifyNexaRuntimeRoleSecurity(secureRow), 'secure');
assert.equal(core.classifyNexaRuntimeRoleSecurity(null), 'insecure');

for (const [field, value] of [
  ['role_exists', false],
  ['rolcanlogin', false],
  ['rolsuper', true],
  ['rolcreaterole', true],
  ['rolcreatedb', true],
  ['rolreplication', true],
  ['rolbypassrls', true],
  ['public_usage', false],
  ['public_create', true],
  ['db_connect', false],
  ['db_create', true],
  ['database_owned_by_runtime', true],
  ['public_schema_owned_by_runtime', true],
  ['runtime_owned_relations', 1],
  ['runtime_owned_functions', 1],
  ['runtime_security_definer_functions', 1],
  ['role_memberships', 1],
  ['runtime_crud_tables', 11],
  ['runtime_truncate_tables', 1],
  ['runtime_references_tables', 1],
  ['runtime_trigger_tables', 1],
  ['runtime_maintain_tables', 1],
  ['runtime_sequences', 3],
  ['runtime_update_sequences', 1],
  ['runtime_functions', 2],
]) {
  assert.equal(
    core.classifyNexaRuntimeRoleSecurity({ ...secureRow, [field]: value }),
    'insecure',
    field,
  );
}

for (const [field, value] of [
  ['public_tables', -1],
  ['runtime_crud_tables', 'NaN'],
  ['public_sequences', 1.5],
  ['runtime_functions', -2],
]) {
  assert.equal(
    core.classifyNexaRuntimeRoleSecurity({ ...secureRow, [field]: value }),
    'insecure',
    field,
  );
}

let migration045Exists = true;
try {
  await access(new URL('../db/045_runtime_security_readiness.sql', import.meta.url));
} catch {
  migration045Exists = false;
}
assert.equal(
  migration045Exists,
  false,
  'Runtime security readiness must not introduce migration 045.',
);

console.log('NEXA runtime security readiness tests passed.');
