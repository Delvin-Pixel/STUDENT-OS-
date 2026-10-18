#!/usr/bin/env node
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import ts from 'typescript';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [pkgText, coreSource, runtimeSource, operatorSource, readme] = await Promise.all([
  read('package.json'),
  read('lib/runtime-role-default-privileges-core.ts'),
  read('lib/runtime-role-security.ts'),
  read('scripts/attest-nexa-runtime-role.mjs'),
  read('README.md'),
]);
const pkg = JSON.parse(pkgText);

assert.equal(pkg.name, 'nexa-1-86');
assert.equal(pkg.version, '1.86.0');
assert.equal(
  pkg.scripts['test:runtime-role-default-privileges'],
  'node scripts/test-runtime-role-default-privileges.mjs',
);
assert.match(pkg.scripts.test, /test:runtime-role-default-privileges/);
assert.match(readme, /NEXA 1\.86\.0 — Exact Runtime Default Privilege Surface/);

for (const source of [runtimeSource, operatorSource]) {
  assert.match(source, /pg_default_acl/);
  assert.match(source, /aclexplode/);
  assert.match(source, /default_acl_mismatched_groups/);
  assert.match(source, /default_acl_grant_option_groups/);
  assert.match(source, /default_acl_outside_public_groups/);
  for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'USAGE', 'EXECUTE']) {
    assert.match(source, new RegExp(`'${privilege}'`));
  }
}

for (const check of [
  'defaultTablePrivilegesConfigured',
  'defaultSequencePrivilegesConfigured',
  'defaultFunctionPrivilegesConfigured',
  'exactDefaultPrivileges',
  'noDefaultGrantOptions',
  'noDefaultPrivilegesOutsidePublic',
]) {
  assert.match(operatorSource, new RegExp(check));
}

const transpiled = ts.transpileModule(coreSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const core = await import(`data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`);

const secure = {
  default_acl_groups: 3,
  default_table_acl_groups: 1,
  default_sequence_acl_groups: 1,
  default_function_acl_groups: 1,
  default_acl_mismatched_groups: 0,
  default_acl_grant_option_groups: 0,
  default_acl_outside_public_groups: 0,
};
assert.equal(core.classifyNexaRuntimeDefaultPrivileges(secure), 'secure');

for (const row of [
  { ...secure, default_table_acl_groups: 0, default_acl_groups: 2 },
  { ...secure, default_sequence_acl_groups: 0, default_acl_groups: 2 },
  { ...secure, default_function_acl_groups: 0, default_acl_groups: 2 },
  { ...secure, default_acl_mismatched_groups: 1 },
  { ...secure, default_acl_grant_option_groups: 1 },
  { ...secure, default_acl_outside_public_groups: 1 },
]) {
  assert.equal(core.classifyNexaRuntimeDefaultPrivileges(row), 'insecure');
}
assert.equal(core.classifyNexaRuntimeDefaultPrivileges(null), 'insecure');

let migration046Exists = true;
try {
  await access(new URL('../db/046_runtime_default_privileges.sql', import.meta.url));
} catch {
  migration046Exists = false;
}
assert.equal(
  migration046Exists,
  false,
  'Runtime default privilege attestation must not introduce migration 046.',
);

console.log('NEXA exact runtime default privilege surface tests passed.');
