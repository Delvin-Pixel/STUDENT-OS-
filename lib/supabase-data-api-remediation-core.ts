import {
  classifyNexaDataApiEffectiveSecurity,
  type NexaDataApiEffectiveSecurityReason,
  type NexaDataApiEffectiveSecurityStatus,
} from '@/lib/supabase-data-api-effective-security-core';
import type { NexaDataApiIsolationStatus } from '@/lib/supabase-data-api-isolation-core';
import type { NexaDataApiPlatformStatus } from '@/lib/supabase-data-api-platform-core';

export type NexaDataApiRemediationStatus =
  | 'no-action'
  | 'owner-action-required'
  | 'security-review-required'
  | 'verification-required';

export type NexaDataApiRemediationAction =
  | 'none'
  | 'disable-data-api-in-dashboard'
  | 'review-current-data-api-exposure'
  | 'verify-data-api-platform-state'
  | 'verify-data-api-isolation-attestation';

export type NexaDataApiSqlRemediationFeasibility =
  | 'not-needed'
  | 'not-evaluated'
  | 'blocked-by-default-owner'
  | 'technically-possible-but-automatic-remediation-disabled';

export type NexaDataApiRemediationPlan = Readonly<{
  status: NexaDataApiRemediationStatus;
  recommendedAction: NexaDataApiRemediationAction;
  sqlRemediationFeasibility: NexaDataApiSqlRemediationFeasibility;
  automaticRemediation: false;
  platformStatus: NexaDataApiPlatformStatus;
  isolationStatus: NexaDataApiIsolationStatus | 'unavailable';
  effectiveSecurityStatus: NexaDataApiEffectiveSecurityStatus;
  effectiveSecurityReason: NexaDataApiEffectiveSecurityReason;
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
  platformStatus: NexaDataApiPlatformStatus;
  isolationStatus: NexaDataApiIsolationStatus | 'unavailable';
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
  const effective = classifyNexaDataApiEffectiveSecurity({
    platformStatus: input.platformStatus,
    isolationStatus: input.isolationStatus,
  });
  const currentExposure = input.isolationStatus === 'exposed';
  const futureDefaultRisk = input.isolationStatus === 'future-default-risk';

  if (effective.status === 'secure') {
    return Object.freeze({
      status: 'no-action',
      recommendedAction: 'none',
      sqlRemediationFeasibility: 'not-needed',
      automaticRemediation: false,
      platformStatus: input.platformStatus,
      isolationStatus: input.isolationStatus,
      effectiveSecurityStatus: effective.status,
      effectiveSecurityReason: effective.reason,
      currentExposure,
      futureDefaultRisk,
      riskyDefaultOwnerCount,
      alterableRiskyDefaultOwnerCount,
      protectedRiskyDefaultOwnerCount,
    });
  }

  if (effective.status === 'unavailable') {
    return Object.freeze({
      status: 'verification-required',
      recommendedAction: effective.reason === 'data_api_platform_unavailable'
        ? 'verify-data-api-platform-state'
        : 'verify-data-api-isolation-attestation',
      sqlRemediationFeasibility: 'not-evaluated',
      automaticRemediation: false,
      platformStatus: input.platformStatus,
      isolationStatus: input.isolationStatus,
      effectiveSecurityStatus: effective.status,
      effectiveSecurityReason: effective.reason,
      currentExposure,
      futureDefaultRisk,
      riskyDefaultOwnerCount,
      alterableRiskyDefaultOwnerCount,
      protectedRiskyDefaultOwnerCount,
    });
  }

  if (effective.reason === 'data_api_current_exposure') {
    return Object.freeze({
      status: 'security-review-required',
      recommendedAction: 'review-current-data-api-exposure',
      sqlRemediationFeasibility: protectedRiskyDefaultOwnerCount > 0
        ? 'blocked-by-default-owner'
        : 'technically-possible-but-automatic-remediation-disabled',
      automaticRemediation: false,
      platformStatus: input.platformStatus,
      isolationStatus: input.isolationStatus,
      effectiveSecurityStatus: effective.status,
      effectiveSecurityReason: effective.reason,
      currentExposure,
      futureDefaultRisk,
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
    platformStatus: input.platformStatus,
    isolationStatus: input.isolationStatus,
    effectiveSecurityStatus: effective.status,
    effectiveSecurityReason: effective.reason,
    currentExposure,
    futureDefaultRisk,
    riskyDefaultOwnerCount,
    alterableRiskyDefaultOwnerCount,
    protectedRiskyDefaultOwnerCount,
  });
}
