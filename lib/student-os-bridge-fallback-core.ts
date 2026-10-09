import type { NexaAiGatewayReadinessReason } from '@/lib/ai-gateway-readiness-core';

export const STUDENT_OS_BRIDGE_FALLBACK_CONTRACT_VERSION = '1.0' as const;
export const STUDENT_OS_BRIDGE_FALLBACK_MODE = 'student-os-deterministic' as const;
export const STUDENT_OS_BRIDGE_FALLBACK_AUTHORITY = 'student-os-learning-intelligence' as const;

export type StudentOsBridgeFallbackDirective = Readonly<{
  contractVersion: typeof STUDENT_OS_BRIDGE_FALLBACK_CONTRACT_VERSION;
  mode: typeof STUDENT_OS_BRIDGE_FALLBACK_MODE;
  academicDecisionAuthority: typeof STUDENT_OS_BRIDGE_FALLBACK_AUTHORITY;
  reason: NexaAiGatewayReadinessReason;
  retryable: boolean;
  retryAfterSeconds: number | null;
}>;

export function createStudentOsBridgeFallbackDirective(input: Readonly<{
  reason: NexaAiGatewayReadinessReason;
  retryable: boolean;
  retryAfterSeconds: number | null;
}>): StudentOsBridgeFallbackDirective {
  return Object.freeze({
    contractVersion: STUDENT_OS_BRIDGE_FALLBACK_CONTRACT_VERSION,
    mode: STUDENT_OS_BRIDGE_FALLBACK_MODE,
    academicDecisionAuthority: STUDENT_OS_BRIDGE_FALLBACK_AUTHORITY,
    reason: input.reason,
    retryable: Boolean(input.retryable),
    retryAfterSeconds: input.retryAfterSeconds === null
      ? null
      : Math.max(1, Math.min(3600, Math.floor(input.retryAfterSeconds))),
  });
}
