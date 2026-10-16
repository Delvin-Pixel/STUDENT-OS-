import { query } from '@/lib/db';
export type {
  NexaRuntimeRoleSecurityReason,
  NexaRuntimeRoleSecurityStatus,
} from '@/lib/runtime-role-security-core';

import {
  NEXA_RUNTIME_ROLE,
  classifyNexaRuntimeRoleSecurity,
  type NexaRuntimeRoleSecurityReason,
  type NexaRuntimeRoleSecurityStatus,
  type RuntimeRoleSecurityRow,
} from '@/lib/runtime-role-security-core';

export const NEXA_RUNTIME_ROLE_SECURITY_CACHE_MS = 60_000;

export type NexaRuntimeRoleSecurity = Readonly<{
  status: NexaRuntimeRoleSecurityStatus;
  reason: NexaRuntimeRoleSecurityReason;
  checkedAt: string;
  latencyMs: number;
}>;

type CachedRuntimeRoleSecurity = Readonly<{
  expiresAt: number;
  value: NexaRuntimeRoleSecurity;
}>;

const globalForRuntimeRoleSecurity = globalThis as typeof globalThis & {
  nexaRuntimeRoleSecurityCache?: CachedRuntimeRoleSecurity;
};

export async function getNexaRuntimeRoleSecurity(
  options: Readonly<{ bypassCache?: boolean }> = {},
): Promise<NexaRuntimeRoleSecurity> {
  const started = Date.now();
  const useCache = !options.bypassCache;
  const cached = globalForRuntimeRoleSecurity.nexaRuntimeRoleSecurityCache;

  if (useCache && cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  try {
    const result = await query<RuntimeRoleSecurityRow>(`
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
          has_database_privilege($1, current_database(), 'CREATE') as db_create
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
          )::int as runtime_crud_tables
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
        os.database_owned_by_runtime,
        os.public_schema_owned_by_runtime,
        os.runtime_owned_relations,
        os.runtime_owned_functions,
        ts.public_tables,
        ts.runtime_crud_tables,
        ss.public_sequences,
        ss.runtime_sequences,
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

    const status = classifyNexaRuntimeRoleSecurity(result.rows[0]);
    const value = Object.freeze({
      status,
      reason: status === 'secure' ? null : 'least_privilege_violation',
      checkedAt: new Date().toISOString(),
      latencyMs: Date.now() - started,
    } satisfies NexaRuntimeRoleSecurity);

    if (useCache) {
      globalForRuntimeRoleSecurity.nexaRuntimeRoleSecurityCache = {
        expiresAt: Date.now() + NEXA_RUNTIME_ROLE_SECURITY_CACHE_MS,
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
    } satisfies NexaRuntimeRoleSecurity);

    if (useCache) {
      globalForRuntimeRoleSecurity.nexaRuntimeRoleSecurityCache = {
        expiresAt: Date.now() + NEXA_RUNTIME_ROLE_SECURITY_CACHE_MS,
        value,
      };
    }

    return value;
  }
}
