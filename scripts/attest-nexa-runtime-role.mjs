#!/usr/bin/env node
import pg from 'pg';
import { pathToFileURL } from 'node:url';

export const NEXA_RUNTIME_ROLE = 'nexa_runtime';

function boolean(value) {
  return value === true || value === 't' || value === 'true';
}

function count(value, field) {
  const parsed = Number(value ?? 0);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`Runtime role attestation field ${field} is invalid.`);
  }
  return parsed;
}

export function buildNexaRuntimeRoleAttestation(row = {}, defaultPrivileges = {}) {
  const roleExists = boolean(row.role_exists);
  const login = boolean(row.rolcanlogin);
  const superuser = boolean(row.rolsuper);
  const createRole = boolean(row.rolcreaterole);
  const createDatabase = boolean(row.rolcreatedb);
  const replication = boolean(row.rolreplication);
  const bypassRls = boolean(row.rolbypassrls);
  const schemaUsage = boolean(row.public_usage);
  const schemaCreate = boolean(row.public_create);
  const databaseConnect = boolean(row.db_connect);
  const databaseCreate = boolean(row.db_create);
  const databaseTemp = boolean(row.db_temp);
  const databaseOwnedByRuntime = boolean(row.database_owned_by_runtime);
  const publicSchemaOwnedByRuntime = boolean(row.public_schema_owned_by_runtime);

  const publicTables = count(row.public_tables, 'public_tables');
  const runtimeCrudTables = count(row.runtime_crud_tables, 'runtime_crud_tables');
  const runtimeTruncateTables = count(row.runtime_truncate_tables, 'runtime_truncate_tables');
  const runtimeReferencesTables = count(row.runtime_references_tables, 'runtime_references_tables');
  const runtimeTriggerTables = count(row.runtime_trigger_tables, 'runtime_trigger_tables');
  const runtimeMaintainTables = count(row.runtime_maintain_tables, 'runtime_maintain_tables');
  const publicSequences = count(row.public_sequences, 'public_sequences');
  const runtimeSequences = count(row.runtime_sequences, 'runtime_sequences');
  const runtimeUpdateSequences = count(row.runtime_update_sequences, 'runtime_update_sequences');
  const publicFunctions = count(row.public_functions, 'public_functions');
  const runtimeFunctions = count(row.runtime_functions, 'runtime_functions');
  const roleMemberships = count(row.role_memberships, 'role_memberships');
  const runtimeOwnedRelations = count(row.runtime_owned_relations, 'runtime_owned_relations');
  const runtimeOwnedFunctions = count(row.runtime_owned_functions, 'runtime_owned_functions');
  const runtimeSecurityDefinerFunctions = count(row.runtime_security_definer_functions, 'runtime_security_definer_functions');
  const defaultAclGroups = count(defaultPrivileges.default_acl_groups, 'default_acl_groups');
  const defaultTableAclGroups = count(defaultPrivileges.default_table_acl_groups, 'default_table_acl_groups');
  const defaultSequenceAclGroups = count(defaultPrivileges.default_sequence_acl_groups, 'default_sequence_acl_groups');
  const defaultFunctionAclGroups = count(defaultPrivileges.default_function_acl_groups, 'default_function_acl_groups');
  const defaultAclMismatchedGroups = count(defaultPrivileges.default_acl_mismatched_groups, 'default_acl_mismatched_groups');
  const defaultAclGrantOptionGroups = count(defaultPrivileges.default_acl_grant_option_groups, 'default_acl_grant_option_groups');
  const defaultAclOutsidePublicGroups = count(defaultPrivileges.default_acl_outside_public_groups, 'default_acl_outside_public_groups');

  const checks = Object.freeze({
    roleExists,
    login,
    noSuperuser: !superuser,
    noCreateRole: !createRole,
    noCreateDatabase: !createDatabase,
    noReplication: !replication,
    noBypassRls: !bypassRls,
    schemaUsage,
    noSchemaCreate: !schemaCreate,
    databaseConnect,
    noDatabaseCreate: !databaseCreate,
    noDatabaseOwnership: !databaseOwnedByRuntime,
    noPublicSchemaOwnership: !publicSchemaOwnedByRuntime,
    noPublicRelationOwnership: runtimeOwnedRelations === 0,
    noPublicFunctionOwnership: runtimeOwnedFunctions === 0,
    noExecutableSecurityDefinerFunctions: runtimeSecurityDefinerFunctions === 0,
    noRoleMemberships: roleMemberships === 0,
    tableCrudCoverage: runtimeCrudTables === publicTables,
    noTableTruncate: runtimeTruncateTables === 0,
    noTableReferences: runtimeReferencesTables === 0,
    noTableTrigger: runtimeTriggerTables === 0,
    noTableMaintain: runtimeMaintainTables === 0,
    sequenceUsageCoverage: runtimeSequences === publicSequences,
    noSequenceUpdate: runtimeUpdateSequences === 0,
    functionExecuteCoverage: runtimeFunctions === publicFunctions,
    defaultTablePrivilegesConfigured: defaultTableAclGroups >= 1,
    defaultSequencePrivilegesConfigured: defaultSequenceAclGroups >= 1,
    defaultFunctionPrivilegesConfigured: defaultFunctionAclGroups >= 1,
    exactDefaultPrivileges: defaultAclMismatchedGroups === 0,
    noDefaultGrantOptions: defaultAclGrantOptionGroups === 0,
    noDefaultPrivilegesOutsidePublic: defaultAclOutsidePublicGroups === 0,
  });

  const failedChecks = Object.freeze(
    Object.entries(checks)
      .filter(([, passed]) => !passed)
      .map(([name]) => name),
  );

  return Object.freeze({
    role: NEXA_RUNTIME_ROLE,
    secure: failedChecks.length === 0,
    failedChecks,
    checks,
    evidence: Object.freeze({
      publicTables,
      runtimeCrudTables,
      runtimeTruncateTables,
      runtimeReferencesTables,
      runtimeTriggerTables,
      runtimeMaintainTables,
      publicSequences,
      runtimeSequences,
      runtimeUpdateSequences,
      publicFunctions,
      runtimeFunctions,
      roleMemberships,
      databaseTemp,
      databaseOwnedByRuntime,
      publicSchemaOwnedByRuntime,
      runtimeOwnedRelations,
      runtimeOwnedFunctions,
      runtimeSecurityDefinerFunctions,
      defaultAclGroups,
      defaultTableAclGroups,
      defaultSequenceAclGroups,
      defaultFunctionAclGroups,
      defaultAclMismatchedGroups,
      defaultAclGrantOptionGroups,
      defaultAclOutsidePublicGroups,
    }),
  });
}

