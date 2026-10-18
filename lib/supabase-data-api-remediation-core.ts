import type { NexaDataApiIsolationStatus } from '@/lib/supabase-data-api-isolation-core';

export type NexaDataApiRemediationStatus =
  | 'no-action'
  | 'owner-action-required'
  | 'security-review-required';

export type NexaDataApiRemediationAction =
  | 'none'
  | 'disable-data-api-in-dashboard'
  | 'review-current-data-api-exposure';

export type NexaDataApiSqlRemediationFeasibility =
  | 'not-needed'
  | 'blocked-by-default-owner'
  | 'technically-possible-but-automatic-remediation-disabled';

export type NexaDataApiRemediationPlan = Readonly<{
  status: NexaDataApiRemediationStatus;
  recommendedAction: NexaDataApiRemediationAction;
  sqlRemediationFeasibility: NexaDataApiSqlRemediationFeasibility;
  automaticRemediation: false;
  currentExposure: boolean;
  futureDefaultRisk: boolean;
  riskyDefaultOwnerCount: number;
  alterableRiskyDefaultOwnerCount: number;
  protectedRiskyDefaultOwnerCount: number;
}>;

function boundedCount(value: number) {
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

export function classifyNexaDataApiRemediationPlan(input: Readonly<{
  isolationStatus: NexaDataApiIsolationStatus;
  riskyDefaultOwnerCount: number;
  alterableRiskyDefaultOwnerCount: number;
}>): NexaDataApiRemediationPlan {
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
      currentExposure: false,
      futureDefaultRisk: false,
      riskyDefaultOwnerCount,
      alterableRiskyDefaultOwnerCount,
      protectedRiskyDefaultOwnerCount,
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
      currentExposure: true,
      futureDefaultRisk: riskyDefaultOwnerCount > 0,
      riskyDefaultOwnerCount,
      alterableRiskyDefaultOwnerCount,
      protectedRiskyDefaultOwnerCount,
    });
  }

  return Object.freeze({
    status: 'owner-action-required',
    recommendedAction: 'disable-data-api-in-dashboard',
    sqlRemediationFeasibility: protectedRiskyDefaultOwnerCount > 0
      ? 'blocked-by-default-owner'
      : 'technically-possible-but-automatic-remediation-disabled',
    automaticRemediation: false,
    currentExposure: false,
    futureDefaultRisk: true,
    riskyDefaultOwnerCount,
    alterableRiskyDefaultOwnerCount,
    protectedRiskyDefaultOwnerCount,
  });
}
