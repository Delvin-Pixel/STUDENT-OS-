import type {
  NexaDataApiRemediationReadinessAction,
  NexaDataApiRemediationReadinessStatus,
} from '@/lib/supabase-data-api-remediation-readiness';

export type NexaDataApiRemediationClosureStatus =
  | 'closed'
  | 'open'
  | 'verification-required';

export type NexaDataApiRemediationClosureReason =
  | 'no-remediation-required'
  | 'owner-action-pending'
  | 'security-review-pending'
  | 'platform-verification-pending'
  | 'isolation-verification-pending'
  | 'remediation-verification-pending';

export type NexaDataApiRemediationClosure = Readonly<{
  status: NexaDataApiRemediationClosureStatus;
  reason: NexaDataApiRemediationClosureReason;
  securityBoundaryClosed: boolean;
  requiresHumanAction: boolean;
  requiresVerification: boolean;
}>;

export function classifyNexaDataApiRemediationClosure(input: Readonly<{
  status: NexaDataApiRemediationReadinessStatus;
  recommendedAction: NexaDataApiRemediationReadinessAction;
}>): NexaDataApiRemediationClosure {
  if (input.status === 'no-action') {
    return Object.freeze({
      status: 'closed',
      reason: 'no-remediation-required',
      securityBoundaryClosed: true,
      requiresHumanAction: false,
      requiresVerification: false,
    });
  }

  if (input.status === 'owner-action-required') {
    return Object.freeze({
      status: 'open',
      reason: 'owner-action-pending',
      securityBoundaryClosed: false,
      requiresHumanAction: true,
      requiresVerification: true,
    });
  }

  if (input.status === 'security-review-required') {
    return Object.freeze({
      status: 'open',
      reason: 'security-review-pending',
      securityBoundaryClosed: false,
      requiresHumanAction: true,
      requiresVerification: true,
    });
  }

  const reason = input.recommendedAction === 'verify-data-api-platform-state'
    ? 'platform-verification-pending'
    : input.recommendedAction === 'verify-data-api-isolation-attestation'
      ? 'isolation-verification-pending'
      : 'remediation-verification-pending';

  return Object.freeze({
    status: 'verification-required',
    reason,
    securityBoundaryClosed: false,
    requiresHumanAction: false,
    requiresVerification: true,
  });
}
