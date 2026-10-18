#!/usr/bin/env node
import pg from 'pg';
import { pathToFileURL } from 'node:url';
import { queryNexaDataApiIsolation } from './attest-supabase-data-api-isolation.mjs';

function boundedCount(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
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

  if (input.isolationStatus === 'isolated') {
    return Object.freeze({
      status: 'no-action',
      recommendedAction: 'none',
      sqlRemediationFeasibility: 'not-needed',
      automaticRemediation: false,
      evidence: Object.freeze({
        isolationStatus: input.isolationStatus,
        riskyDefaultOwnerCount,
        alterableRiskyDefaultOwnerCount,
        protectedRiskyDefaultOwnerCount,
      }),
    });
  }

  if (input.isolationStatus === 'exposed') {
    return Object.freeze({
      status: 'security-review-required',
      recommendedAction: 'review-current-data-api-exposure',
      sqlRemediationFeasibility: protectedRiskyDefaultOwnerCount > 0
        ? 'blocked-by-default-owner'
        : 'technically-possible-but-automatic-remediation-disabled',
      automaticRemediation: false,
      evidence: Object.freeze({
        isolationStatus: input.isolationStatus,
        riskyDefaultOwnerCount,
        alterableRiskyDefaultOwnerCount,
        protectedRiskyDefaultOwnerCount,
      }),
    });
  }

  return Object.freeze({
    status: 'owner-action-required',
    recommendedAction: 'disable-data-api-in-dashboard',
    sqlRemediationFeasibility: protectedRiskyDefaultOwnerCount > 0
      ? 'blocked-by-default-owner'
      : 'technically-possible-but-automatic-remediation-disabled',
    automaticRemediation: false,
    evidence: Object.freeze({
      isolationStatus: input.isolationStatus,
      riskyDefaultOwnerCount,
      alterableRiskyDefaultOwnerCount,
      protectedRiskyDefaultOwnerCount,
    }),
  });
}

export async function queryDataApiRemediationPlan(options = {}) {
  const connectionString = options.connectionString ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required for Data API remediation planning.');
  }

  const isolation = await queryNexaDataApiIsolation({ connectionString });
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
  if (plan.status === 'security-review-required') process.exit(1);
}

const invokedAsScript = process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedAsScript) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : 'Data API remediation planning failed.');
    process.exit(1);
  });
}
