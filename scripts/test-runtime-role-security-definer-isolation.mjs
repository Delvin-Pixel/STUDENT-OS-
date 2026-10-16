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

assert.equal(pkg.name, 'nexa-1-84');
assert.equal(pkg.version, '1.84.0');
assert.equal(
  pkg.scripts['test:runtime-role-security-definer-isolation'],
  'node scripts/test-runtime-role-security-definer-isolation.mjs',
);
assert.match(pkg.scripts.test, /test:runtime-role-security-definer-isolation/);
assert.match(readme, /NEXA 1\.84\.0 — Runtime SECURITY DEFINER Isolation/);

for (const source of [coreSource, runtimeSource, operatorSource]) {
  assert.match(source, /runtime_security_definer_functions/);
}
assert.match(runtimeSource, /p\.prosecdef/);
assert.match(operatorSource, /p\.prosecdef/);
assert.match(operatorSource, /noExecutableSecurityDefinerFunctions/);
assert.match(pgTestSource, /security definer/i);
assert.match(pgTestSource, /noExecutableSecurityDefinerFunctions/);
assert.match(pgTestSource, /security invoker/i);

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
  public_functions: 2,
  runtime_functions: 2,
  role_memberships: 0,
};

assert.equal(core.classifyNexaRuntimeRoleSecurity(secureRow), 'secure');
assert.equal(
  core.classifyNexaRuntimeRoleSecurity({
    ...secureRow,
    runtime_security_definer_functions: 1,
  }),
  'insecure',
);
assert.equal(
  core.classifyNexaRuntimeRoleSecurity({
    ...secureRow,
    runtime_security_definer_functions: -1,
  }),
  'insecure',
);

let migration046Exists = true;
try {
  await access(new URL('../db/046_runtime_security_definer_isolation.sql', import.meta.url));
} catch {
  migration046Exists = false;
}
assert.equal(
  migration046Exists,
  false,
  'SECURITY DEFINER isolation must not introduce migration 046.',
);

console.log('NEXA runtime SECURITY DEFINER isolation tests passed.');
