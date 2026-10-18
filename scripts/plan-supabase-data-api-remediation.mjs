#!/usr/bin/env node
import pg from 'pg';
import { pathToFileURL } from 'node:url';
import { queryNexaDataApiIsolation } from './attest-supabase-data-api-isolation.mjs';

const DEFAULT_TIMEOUT_MS = 5_000;
const MAX_PROBE_BODY_BYTES = 2_048;
const PROBE_RELATION = '__nexa_data_api_platform_probe_nonexistent__';
const PROBE_COLUMN = '__nexa_probe_column__';

function boundedCount(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function effectiveSecurity(platformStatus, isolationStatus) {
  if (platformStatus === 'unavailable') {
    return { status: 'unavailable', reason: 'data_api_platform_unavailable' };
  }
  if (platformStatus === 'disabled') {
    return { status: 'secure', reason: null };
  }
  if (isolationStatus === 'unavailable') {
    return { status: 'unavailable', reason: 'data_api_isolation_unavailable' };
  }
  if (isolationStatus === 'exposed') {
    return { status: 'insecure', reason: 'data_api_current_exposure' };
  }
  if (isolationStatus === 'future-default-risk') {
    return { status: 'insecure', reason: 'data_api_future_default_risk' };
  }
  return { status: 'secure', reason: null };
}

export function classifyRemediationPlan(input) {
  const riskyDefaultOwnerCount = boundedCount(input.riskyDefaultOwnerCount);
  const alterableRiskyDefaultOwnerCount = Math.min(
    riskyDefaultOwnerCount,
    boundedCount(input.alterableRiskyDefaultOwnerCount),
  );
  const protectedRiskyDefaultOwnerCount = Math.max(
    0,
    riskyDefaultOwnerCount - alterableRiskyDefaultOwnerCount,
  );
  const effective = effectiveSecurity(input.platformStatus, input.isolationStatus);
  const currentExposure = input.isolationStatus === 'exposed';
  const futureDefaultRisk = input.isolationStatus === 'future-default-risk';

  const common = {
    automaticRemediation: false,
    evidence: Object.freeze({
      platformStatus: input.platformStatus,
      isolationStatus: input.isolationStatus,
      effectiveSecurityStatus: effective.status,
      effectiveSecurityReason: effective.reason,
      riskyDefaultOwnerCount,
      alterableRiskyDefaultOwnerCount,
      protectedRiskyDefaultOwnerCount,
    }),
  };

  if (effective.status === 'secure') {
    return Object.freeze({
      status: 'no-action',
      recommendedAction: 'none',
      sqlRemediationFeasibility: 'not-needed',
      currentExposure,
      futureDefaultRisk,
      ...common,
    });
  }

  if (effective.status === 'unavailable') {
    return Object.freeze({
      status: 'verification-required',
      recommendedAction: effective.reason === 'data_api_platform_unavailable'
        ? 'verify-data-api-platform-state'
        : 'verify-data-api-isolation-attestation',
      sqlRemediationFeasibility: 'not-evaluated',
      currentExposure,
      futureDefaultRisk,
      ...common,
    });
  }

  if (effective.reason === 'data_api_current_exposure') {
    return Object.freeze({
      status: 'security-review-required',
      recommendedAction: 'review-current-data-api-exposure',
      sqlRemediationFeasibility: protectedRiskyDefaultOwnerCount > 0
        ? 'blocked-by-default-owner'
        : 'technically-possible-but-automatic-remediation-disabled',
      currentExposure,
      futureDefaultRisk,
      ...common,
    });
  }

  return Object.freeze({
    status: 'owner-action-required',
    recommendedAction: 'disable-data-api-in-dashboard',
    sqlRemediationFeasibility: protectedRiskyDefaultOwnerCount > 0
      ? 'blocked-by-default-owner'
      : 'technically-possible-but-automatic-remediation-disabled',
    currentExposure,
    futureDefaultRisk,
    ...common,
  });
}

function configuredProbe(input = {}) {
  const rawUrl = String(input.supabaseUrl ?? process.env.NEXA_SUPABASE_URL ?? '').trim();
  const publishableKey = String(
    input.publishableKey ?? process.env.NEXA_SUPABASE_PUBLISHABLE_KEY ?? '',
  ).trim();

  if (!rawUrl || !publishableKey) return null;

  const url = new URL(rawUrl);
  if (
    url.protocol !== 'https:'
    || !/^[a-z0-9]{20}\.supabase\.co$/.test(url.hostname)
    || (url.pathname !== '/' && url.pathname !== '')
    || url.search
    || url.hash
  ) {
    return null;
  }

  const probe = new URL(`/rest/v1/${PROBE_RELATION}`, url.origin);
  probe.searchParams.set('select', PROBE_COLUMN);
  probe.searchParams.set('limit', '0');

  return Object.freeze({ url: probe.toString(), publishableKey });
}

async function boundedPostgrestCode(response) {
  if (!response.body) return null;
  try {
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_PROBE_BODY_BYTES) return null;
    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const code = parsed.code;
    return typeof code === 'string' && /^PGRST\d{3}$/.test(code) ? code : null;
  } catch {
    return null;
  }
}

