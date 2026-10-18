import { query } from '@/lib/db';
import {
  classifyNexaDataApiIsolation,
  type NexaDataApiIsolationRow,
  type NexaDataApiIsolationStatus,
} from '@/lib/supabase-data-api-isolation-core';

export const NEXA_DATA_API_ISOLATION_CACHE_MS = 60_000;

export type NexaDataApiIsolationReadinessStatus =
  | NexaDataApiIsolationStatus
  | 'unavailable';

export type NexaDataApiIsolationReadinessReason =
  | 'current_data_api_exposure'
  | 'future_default_privilege_risk'
  | 'attestation_unavailable'
  | null;

export type NexaDataApiIsolationReadiness = Readonly<{
  status: NexaDataApiIsolationReadinessStatus;
  reason: NexaDataApiIsolationReadinessReason;
  checkedAt: string;
  latencyMs: number;
}>;

type CachedDataApiIsolationReadiness = Readonly<{
  expiresAt: number;
  value: NexaDataApiIsolationReadiness;
}>;

const globalForDataApiIsolation = globalThis as typeof globalThis & {
  nexaDataApiIsolationReadinessCache?: CachedDataApiIsolationReadiness;
};

function reasonFor(status: NexaDataApiIsolationReadinessStatus): NexaDataApiIsolationReadinessReason {
  if (status === 'isolated') return null;
  if (status === 'future-default-risk') return 'future_default_privilege_risk';
  if (status === 'exposed') return 'current_data_api_exposure';
  return 'attestation_unavailable';
}

export async function getNexaDataApiIsolationReadiness(
  options: Readonly<{ bypassCache?: boolean }> = {},
): Promise<NexaDataApiIsolationReadiness> {
  const started = Date.now();
  const useCache = !options.bypassCache;
  const cached = globalForDataApiIsolation.nexaDataApiIsolationReadinessCache;

  if (useCache && cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  try {
    const result = await query<NexaDataApiIsolationRow>(`
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
    const status = classifyNexaDataApiIsolation(result.rows[0]);
    const value = Object.freeze({
      status,
      reason: reasonFor(status),
      checkedAt: new Date().toISOString(),
      latencyMs: Date.now() - started,
    } satisfies NexaDataApiIsolationReadiness);

    if (useCache) {
      globalForDataApiIsolation.nexaDataApiIsolationReadinessCache = {
        expiresAt: Date.now() + NEXA_DATA_API_ISOLATION_CACHE_MS,
        value,
      };
    }

    return value;
  } catch {
    const value = Object.freeze({
      status: 'unavailable',
      reason: 'attestation_unavailable',
      checkedAt: new Date().toISOString(),
      latencyMs: Date.now() - started,
    } satisfies NexaDataApiIsolationReadiness);

    if (useCache) {
      globalForDataApiIsolation.nexaDataApiIsolationReadinessCache = {
        expiresAt: Date.now() + NEXA_DATA_API_ISOLATION_CACHE_MS,
        value,
      };
    }

    return value;
  }
}
