import { query } from '@/lib/db';
import {
  classifyNexaDataApiRemediationPlan,
  type NexaDataApiRemediationAction,
  type NexaDataApiRemediationStatus,
  type NexaDataApiSqlRemediationFeasibility,
} from '@/lib/supabase-data-api-remediation-core';
import type { NexaDataApiIsolationReadinessStatus } from '@/lib/supabase-data-api-isolation';
import type { NexaDataApiPlatformStatus } from '@/lib/supabase-data-api-platform-core';

export const NEXA_DATA_API_REMEDIATION_READINESS_CACHE_MS = 60_000;

export type NexaDataApiRemediationReadinessStatus =
  | NexaDataApiRemediationStatus
  | 'unavailable';

export type NexaDataApiRemediationReadinessAction =
  | NexaDataApiRemediationAction
  | 'verify-data-api-remediation-attestation';

export type NexaDataApiRemediationReadinessSqlFeasibility =
  | NexaDataApiSqlRemediationFeasibility
  | 'unknown';

export type NexaDataApiRemediationReadiness = Readonly<{
  status: NexaDataApiRemediationReadinessStatus;
  recommendedAction: NexaDataApiRemediationReadinessAction;
  sqlRemediationFeasibility: NexaDataApiRemediationReadinessSqlFeasibility;
  checkedAt: string;
  latencyMs: number;
}>;

type OwnerRow = Readonly<{
  risky_default_owner_count: number | string;
  alterable_risky_default_owner_count: number | string;
}>;

type CacheEntry = Readonly<{
  key: string;
  expiresAt: number;
  value: NexaDataApiRemediationReadiness;
}>;

const globalForRemediation = globalThis as typeof globalThis & {
  nexaDataApiRemediationReadinessCache?: CacheEntry;
};

function boundedPlan(input: ReturnType<typeof classifyNexaDataApiRemediationPlan>, started: number) {
  return Object.freeze({
    status: input.status,
    recommendedAction: input.recommendedAction,
    sqlRemediationFeasibility: input.sqlRemediationFeasibility,
    checkedAt: new Date().toISOString(),
    latencyMs: Date.now() - started,
  } satisfies NexaDataApiRemediationReadiness);
}

function unavailable(started: number): NexaDataApiRemediationReadiness {
  return Object.freeze({
    status: 'unavailable',
    recommendedAction: 'verify-data-api-remediation-attestation',
    sqlRemediationFeasibility: 'unknown',
    checkedAt: new Date().toISOString(),
    latencyMs: Date.now() - started,
  });
}

export async function getNexaDataApiRemediationReadiness(input: Readonly<{
  platformStatus: NexaDataApiPlatformStatus;
  isolationStatus: NexaDataApiIsolationReadinessStatus;
  bypassCache?: boolean;
}>): Promise<NexaDataApiRemediationReadiness> {
  const started = Date.now();
  const cacheKey = `${input.platformStatus}:${input.isolationStatus}`;
  const cached = globalForRemediation.nexaDataApiRemediationReadinessCache;

  if (!input.bypassCache && cached && cached.key === cacheKey && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  try {
    let riskyDefaultOwnerCount = 0;
    let alterableRiskyDefaultOwnerCount = 0;

    if (
      input.platformStatus === 'enabled'
      && input.isolationStatus !== 'unavailable'
      && input.isolationStatus !== 'isolated'
    ) {
      const result = await query<OwnerRow>(`
        with risky_default_owners as (
          select distinct d.defaclrole
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
        current_role_state as (
          select r.rolsuper
          from pg_roles r
          where r.rolname = current_user
        )
        select
          count(*)::int as risky_default_owner_count,
          count(*) filter (
            where owner.rolname = current_user
               or coalesce((select rolsuper from current_role_state), false)
               or pg_has_role(current_user, owner.rolname, 'MEMBER')
          )::int as alterable_risky_default_owner_count
        from risky_default_owners risky
        join pg_roles owner on owner.oid = risky.defaclrole
      `);
      const row = result.rows[0];
      riskyDefaultOwnerCount = Number(row?.risky_default_owner_count ?? 0);
      alterableRiskyDefaultOwnerCount = Number(row?.alterable_risky_default_owner_count ?? 0);
    }

    const value = boundedPlan(
      classifyNexaDataApiRemediationPlan({
        platformStatus: input.platformStatus,
        isolationStatus: input.isolationStatus,
        riskyDefaultOwnerCount,
        alterableRiskyDefaultOwnerCount,
      }),
      started,
    );

    if (!input.bypassCache) {
      globalForRemediation.nexaDataApiRemediationReadinessCache = {
        key: cacheKey,
        expiresAt: Date.now() + NEXA_DATA_API_REMEDIATION_READINESS_CACHE_MS,
        value,
      };
    }

    return value;
  } catch {
    return unavailable(started);
  }
}
