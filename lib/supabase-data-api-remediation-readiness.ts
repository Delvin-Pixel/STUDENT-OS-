import { query } from '@/lib/db';
import {
  classifyNexaDataApiRemediationPlan,
  type NexaDataApiRemediationAction,
  type NexaDataApiRemediationPlan,
  type NexaDataApiRemediationStatus,
  type NexaDataApiSqlRemediationFeasibility,
} from '@/lib/supabase-data-api-remediation-core';
import type { NexaDataApiEffectiveSecurityReason } from '@/lib/supabase-data-api-effective-security-core';
import type { NexaDataApiIsolationReadinessStatus } from '@/lib/supabase-data-api-isolation';
import type { NexaDataApiPlatformStatus } from '@/lib/supabase-data-api-platform-core';

export const NEXA_DATA_API_REMEDIATION_READINESS_CACHE_MS = 60_000;

export type NexaDataApiRemediationReadinessStatus =
  | NexaDataApiRemediationStatus
  | 'unavailable';

export type NexaDataApiRemediationReadinessAction =
  | NexaDataApiRemediationAction
  | 'review-remediation-attestation';

export type NexaDataApiRemediationReadinessSqlFeasibility =
  | NexaDataApiSqlRemediationFeasibility
  | 'unknown';

export type NexaDataApiRemediationReadinessReason =
  | NexaDataApiEffectiveSecurityReason
  | 'remediation_attestation_unavailable';

export type NexaDataApiRemediationReadiness = Readonly<{
  status: NexaDataApiRemediationReadinessStatus;
  recommendedAction: NexaDataApiRemediationReadinessAction;
  sqlRemediationFeasibility: NexaDataApiRemediationReadinessSqlFeasibility;
  reason: NexaDataApiRemediationReadinessReason;
  checkedAt: string;
  latencyMs: number;
}>;

type NexaDataApiRemediationOwnerRow = Readonly<{
  risky_default_owner_count: number | string;
  alterable_risky_default_owner_count: number | string;
}>;

type CacheEntry = Readonly<{
  key: string;
  expiresAt: number;
  value: NexaDataApiRemediationReadiness;
}>;

const globalForDataApiRemediation = globalThis as typeof globalThis & {
  nexaDataApiRemediationReadinessCache?: CacheEntry;
};

function fromPlan(
  started: number,
  plan: NexaDataApiRemediationPlan,
): NexaDataApiRemediationReadiness {
  return Object.freeze({
    status: plan.status,
    recommendedAction: plan.recommendedAction,
    sqlRemediationFeasibility: plan.sqlRemediationFeasibility,
    reason: plan.effectiveSecurityReason,
    checkedAt: new Date().toISOString(),
    latencyMs: Date.now() - started,
  });
}

function unavailable(started: number): NexaDataApiRemediationReadiness {
  return Object.freeze({
    status: 'unavailable',
    recommendedAction: 'review-remediation-attestation',
    sqlRemediationFeasibility: 'unknown',
    reason: 'remediation_attestation_unavailable',
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

  if (
    input.platformStatus === 'disabled'
    || input.platformStatus === 'unavailable'
    || input.isolationStatus === 'unavailable'
  ) {
    return fromPlan(started, classifyNexaDataApiRemediationPlan({
      platformStatus: input.platformStatus,
      isolationStatus: input.isolationStatus,
      riskyDefaultOwnerCount: 0,
      alterableRiskyDefaultOwnerCount: 0,
    }));
  }

  const cacheKey = `${input.platformStatus}:${input.isolationStatus}`;
  const cached = globalForDataApiRemediation.nexaDataApiRemediationReadinessCache;
  if (!input.bypassCache && cached && cached.key === cacheKey && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  try {
    const result = await query<NexaDataApiRemediationOwnerRow>(`
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

    const row = result.rows[0] ?? {
      risky_default_owner_count: 0,
      alterable_risky_default_owner_count: 0,
    };
    const plan = classifyNexaDataApiRemediationPlan({
      platformStatus: input.platformStatus,
      isolationStatus: input.isolationStatus,
      riskyDefaultOwnerCount: Number(row.risky_default_owner_count),
      alterableRiskyDefaultOwnerCount: Number(row.alterable_risky_default_owner_count),
    });
    const value = fromPlan(started, plan);

    if (!input.bypassCache) {
      globalForDataApiRemediation.nexaDataApiRemediationReadinessCache = {
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
