#!/usr/bin/env node
import pg from 'pg';
import { pathToFileURL } from 'node:url';

export const NEGOTIATION_ADOPTION_DEFAULT_WINDOW_DAYS = 7;
export const NEGOTIATION_ADOPTION_MIN_WINDOW_DAYS = 1;
export const NEGOTIATION_ADOPTION_MAX_WINDOW_DAYS = 90;

export function parseNegotiationAdoptionWindowDays(value) {
  if (value === undefined || value === null || value === '') {
    return NEGOTIATION_ADOPTION_DEFAULT_WINDOW_DAYS;
  }
  const days = Number(value);
  if (
    !Number.isInteger(days)
    || days < NEGOTIATION_ADOPTION_MIN_WINDOW_DAYS
    || days > NEGOTIATION_ADOPTION_MAX_WINDOW_DAYS
  ) {
    throw new Error(
      `Negotiation adoption report window must be an integer from ${NEGOTIATION_ADOPTION_MIN_WINDOW_DAYS} to ${NEGOTIATION_ADOPTION_MAX_WINDOW_DAYS} days.`,
    );
  }
  return days;
}

function percent(part, total) {
  if (total <= 0) return null;
  return Math.round((part / total) * 10000) / 100;
}

function parseAggregateCount(value, field) {
  const count = Number(value ?? 0);
  if (!Number.isInteger(count) || count < 0) {
    throw new Error(`Negotiation adoption evidence field ${field} is invalid.`);
  }
  return count;
}

export function buildNegotiationAdoptionEvidenceCoverage(row = {}) {
  const totalBridgeRequests = parseAggregateCount(row.total_bridge_requests, 'total_bridge_requests');
  const fullyObservedRequests = parseAggregateCount(row.fully_observed_requests, 'fully_observed_requests');
  const unobservedRequests = parseAggregateCount(row.unobserved_requests, 'unobserved_requests');
  const mixedObservabilityRequests = parseAggregateCount(
    row.mixed_observability_requests,
    'mixed_observability_requests',
  );

  if (
    fullyObservedRequests + unobservedRequests + mixedObservabilityRequests
    !== totalBridgeRequests
  ) {
    throw new Error('Negotiation adoption evidence counts are inconsistent.');
  }

  let status;
  if (totalBridgeRequests === 0) status = 'no-traffic';
  else if (fullyObservedRequests === totalBridgeRequests) status = 'covered';
  else if (unobservedRequests === totalBridgeRequests) status = 'unobserved';
  else status = 'partial-observability';

  return Object.freeze({
    status,
    totalBridgeRequests,
    fullyObservedRequests,
    unobservedRequests,
    mixedObservabilityRequests,
    coveragePercent: percent(fullyObservedRequests, totalBridgeRequests),
  });
}

