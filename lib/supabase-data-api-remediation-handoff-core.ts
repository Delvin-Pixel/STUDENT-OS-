import type {
  NexaDataApiRemediationReadinessAction,
  NexaDataApiRemediationReadinessStatus,
} from '@/lib/supabase-data-api-remediation-readiness';

export type NexaDataApiRemediationHandoffOwner =
  | 'none'
  | 'project-owner'
  | 'operator'
  | 'security-review';

export type NexaDataApiRemediationHandoffSurface =
  | 'none'
  | 'supabase-dashboard'
  | 'runtime-diagnostics'
  | 'security-review';

export type NexaDataApiRemediationHandoffNextStep =
  | 'none'
  | 'disable-data-api'
  | 'verify-data-api-platform'
  | 'verify-data-api-isolation'
  | 'verify-data-api-remediation'
  | 'review-current-data-api-exposure';

export type NexaDataApiRemediationHandoffVerification =
  | 'none'
  | 'recheck-platform-and-isolation'
  | 'recheck-effective-security'
  | 'recheck-remediation-readiness';

export type NexaDataApiRemediationHandoff = Readonly<{
  owner: NexaDataApiRemediationHandoffOwner;
  surface: NexaDataApiRemediationHandoffSurface;
  nextStep: NexaDataApiRemediationHandoffNextStep;
  verification: NexaDataApiRemediationHandoffVerification;
  requiresHumanAction: boolean;
  requiresWorkBrowser: boolean;
  automaticRemediation: false;
}>;

export function classifyNexaDataApiRemediationHandoff(input: Readonly<{
  status: NexaDataApiRemediationReadinessStatus;
  recommendedAction: NexaDataApiRemediationReadinessAction;
}>): NexaDataApiRemediationHandoff {
  if (input.status === 'no-action') {
    return Object.freeze({
      owner: 'none',
      surface: 'none',
      nextStep: 'none',
      verification: 'none',
      requiresHumanAction: false,
      requiresWorkBrowser: false,
      automaticRemediation: false,
    });
  }

  if (input.status === 'owner-action-required') {
    return Object.freeze({
      owner: 'project-owner',
      surface: 'supabase-dashboard',
      nextStep: 'disable-data-api',
      verification: 'recheck-platform-and-isolation',
      requiresHumanAction: true,
      requiresWorkBrowser: true,
      automaticRemediation: false,
    });
  }

  if (input.status === 'security-review-required') {
    return Object.freeze({
      owner: 'security-review',
      surface: 'security-review',
      nextStep: 'review-current-data-api-exposure',
      verification: 'recheck-effective-security',
      requiresHumanAction: true,
      requiresWorkBrowser: false,
      automaticRemediation: false,
    });
  }

  const nextStep = input.recommendedAction === 'verify-data-api-platform-state'
    ? 'verify-data-api-platform'
    : input.recommendedAction === 'verify-data-api-isolation-attestation'
      ? 'verify-data-api-isolation'
      : 'verify-data-api-remediation';

  return Object.freeze({
    owner: 'operator',
    surface: 'runtime-diagnostics',
    nextStep,
    verification: 'recheck-remediation-readiness',
    requiresHumanAction: true,
    requiresWorkBrowser: false,
    automaticRemediation: false,
  });
}