export async function probeDataApiPlatform(options = {}) {
  const endpoint = configuredProbe(options);
  if (!endpoint) {
    return Object.freeze({ status: 'unavailable', reason: 'configuration_missing' });
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = Number.isInteger(options.timeoutMs)
    && options.timeoutMs >= 1_000
    && options.timeoutMs <= 15_000
    ? options.timeoutMs
    : DEFAULT_TIMEOUT_MS;

  try {
    const response = await fetchImpl(endpoint.url, {
      method: 'GET',
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        Accept: 'application/json',
        apikey: endpoint.publishableKey,
      },
    });
    const code = await boundedPostgrestCode(response);

    if (response.status === 401) {
      return Object.freeze({ status: 'unavailable', reason: 'credential_rejected' });
    }
    if (response.status >= 200 && response.status < 300) {
      return Object.freeze({ status: 'enabled', reason: null });
    }
    if (code === 'PGRST205' || code === 'PGRST204') {
      return Object.freeze({ status: 'enabled', reason: null });
    }
    if (code === 'PGRST106' || ((response.status === 404 || response.status === 410) && !code)) {
      return Object.freeze({ status: 'disabled', reason: null });
    }
    return Object.freeze({ status: 'unavailable', reason: 'unexpected_status' });
  } catch {
    return Object.freeze({ status: 'unavailable', reason: 'probe_failed' });
  }
}

export async function queryDataApiRemediationPlan(options = {}) {
  const connectionString = options.connectionString ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required for Data API remediation planning.');
  }

  const [isolation, platform] = await Promise.all([
    queryNexaDataApiIsolation({ connectionString }),
    probeDataApiPlatform(options),
  ]);

  const pool = new pg.Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 10_000,
    statement_timeout: 15_000,
  });

  try {
    const result = await pool.query(`
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
      current_role as (
        select r.rolsuper
        from pg_roles r
        where r.rolname = current_user
      )
      select
        count(*)::int as risky_default_owner_count,
        count(*) filter (
          where owner.rolname = current_user
             or (select rolsuper from current_role)
             or pg_has_role(current_user, owner.rolname, 'MEMBER')
        )::int as alterable_risky_default_owner_count
      from risky_default_owners risky
      join pg_roles owner on owner.oid = risky.defaclrole
    `);

    const row = result.rows[0] ?? {};
    return classifyRemediationPlan({
      platformStatus: platform.status,
      isolationStatus: isolation.status,
      riskyDefaultOwnerCount: row.risky_default_owner_count,
      alterableRiskyDefaultOwnerCount: row.alterable_risky_default_owner_count,
    });
  } finally {
    await pool.end();
  }
}

async function main() {
  const plan = await queryDataApiRemediationPlan();
  process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
  if (
    plan.status === 'security-review-required'
    || plan.status === 'verification-required'
  ) {
    process.exit(1);
  }
}

const invokedAsScript = process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedAsScript) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : 'Data API remediation planning failed.');
    process.exit(1);
  });
}
