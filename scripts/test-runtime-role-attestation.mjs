#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  NEXA_RUNTIME_ROLE,
  buildNexaRuntimeRoleAttestation,
} from './attest-nexa-runtime-role.mjs';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [pkgText, source, readme] = await Promise.all([
  read('package.json'),
  read('scripts/attest-nexa-runtime-role.mjs'),
  read('README.md'),
]);
const pkg = JSON.parse(pkgText);

assert.equal(pkg.name, 'nexa-1-92');
assert.equal(pkg.version, '1.92.0');
assert.equal(pkg.scripts['ops:attest-runtime-role'], 'node scripts/attest-nexa-runtime-role.mjs');
assert.equal(pkg.scripts['test:runtime-role-attestation'], 'node scripts/test-runtime-role-attestation.mjs');
assert.match(pkg.scripts.test, /test:runtime-role-attestation/);
assert.match(readme, /NEXA 1\.80\.0 — Runtime Role Least-Privilege Attestation/);

assert.equal(NEXA_RUNTIME_ROLE, 'nexa_runtime');
assert.match(source, /rolsuper/);
assert.match(source, /rolcreaterole/);
assert.match(source, /rolcreatedb/);
assert.match(source, /rolreplication/);
assert.match(source, /rolbypassrls/);
assert.match(source, /has_schema_privilege/);
assert.match(source, /has_database_privilege/);
assert.match(source, /pg_auth_members/);
assert.match(source, /has_table_privilege/);
assert.match(source, /has_sequence_privilege/);
assert.match(source, /has_function_privilege/);
assert.match(source, /database_owned_by_runtime/);
assert.match(source, /public_schema_owned_by_runtime/);
assert.match(source, /runtime_owned_relations/);
assert.match(source, /runtime_owned_functions/);
assert.match(source, /runtime_security_definer_functions/);
assert.match(source, /runtime_truncate_tables/);
assert.match(source, /runtime_references_tables/);
assert.match(source, /runtime_trigger_tables/);
assert.match(source, /runtime_maintain_tables/);
assert.match(source, /runtime_update_sequences/);
assert.match(source, /prosecdef/);

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
  db_temp: true,
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

const secureDefaultPrivileges = {
  default_acl_groups: 3,
  default_table_acl_groups: 1,
  default_sequence_acl_groups: 1,
  default_function_acl_groups: 1,
  default_acl_mismatched_groups: 0,
  default_acl_grant_option_groups: 0,
  default_acl_outside_public_groups: 0,
};

const secure = buildNexaRuntimeRoleAttestation(secureRow, secureDefaultPrivileges);
assert.equal(secure.secure, true);
assert.deepEqual([...secure.failedChecks], []);
assert.equal(secure.checks.noSuperuser, true);
assert.equal(secure.checks.noCreateRole, true);
assert.equal(secure.checks.noCreateDatabase, true);
assert.equal(secure.checks.noReplication, true);
assert.equal(secure.checks.noBypassRls, true);
assert.equal(secure.checks.noSchemaCreate, true);
assert.equal(secure.checks.noDatabaseCreate, true);
assert.equal(secure.checks.noDatabaseOwnership, true);
assert.equal(secure.checks.noPublicSchemaOwnership, true);
assert.equal(secure.checks.noPublicRelationOwnership, true);
assert.equal(secure.checks.noPublicFunctionOwnership, true);
assert.equal(secure.checks.noExecutableSecurityDefinerFunctions, true);
assert.equal(secure.checks.noRoleMemberships, true);
assert.equal(secure.checks.tableCrudCoverage, true);
assert.equal(secure.checks.noTableTruncate, true);
assert.equal(secure.checks.noTableReferences, true);
assert.equal(secure.checks.noTableTrigger, true);
assert.equal(secure.checks.noTableMaintain, true);
assert.equal(secure.checks.sequenceUsageCoverage, true);
assert.equal(secure.checks.noSequenceUpdate, true);
assert.equal(secure.checks.functionExecuteCoverage, true);
assert.equal(secure.evidence.databaseTemp, true);
assert.equal(secure.evidence.runtimeSecurityDefinerFunctions, 0);
assert.equal(secure.evidence.runtimeTruncateTables, 0);
assert.equal(secure.evidence.runtimeReferencesTables, 0);
assert.equal(secure.evidence.runtimeTriggerTables, 0);
assert.equal(secure.evidence.runtimeMaintainTables, 0);
assert.equal(secure.evidence.runtimeUpdateSequences, 0);
assert.equal(Object.isFrozen(secure), true);
assert.equal(Object.isFrozen(secure.checks), true);
assert.equal(Object.isFrozen(secure.failedChecks), true);

for (const [field, expectedFailure, value] of [
  ['rolsuper', 'noSuperuser', true],
  ['rolcreaterole', 'noCreateRole', true],
  ['rolcreatedb', 'noCreateDatabase', true],
  ['rolreplication', 'noReplication', true],
  ['rolbypassrls', 'noBypassRls', true],
  ['public_create', 'noSchemaCreate', true],
  ['db_create', 'noDatabaseCreate', true],
  ['database_owned_by_runtime', 'noDatabaseOwnership', true],
  ['public_schema_owned_by_runtime', 'noPublicSchemaOwnership', true],
  ['runtime_owned_relations', 'noPublicRelationOwnership', 1],
  ['runtime_owned_functions', 'noPublicFunctionOwnership', 1],
  ['runtime_security_definer_functions', 'noExecutableSecurityDefinerFunctions', 1],
  ['role_memberships', 'noRoleMemberships', 1],
  ['runtime_crud_tables', 'tableCrudCoverage', 11],
  ['runtime_truncate_tables', 'noTableTruncate', 1],
  ['runtime_references_tables', 'noTableReferences', 1],
  ['runtime_trigger_tables', 'noTableTrigger', 1],
  ['runtime_maintain_tables', 'noTableMaintain', 1],
  ['runtime_sequences', 'sequenceUsageCoverage', 3],
  ['runtime_update_sequences', 'noSequenceUpdate', 1],
  ['runtime_functions', 'functionExecuteCoverage', 2],
]) {
  const result = buildNexaRuntimeRoleAttestation({ ...secureRow, [field]: value }, secureDefaultPrivileges);
  assert.equal(result.secure, false, field);
  assert.ok(result.failedChecks.includes(expectedFailure), field);
}

for (const [field, expectedFailure] of [
  ['role_exists', 'roleExists'],
  ['rolcanlogin', 'login'],
  ['public_usage', 'schemaUsage'],
  ['db_connect', 'databaseConnect'],
]) {
  const result = buildNexaRuntimeRoleAttestation({ ...secureRow, [field]: false }, secureDefaultPrivileges);
  assert.equal(result.secure, false, field);
  assert.ok(result.failedChecks.includes(expectedFailure), field);
}

assert.throws(
  () => buildNexaRuntimeRoleAttestation({ ...secureRow, public_tables: -1 }, secureDefaultPrivileges),
  /public_tables/,
);

console.log('NEXA runtime role least-privilege attestation tests passed.');
