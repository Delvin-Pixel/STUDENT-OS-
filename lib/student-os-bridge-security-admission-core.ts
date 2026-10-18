import type { NexaRuntimeRoleSecurityStatus } from '@/lib/runtime-role-security-core';
import type { NexaDataApiIsolationStatus } from '@/lib/supabase-data-api-isolation-core';

export type StudentOsBridgeDataApiIsolationStatus =
  | NexaDataApiIsolationStatus
  | 'unavailable';

export type StudentOsBridgeSecurityReason =
  | 'runtime_role_security_violation'
  | 'runtime_role_security_unavailable'
  | 'data_api_current_exposure'
  | 'data_api_future_default_risk'
  | 'data_api_isolation_unavailable';

export type StudentOsBridgeSecurityAdmission =
  | Readonly<{ allowed: true }>
  | Readonly<{
      allowed: false;
      source: 'runtime-role' | 'data-api';
      status: 'insecure' | 'unavailable';
      reason: StudentOsBridgeSecurityReason;
      retryable: boolean;
      retryAfterSeconds: number | null;
    }>;

export function classifyStudentOsBridgeSecurityAdmission(
  input: Readonly<{
    runtimeRoleStatus: NexaRuntimeRoleSecurityStatus;
    dataApiIsolationStatus: StudentOsBridgeDataApiIsolationStatus;
  }>,
): StudentOsBridgeSecurityAdmission {
  if (input.runtimeRoleStatus === 'unavailable') {
    return Object.freeze({
      allowed: false,
      source: 'runtime-role',
      status: 'unavailable',
      reason: 'runtime_role_security_unavailable',
      retryable: true,
      retryAfterSeconds: 30,
    });
  }

  if (input.runtimeRoleStatus !== 'secure') {
    return Object.freeze({
      allowed: false,
      source: 'runtime-role',
      status: 'insecure',
      reason: 'runtime_role_security_violation',
      retryable: false,
      retryAfterSeconds: null,
    });
  }

  if (input.dataApiIsolationStatus === 'unavailable') {
    return Object.freeze({
      allowed: false,
      source: 'data-api',
      status: 'unavailable',
      reason: 'data_api_isolation_unavailable',
      retryable: true,
      retryAfterSeconds: 30,
    });
  }

  if (input.dataApiIsolationStatus === 'exposed') {
    return Object.freeze({
      allowed: false,
      source: 'data-api',
      status: 'insecure',
      reason: 'data_api_current_exposure',
      retryable: false,
      retryAfterSeconds: null,
    });
  }

  if (input.dataApiIsolationStatus === 'future-default-risk') {
    return Object.freeze({
      allowed: false,
      source: 'data-api',
      status: 'insecure',
      reason: 'data_api_future_default_risk',
      retryable: false,
      retryAfterSeconds: null,
    });
  }

  return Object.freeze({ allowed: true });
}
