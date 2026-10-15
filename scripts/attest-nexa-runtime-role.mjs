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

export function buildNexaRuntimeRoleAttestation(row = {}) {
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

  const publicTables = count(row.public_tables, 'public_tables');
  const runtimeCrudTables = count(row.runtime_crud_tables, 'runtime_crud_tables');
  const publicSequences = count(row.public_sequences, 'public_sequences');
  const runtimeSequences = count(row.runtime_sequences, 'runtime_sequences');
  const publicFunctions = count(row.public_functions, 'public_functions');
  const runtimeFunctions = count(row.runtime_functions, 'runtime_functions');
  const roleMemberships = count(row.role_memberships, 'role_memberships');

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
    noRoleMemberships: roleMemberships === 0,
    tableCrudCoverage: runtimeCrudTables === publicTables,
    sequenceUsageCoverage: runtimeSequences === publicSequences,
    functionExecuteCoverage: runtimeFunctions === publicFunctions,
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
      publicSequences,
      runtimeSequences,
      publicFunctions,
      runtimeFunctions,
      roleMemberships,
      databaseTemp,
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
            where has_table_privilege($1, c.oid, 'SELECT,INSERT,UPDATE,DELETE')
          )::int as runtime_crud_tables
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind in ('r', 'p')
      ),
      sequence_state as (
        select
          count(*)::int as public_sequences,
          count(*) filter (
            where has_sequence_privilege($1, c.oid, 'USAGE,SELECT')
          )::int as runtime_sequences
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'S'
      ),
      function_state as (
        select
          count(*)::int as public_functions,
          count(*) filter (
            where has_function_privilege($1, p.oid, 'EXECUTE')
          )::int as runtime_functions
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
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
        ts.public_tables,
        ts.runtime_crud_tables,
        ss.public_sequences,
        ss.runtime_sequences,
        fs.public_functions,
        fs.runtime_functions,
        ms.role_memberships
      from table_state ts
      cross join sequence_state ss
      cross join function_state fs
      cross join membership_state ms
      left join role_state rs on true
    `, [NEXA_RUNTIME_ROLE]);

    return buildNexaRuntimeRoleAttestation(result.rows[0] ?? {});
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