export function buildNegotiationAdoptionReport(rows, options = {}) {
  const windowDays = parseNegotiationAdoptionWindowDays(options.windowDays);
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  let explicitRequests = 0;
  let legacyDefaultRequests = 0;
  const byVersion = new Map();

  for (const row of rows ?? []) {
    const source = row?.contract_negotiation_source;
    const version = row?.bridge_contract_version;
    const count = Number(row?.request_count ?? 0);
    if (
      (source !== 'explicit' && source !== 'legacy-default')
      || typeof version !== 'string'
      || !/^\d+\.\d+$/.test(version)
      || !Number.isInteger(count)
      || count < 0
    ) {
      throw new Error('Negotiation adoption aggregate row is invalid.');
    }

    if (source === 'explicit') explicitRequests += count;
    else legacyDefaultRequests += count;

    const current = byVersion.get(version) ?? { explicitRequests: 0, legacyDefaultRequests: 0 };
    current[source === 'explicit' ? 'explicitRequests' : 'legacyDefaultRequests'] += count;
    byVersion.set(version, current);
  }

  const totalRequests = explicitRequests + legacyDefaultRequests;
  const byContractVersion = [...byVersion.entries()]
    .sort(([left], [right]) => left.localeCompare(right, undefined, { numeric: true }))
    .map(([bridgeContractVersion, counts]) => Object.freeze({
      bridgeContractVersion,
      explicitRequests: counts.explicitRequests,
      legacyDefaultRequests: counts.legacyDefaultRequests,
      totalRequests: counts.explicitRequests + counts.legacyDefaultRequests,
    }));

  const evidenceCoverage = buildNegotiationAdoptionEvidenceCoverage(
    options.evidenceCoverage ?? {
      total_bridge_requests: totalRequests,
      fully_observed_requests: totalRequests,
      unobserved_requests: 0,
      mixed_observability_requests: 0,
    },
  );

  return Object.freeze({
    windowDays,
    generatedAt,
    totalRequests,
    explicitRequests,
    legacyDefaultRequests,
    explicitPercent: percent(explicitRequests, totalRequests),
    legacyDefaultPercent: percent(legacyDefaultRequests, totalRequests),
    legacyDefaultObserved: legacyDefaultRequests > 0,
    byContractVersion: Object.freeze(byContractVersion),
    evidenceCoverage,
  });
}

export async function queryNegotiationAdoptionReport({
  databaseUrl,
  windowDays = NEGOTIATION_ADOPTION_DEFAULT_WINDOW_DAYS,
} = {}) {
  const boundedDays = parseNegotiationAdoptionWindowDays(windowDays);
  const connectionString = String(databaseUrl ?? process.env.DATABASE_URL ?? '').trim();
  if (!connectionString) {
    throw new Error('DATABASE_URL is required for the negotiation adoption report.');
  }

  const pool = new pg.Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 10_000,
    statement_timeout: 15_000,
  });

  try {
    const [adoptionResult, coverageResult] = await Promise.all([
      pool.query(
        `select
           contract_negotiation_source,
           bridge_contract_version,
           count(distinct bridge_request_id)::int as request_count
         from student_os_bridge_events
         where created_at >= now() - ($1::int * interval '1 day')
           and contract_negotiation_source is not null
           and bridge_contract_version is not null
         group by contract_negotiation_source, bridge_contract_version
         order by bridge_contract_version asc, contract_negotiation_source asc`,
        [boundedDays],
      ),
      pool.query(
        `with per_request as (
           select
             bridge_request_id,
             bool_and(
               contract_negotiation_source is not null
               and bridge_contract_version is not null
             ) as fully_observed,
             bool_or(
               contract_negotiation_source is not null
               and bridge_contract_version is not null
             ) as any_observed
           from student_os_bridge_events
           where created_at >= now() - ($1::int * interval '1 day')
           group by bridge_request_id
         )
         select
           count(*)::int as total_bridge_requests,
           count(*) filter (where fully_observed)::int as fully_observed_requests,
           count(*) filter (where not any_observed)::int as unobserved_requests,
           count(*) filter (where any_observed and not fully_observed)::int as mixed_observability_requests
         from per_request`,
        [boundedDays],
      ),
    ]);

    return buildNegotiationAdoptionReport(adoptionResult.rows, {
      windowDays: boundedDays,
      evidenceCoverage: coverageResult.rows[0],
    });
  } finally {
    await pool.end();
  }
}

function readDaysArgument(argv) {
  const inline = argv.find((arg) => arg.startsWith('--days='));
  if (inline) return inline.slice('--days='.length);
  const index = argv.indexOf('--days');
  return index >= 0 ? argv[index + 1] : undefined;
}

async function main() {
  const windowDays = parseNegotiationAdoptionWindowDays(readDaysArgument(process.argv.slice(2)));
  const report = await queryNegotiationAdoptionReport({ windowDays });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

const invokedAsScript = process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedAsScript) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : 'Negotiation adoption report failed.');
    process.exit(1);
  });
}
