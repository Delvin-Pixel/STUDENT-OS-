import type { NexaRuntimeRoleSecurityStatus } from '@/lib/runtime-role-security-core';
import type { NexaDataApiIsolationStatus } from '@/lib/supabase-data-api-isolation-core';
import type { NexaDataApiPlatformStatus } from '@/lib/supabase-data-api-platform-core';
import { classifyNexaDataApiEffectiveSecurity } from '@/lib/supabase-data-api-effective-security-core';

export type StudentOsBridgeDataApiIsolationStatus =
  | NexaDataApiIsolationStatus
  | 'unavailable';

export type StudentOsBridgeSecurityReason =
  | 'runtime_role_security_violation'
  | 'runtime_role_security_unavailable'
  | 'data_api_platform_unavailable'
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
    dataApiPlatformStatus: NexaDataApiPlatformStatus;
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

  const dataApiSecurity = classifyNexaDataApiEffectiveSecurity({
    platformStatus: input.dataApiPlatformStatus,
    isolationStatus: input.dataApiIsolationStatus,
  });

  if (dataApiSecurity.status === 'secure') {
    return Object.freeze({ allowed: true });
  }

  if (dataApiSecurity.status === 'unavailable') {
    return Object.freeze({
      allowed: false,
      source: 'data-api',
      status: 'unavailable',
      reason: dataApiSecurity.reason ?? 'data_api_isolation_unavailable',
      retryable: true,
      retryAfterSeconds: 30,
    });
  }

  return Object.freeze({
    allowed: false,
    source: 'data-api',
    status: 'insecure',
    reason: dataApiSecurity.reason ?? 'data_api_current_exposure',
    retryable: false,
    retryAfterSeconds: null,
  });
}
