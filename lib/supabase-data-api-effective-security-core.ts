import type { NexaDataApiIsolationStatus } from '@/lib/supabase-data-api-isolation-core';
import type { NexaDataApiPlatformStatus } from '@/lib/supabase-data-api-platform-core';

export type NexaDataApiEffectiveSecurityStatus = 'secure' | 'insecure' | 'unavailable';

export type NexaDataApiEffectiveSecurityReason =
  | 'data_api_platform_unavailable'
  | 'data_api_current_exposure'
  | 'data_api_future_default_risk'
  | 'data_api_isolation_unavailable'
  | null;

export type NexaDataApiEffectiveSecurity = Readonly<{
  status: NexaDataApiEffectiveSecurityStatus;
  reason: NexaDataApiEffectiveSecurityReason;
}>;

export function classifyNexaDataApiEffectiveSecurity(input: Readonly<{
  platformStatus: NexaDataApiPlatformStatus;
  isolationStatus: NexaDataApiIsolationStatus | 'unavailable';
}>): NexaDataApiEffectiveSecurity {
  if (input.platformStatus === 'unavailable') {
    return Object.freeze({
      status: 'unavailable',
      reason: 'data_api_platform_unavailable',
    });
  }

  if (input.platformStatus === 'disabled') {
    return Object.freeze({
      status: 'secure',
      reason: null,
    });
  }

  if (input.isolationStatus === 'unavailable') {
    return Object.freeze({
      status: 'unavailable',
      reason: 'data_api_isolation_unavailable',
    });
  }

  if (input.isolationStatus === 'exposed') {
    return Object.freeze({
      status: 'insecure',
      reason: 'data_api_current_exposure',
    });
  }

  if (input.isolationStatus === 'future-default-risk') {
    return Object.freeze({
      status: 'insecure',
      reason: 'data_api_future_default_risk',
    });
  }

  return Object.freeze({
    status: 'secure',
    reason: null,
  });
}
