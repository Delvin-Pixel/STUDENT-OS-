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
      with named_roles as (
        select rolname
        from pg_roles
        where rolname in ('anon', 'authenticated')
      ),
      public_schema as (
        select oid, nspowner, nspacl
        from pg_namespace
        where nspname = 'public'
      ),
      public_schema_acl as (
        select x.grantee, x.privilege_type
        from public_schema s
        cross join lateral aclexplode(
          coalesce(s.nspacl, acldefault('n', s.nspowner))
        ) x
      ),
      schema_state as (
        select (
          select count(*)::int
          from named_roles r
          where has_schema_privilege(r.rolname, 'public', 'USAGE')
             or has_schema_privilege(r.rolname, 'public', 'CREATE')
        ) + (
          select count(*)::int
          from (
            select 1
            from public_schema_acl
            where grantee = 0
              and privilege_type in ('USAGE', 'CREATE')
            limit 1
          ) public_exposure
        ) as current_schema_exposures
      ),
      table_state as (
        select
          (
            select coalesce(sum((
              select count(*)::int
              from pg_class c
              join pg_namespace n on n.oid = c.relnamespace
              where n.nspname = 'public'
                and c.relkind in ('r', 'p')
                and (
                  has_table_privilege(r.rolname, c.oid, 'SELECT')
                  or has_table_privilege(r.rolname, c.oid, 'INSERT')
                  or has_table_privilege(r.rolname, c.oid, 'UPDATE')
                  or has_table_privilege(r.rolname, c.oid, 'DELETE')
                  or has_table_privilege(r.rolname, c.oid, 'TRUNCATE')
                  or has_table_privilege(r.rolname, c.oid, 'REFERENCES')
                  or has_table_privilege(r.rolname, c.oid, 'TRIGGER')
                  or has_table_privilege(r.rolname, c.oid, 'MAINTAIN')
                )
            )), 0)::int
            from named_roles r
          ) + (
            select count(*)::int
            from pg_class c
            join pg_namespace n on n.oid = c.relnamespace
            cross join lateral aclexplode(
              coalesce(c.relacl, acldefault('r', c.relowner))
            ) x
            where n.nspname = 'public'
              and c.relkind in ('r', 'p')
              and x.grantee = 0
              and x.privilege_type in (
                'SELECT','INSERT','UPDATE','DELETE',
                'TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'
              )
          ) as current_table_exposures
      ),
      sequence_state as (
        select
          (
            select coalesce(sum((
              select count(*)::int
              from pg_class c
              join pg_namespace n on n.oid = c.relnamespace
              where n.nspname = 'public'
                and c.relkind = 'S'
                and (
                  has_sequence_privilege(r.rolname, c.oid, 'USAGE')
                  or has_sequence_privilege(r.rolname, c.oid, 'SELECT')
                  or has_sequence_privilege(r.rolname, c.oid, 'UPDATE')
                )
            )), 0)::int
            from named_roles r
          ) + (
            select count(*)::int
            from pg_class c
            join pg_namespace n on n.oid = c.relnamespace
            cross join lateral aclexplode(
              coalesce(c.relacl, acldefault('S', c.relowner))
            ) x
            where n.nspname = 'public'
              and c.relkind = 'S'
              and x.grantee = 0
              and x.privilege_type in ('USAGE','SELECT','UPDATE')
          ) as current_sequence_exposures
      ),
      function_state as (
        select
          (
            select coalesce(sum((
              select count(*)::int
              from pg_proc p
              join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public'
                and has_function_privilege(r.rolname, p.oid, 'EXECUTE')
            )), 0)::int
            from named_roles r
          ) + (
            select count(*)::int
            from pg_proc p
            join pg_namespace n on n.oid = p.pronamespace
            cross join lateral aclexplode(
              coalesce(p.proacl, acldefault('f', p.proowner))
            ) x
            where n.nspname = 'public'
              and x.grantee = 0
              and x.privilege_type = 'EXECUTE'
          ) as current_function_exposures
      ),
      relevant_default_owners as (
        select distinct d.defaclrole as role_oid
        from pg_default_acl d
        left join pg_namespace n on n.oid = d.defaclnamespace
        where d.defaclnamespace = 0 or n.nspname = 'public'
        union
        select distinct c.relowner
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public'
        union
        select distinct p.proowner
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
      ),
      explicit_default_groups as (
        select distinct
          d.defaclrole,
          d.defaclnamespace,
          d.defaclobjtype,
          x.grantee,
          bool_or(x.is_grantable) over (
            partition by d.defaclrole, d.defaclnamespace, d.defaclobjtype, x.grantee
          ) as has_grant_option
        from pg_default_acl d
        left join pg_namespace n on n.oid = d.defaclnamespace
        cross join lateral aclexplode(d.defaclacl) x
        left join pg_roles grantee on grantee.oid = x.grantee
        where (d.defaclnamespace = 0 or n.nspname = 'public')
          and (
            x.grantee = 0
            or grantee.rolname in ('anon', 'authenticated')
          )
      ),
      implicit_public_function_defaults as (
        select distinct owner.role_oid
        from relevant_default_owners owner
        cross join lateral aclexplode(
          coalesce(
            (
              select d.defaclacl
              from pg_default_acl d
              where d.defaclrole = owner.role_oid
                and d.defaclnamespace = 0
                and d.defaclobjtype = 'f'
              limit 1
            ),
            acldefault('f', owner.role_oid)
          )
        ) x
        where x.grantee = 0 and x.privilege_type = 'EXECUTE'
      )
      select
        ss.current_schema_exposures,
        ts.current_table_exposures,
        qs.current_sequence_exposures,
        fs.current_function_exposures,
        (
          (select count(*) from explicit_default_groups)
          + (select count(*) from implicit_public_function_defaults)
        )::int as public_default_acl_exposures,
        (
          select count(*)::int
          from explicit_default_groups
          where has_grant_option
        ) as public_default_acl_grant_options
      from schema_state ss
      cross join table_state ts
      cross join sequence_state qs
      cross join function_state fs
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
