#!/usr/bin/env node
import pg from 'pg';
import { pathToFileURL } from 'node:url';
function count(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

export function classifyNexaDataApiIsolationEvidence(row) {
  if (!row) return 'exposed';
  const values = [
    count(row.current_schema_exposures),
    count(row.current_table_exposures),
    count(row.current_sequence_exposures),
    count(row.current_function_exposures),
    count(row.public_default_acl_exposures),
    count(row.public_default_acl_grant_options),
  ];
  if (values.some((value) => value === null)) return 'exposed';

  const [schema, tables, sequences, functions, defaults, grantOptions] = values;
  if (schema > 0 || tables > 0 || sequences > 0 || functions > 0) return 'exposed';
  if (defaults > 0 || grantOptions > 0) return 'future-default-risk';
  return 'isolated';
}

export async function queryNexaDataApiIsolation(options = {}) {
  const connectionString = options.connectionString ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required for Supabase Data API isolation attestation.');
  }

  const pool = new pg.Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 10_000,
    statement_timeout: 15_000,
  });

  try {
    const result = await pool.query(`
      with blocked_roles as (
        select 'PUBLIC'::text as role_name
        union all
        select rolname from pg_roles where rolname in ('anon', 'authenticated')
      ),
      current_state as (
        select
          count(*) filter (
            where has_schema_privilege(br.role_name, 'public', 'USAGE')
               or has_schema_privilege(br.role_name, 'public', 'CREATE')
          )::int as current_schema_exposures,
          sum((
            select count(*)::int
            from pg_class c
            join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'public'
              and c.relkind in ('r', 'p')
              and (
                has_table_privilege(br.role_name, c.oid, 'SELECT')
                or has_table_privilege(br.role_name, c.oid, 'INSERT')
                or has_table_privilege(br.role_name, c.oid, 'UPDATE')
                or has_table_privilege(br.role_name, c.oid, 'DELETE')
                or has_table_privilege(br.role_name, c.oid, 'TRUNCATE')
                or has_table_privilege(br.role_name, c.oid, 'REFERENCES')
                or has_table_privilege(br.role_name, c.oid, 'TRIGGER')
                or has_table_privilege(br.role_name, c.oid, 'MAINTAIN')
              )
          ))::int as current_table_exposures,
          sum((
            select count(*)::int
            from pg_class c
            join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'public'
              and c.relkind = 'S'
              and (
                has_sequence_privilege(br.role_name, c.oid, 'USAGE')
                or has_sequence_privilege(br.role_name, c.oid, 'SELECT')
                or has_sequence_privilege(br.role_name, c.oid, 'UPDATE')
              )
          ))::int as current_sequence_exposures,
          sum((
            select count(*)::int
            from pg_proc p
            join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public'
              and has_function_privilege(br.role_name, p.oid, 'EXECUTE')
          ))::int as current_function_exposures
        from blocked_roles br
      ),
      default_entries as (
        select
          d.defaclrole,
          d.defaclobjtype,
          coalesce(n.nspname, '') as schema_name,
          case when x.grantee = 0 then 'PUBLIC' else grantee.rolname end as grantee,
          x.is_grantable
        from pg_default_acl d
        left join pg_namespace n on n.oid = d.defaclnamespace
        cross join lateral aclexplode(d.defaclacl) x
        left join pg_roles grantee on grantee.oid = x.grantee
        where coalesce(n.nspname, '') = 'public'
          and (
            x.grantee = 0
            or grantee.rolname in ('anon', 'authenticated')
          )
      ),
      default_groups as (
        select
          defaclrole,
          defaclobjtype,
          schema_name,
          grantee,
          bool_or(is_grantable) as has_grant_option
        from default_entries
        group by defaclrole, defaclobjtype, schema_name, grantee
      )
      select
        cs.current_schema_exposures,
        coalesce(cs.current_table_exposures, 0)::int as current_table_exposures,
        coalesce(cs.current_sequence_exposures, 0)::int as current_sequence_exposures,
        coalesce(cs.current_function_exposures, 0)::int as current_function_exposures,
        (select count(*)::int from default_groups) as public_default_acl_exposures,
        (select count(*)::int from default_groups where has_grant_option) as public_default_acl_grant_options
      from current_state cs
    `);

    const row = result.rows[0] ?? {};
    const status = classifyNexaDataApiIsolationEvidence(row);
    return Object.freeze({
      status,
      dataApiIntegration: 'unknown',
      automaticRemediation: false,
      evidence: Object.freeze({
        currentSchemaExposures: Number(row.current_schema_exposures ?? 0),
        currentTableExposures: Number(row.current_table_exposures ?? 0),
        currentSequenceExposures: Number(row.current_sequence_exposures ?? 0),
        currentFunctionExposures: Number(row.current_function_exposures ?? 0),
        publicDefaultAclExposures: Number(row.public_default_acl_exposures ?? 0),
        publicDefaultAclGrantOptions: Number(row.public_default_acl_grant_options ?? 0),
      }),
    });
  } finally {
    await pool.end();
  }
}

async function main() {
  const attestation = await queryNexaDataApiIsolation();
  process.stdout.write(`${JSON.stringify(attestation, null, 2)}\n`);
  if (attestation.status === 'exposed') process.exit(1);
}

const invokedAsScript = process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedAsScript) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : 'Data API isolation attestation failed.');
    process.exit(1);
  });
}
