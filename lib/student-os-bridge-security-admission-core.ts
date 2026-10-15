import type { NexaRuntimeRoleSecurityStatus } from '@/lib/runtime-role-security-core';

export type StudentOsBridgeSecurityReason =
  | 'runtime_role_security_violation'
  | 'runtime_role_security_unavailable';

export type StudentOsBridgeSecurityAdmission =
  | Readonly<{ allowed: true }>
  | Readonly<{
      allowed: false;
      status: Exclude<NexaRuntimeRoleSecurityStatus, 'secure'>;
      reason: StudentOsBridgeSecurityReason;
      retryable: boolean;
      retryAfterSeconds: number | null;
    }>;

export function classifyStudentOsBridgeSecurityAdmission(
  status: NexaRuntimeRoleSecurityStatus,
): StudentOsBridgeSecurityAdmission {
  if (status === 'secure') {
    return Object.freeze({ allowed: true });
  }

  if (status === 'unavailable') {
    return Object.freeze({
      allowed: false,
      status,
      reason: 'runtime_role_security_unavailable',
      retryable: true,
      retryAfterSeconds: 30,
    });
  }

  return Object.freeze({
    allowed: false,
    status,
    reason: 'runtime_role_security_violation',
    retryable: false,
    retryAfterSeconds: null,
  });
}