export async function queryNexaRuntimeRoleAttestation(options = {}) {
  const connectionString = options.connectionString ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required for NEXA runtime-role attestation.');
  }

  const pool = new pg.Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 10_000,
    statement_timeout: 15_000,
  });

  try {
    const result = await pool.query(`
      with role_state as (
        select
          true as role_exists,
          r.rolsuper,
          r.rolcreaterole,
          r.rolcreatedb,
          r.rolcanlogin,
          r.rolreplication,
          r.rolbypassrls,
          has_schema_privilege($1, 'public', 'USAGE') as public_usage,
          has_schema_privilege($1, 'public', 'CREATE') as public_create,
          has_database_privilege($1, current_database(), 'CONNECT') as db_connect,
          has_database_privilege($1, current_database(), 'CREATE') as db_create,
          has_database_privilege($1, current_database(), 'TEMP') as db_temp
        from pg_roles r
        where r.rolname = $1
      ),
      table_state as (
        select
          count(*)::int as public_tables,
          count(*) filter (
            where has_table_privilege($1, c.oid, 'SELECT')
              and has_table_privilege($1, c.oid, 'INSERT')
              and has_table_privilege($1, c.oid, 'UPDATE')
              and has_table_privilege($1, c.oid, 'DELETE')
          )::int as runtime_crud_tables,
          count(*) filter (
            where has_table_privilege($1, c.oid, 'TRUNCATE')
          )::int as runtime_truncate_tables,
          count(*) filter (
            where has_table_privilege($1, c.oid, 'REFERENCES')
          )::int as runtime_references_tables,
          count(*) filter (
            where has_table_privilege($1, c.oid, 'TRIGGER')
          )::int as runtime_trigger_tables,
          count(*) filter (
            where has_table_privilege($1, c.oid, 'MAINTAIN')
          )::int as runtime_maintain_tables
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind in ('r', 'p')
      ),
      sequence_state as (
        select
          count(*)::int as public_sequences,
          count(*) filter (
            where has_sequence_privilege($1, c.oid, 'USAGE')
              and has_sequence_privilege($1, c.oid, 'SELECT')
          )::int as runtime_sequences,
          count(*) filter (
            where has_sequence_privilege($1, c.oid, 'UPDATE')
          )::int as runtime_update_sequences
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'S'
      ),
      function_state as (
        select
          count(*)::int as public_functions,
          count(*) filter (
            where has_function_privilege($1, p.oid, 'EXECUTE')
          )::int as runtime_functions,
          count(*) filter (
            where p.prosecdef
              and has_function_privilege($1, p.oid, 'EXECUTE')
          )::int as runtime_security_definer_functions
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
      ),
      ownership_state as (
        select
          exists (
            select 1
            from pg_database d
            join pg_roles r on r.oid = d.datdba
            where d.datname = current_database() and r.rolname = $1
          ) as database_owned_by_runtime,
          exists (
            select 1
            from pg_namespace n
            join pg_roles r on r.oid = n.nspowner
            where n.nspname = 'public' and r.rolname = $1
          ) as public_schema_owned_by_runtime,
          (
            select count(*)::int
            from pg_class c
            join pg_namespace n on n.oid = c.relnamespace
            join pg_roles r on r.oid = c.relowner
            where n.nspname = 'public'
              and c.relkind in ('r', 'p', 'S', 'v', 'm', 'f')
              and r.rolname = $1
          ) as runtime_owned_relations,
          (
            select count(*)::int
            from pg_proc p
            join pg_namespace n on n.oid = p.pronamespace
            join pg_roles r on r.oid = p.proowner
            where n.nspname = 'public' and r.rolname = $1
          ) as runtime_owned_functions
      ),
      membership_state as (
        select count(*)::int as role_memberships
        from pg_auth_members m
        join pg_roles member_role on member_role.oid = m.member
        where member_role.rolname = $1
      )
      select
        coalesce(rs.role_exists, false) as role_exists,
        coalesce(rs.rolsuper, false) as rolsuper,
        coalesce(rs.rolcreaterole, false) as rolcreaterole,
        coalesce(rs.rolcreatedb, false) as rolcreatedb,
        coalesce(rs.rolcanlogin, false) as rolcanlogin,
        coalesce(rs.rolreplication, false) as rolreplication,
        coalesce(rs.rolbypassrls, false) as rolbypassrls,
        coalesce(rs.public_usage, false) as public_usage,
        coalesce(rs.public_create, false) as public_create,
        coalesce(rs.db_connect, false) as db_connect,
        coalesce(rs.db_create, false) as db_create,
        coalesce(rs.db_temp, false) as db_temp,
        os.database_owned_by_runtime,
        os.public_schema_owned_by_runtime,
        os.runtime_owned_relations,
        os.runtime_owned_functions,
        ts.public_tables,
        ts.runtime_crud_tables,
        ts.runtime_truncate_tables,
        ts.runtime_references_tables,
        ts.runtime_trigger_tables,
        ts.runtime_maintain_tables,
        ss.public_sequences,
        ss.runtime_sequences,
        ss.runtime_update_sequences,
        fs.public_functions,
        fs.runtime_functions,
        fs.runtime_security_definer_functions,
        ms.role_memberships
      from table_state ts
      cross join sequence_state ss
      cross join function_state fs
      cross join ownership_state os
      cross join membership_state ms
      left join role_state rs on true
    `, [NEXA_RUNTIME_ROLE]);

    const defaultPrivilegeResult = await pool.query(`
      with default_entries as (
        select
          d.defaclrole,
          coalesce(n.nspname, '') as schema_name,
          d.defaclobjtype,
          x.privilege_type,
          x.is_grantable
        from pg_default_acl d
        left join pg_namespace n on n.oid = d.defaclnamespace
        cross join lateral aclexplode(d.defaclacl) x
        join pg_roles grantee on grantee.oid = x.grantee
        where grantee.rolname = $1
      ),
      default_groups as (
        select
          defaclrole,
          schema_name,
          defaclobjtype,
          count(distinct privilege_type)::int as privilege_count,
          count(distinct privilege_type) filter (
            where defaclobjtype = 'r'
              and privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
          )::int as table_allowed_count,
          count(distinct privilege_type) filter (
            where defaclobjtype = 'S'
              and privilege_type in ('USAGE', 'SELECT')
          )::int as sequence_allowed_count,
          count(distinct privilege_type) filter (
            where defaclobjtype = 'f'
              and privilege_type = 'EXECUTE'
          )::int as function_allowed_count,
          bool_or(is_grantable) as has_grant_option
        from default_entries
        group by defaclrole, schema_name, defaclobjtype
      )
      select
        count(*)::int as default_acl_groups,
        count(*) filter (where defaclobjtype = 'r')::int as default_table_acl_groups,
        count(*) filter (where defaclobjtype = 'S')::int as default_sequence_acl_groups,
        count(*) filter (where defaclobjtype = 'f')::int as default_function_acl_groups,
        count(*) filter (
          where schema_name <> 'public'
            or has_grant_option
            or case defaclobjtype
              when 'r' then not (privilege_count = 4 and table_allowed_count = 4)
              when 'S' then not (privilege_count = 2 and sequence_allowed_count = 2)
              when 'f' then not (privilege_count = 1 and function_allowed_count = 1)
              else true
            end
        )::int as default_acl_mismatched_groups,
        count(*) filter (where has_grant_option)::int as default_acl_grant_option_groups,
        count(*) filter (where schema_name <> 'public')::int as default_acl_outside_public_groups
      from default_groups
    `, [NEXA_RUNTIME_ROLE]);

    return buildNexaRuntimeRoleAttestation(
      result.rows[0] ?? {},
      defaultPrivilegeResult.rows[0] ?? {},
    );
  } finally {
    await pool.end();
  }
}

async function main() {
  const attestation = await queryNexaRuntimeRoleAttestation();
  process.stdout.write(`${JSON.stringify(attestation, null, 2)}\n`);
  if (!attestation.secure) process.exit(1);
}

const invokedAsScript = process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedAsScript) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : 'NEXA runtime-role attestation failed.');
    process.exit(1);
  });
}
