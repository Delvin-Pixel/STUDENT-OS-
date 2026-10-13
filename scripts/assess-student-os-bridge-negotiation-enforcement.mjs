#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import {
  parseNegotiationAdoptionWindowDays,
  queryNegotiationAdoptionReport,
} from './report-student-os-bridge-negotiation-adoption.mjs';

export const NEGOTIATION_ENFORCEMENT_MINIMUM_REQUESTS_MIN = 1;
export const NEGOTIATION_ENFORCEMENT_MINIMUM_REQUESTS_MAX = 1_000_000;

export function parseNegotiationEnforcementMinimumRequests(value) {
  if (value === undefined || value === null || value === '') {
    throw new Error('A minimum negotiation-enforcement request sample is required.');
  }
  const count = Number(value);
  if (
    !Number.isInteger(count)
    || count < NEGOTIATION_ENFORCEMENT_MINIMUM_REQUESTS_MIN
    || count > NEGOTIATION_ENFORCEMENT_MINIMUM_REQUESTS_MAX
  ) {
    throw new Error(
      `Minimum negotiation-enforcement requests must be an integer from ${NEGOTIATION_ENFORCEMENT_MINIMUM_REQUESTS_MIN} to ${NEGOTIATION_ENFORCEMENT_MINIMUM_REQUESTS_MAX}.`,
    );
  }
  return count;
}

function nonNegativeInteger(value, field) {
  const count = Number(value);
  if (!Number.isInteger(count) || count < 0) {
    throw new Error(`Negotiation enforcement evidence field ${field} is invalid.`);
  }
  return count;
}

export function buildNegotiationEnforcementAssessment(report, options = {}) {
  if (!report || typeof report !== 'object' || Array.isArray(report)) {
    throw new Error('Negotiation adoption report is required.');
  }

  const minimumRequests = parseNegotiationEnforcementMinimumRequests(options.minimumRequests);
  const coverage = report.evidenceCoverage;
  if (!coverage || typeof coverage !== 'object' || Array.isArray(coverage)) {
    throw new Error('Negotiation adoption evidence coverage is required.');
  }

  const totalBridgeRequests = nonNegativeInteger(
    coverage.totalBridgeRequests,
    'totalBridgeRequests',
  );
  const explicitRequests = nonNegativeInteger(report.explicitRequests, 'explicitRequests');
  const legacyDefaultRequests = nonNegativeInteger(
    report.legacyDefaultRequests,
    'legacyDefaultRequests',
  );
  const adoptionSampleRequests = nonNegativeInteger(report.totalRequests, 'totalRequests');
  if (adoptionSampleRequests !== explicitRequests + legacyDefaultRequests) {
    throw new Error('Negotiation adoption request totals are inconsistent.');
  }

  const allowedCoverageStatuses = new Set([
    'no-traffic',
    'unobserved',
    'partial-observability',
    'covered',
  ]);
  if (!allowedCoverageStatuses.has(coverage.status)) {
    throw new Error('Negotiation adoption evidence coverage status is invalid.');
  }

  let decision;
  if (totalBridgeRequests < minimumRequests) {
    decision = 'insufficient-traffic';
  } else if (coverage.status !== 'covered') {
    decision = 'insufficient-observability';
  } else if (legacyDefaultRequests > 0) {
    decision = 'legacy-default-observed';
  } else {
    if (adoptionSampleRequests !== totalBridgeRequests || explicitRequests !== totalBridgeRequests) {
      throw new Error('Covered negotiation adoption evidence is internally inconsistent.');
    }
    decision = 'reviewable';
  }

  return Object.freeze({
    windowDays: report.windowDays,
    minimumRequests,
    reviewable: decision === 'reviewable',
    decision,
    automaticPolicyChange: false,
    evidence: Object.freeze({
      totalBridgeRequests,
      coverageStatus: coverage.status,
      coveragePercent: coverage.coveragePercent ?? null,
      adoptionSampleRequests,
      explicitRequests,
      legacyDefaultRequests,
      explicitPercent: report.explicitPercent ?? null,
      legacyDefaultPercent: report.legacyDefaultPercent ?? null,
    }),
  });
}

function readArgument(argv, name) {
  const inline = argv.find((arg) => arg.startsWith(`--${name}=`));
  if (inline) return inline.slice(name.length + 3);
  const index = argv.indexOf(`--${name}`);
  return index >= 0 ? argv[index + 1] : undefined;
}

async function main() {
  const argv = process.argv.slice(2);
  const minimumRequests = parseNegotiationEnforcementMinimumRequests(
    readArgument(argv, 'min-requests'),
  );
  const windowDays = parseNegotiationAdoptionWindowDays(readArgument(argv, 'days'));
  const report = await queryNegotiationAdoptionReport({ windowDays });
  const assessment = buildNegotiationEnforcementAssessment(report, { minimumRequests });
  process.stdout.write(`${JSON.stringify(assessment, null, 2)}\n`);
}

const invokedAsScript = process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedAsScript) {
  main().catch((error) => {
    console.error(
      error instanceof Error
        ? error.message
        : 'Negotiation enforcement evidence assessment failed.',
    );
    process.exit(1);
  });
}
