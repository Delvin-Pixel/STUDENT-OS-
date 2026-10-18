import { getNexaAiGatewayReadiness, type NexaAiGatewayReadiness } from '@/lib/ai-gateway-readiness';
import { query } from '@/lib/db';
import { hasConfiguredRateLimitSecret } from '@/lib/rate-limit';
import { getNexaDataApiPlatformReadiness } from '@/lib/supabase-data-api-platform';
import {
  classifyNexaDataApiEffectiveSecurity,
  type NexaDataApiEffectiveSecurityReason,
  type NexaDataApiEffectiveSecurityStatus,
} from '@/lib/supabase-data-api-effective-security-core';
import type {
  NexaDataApiPlatformReason,
  NexaDataApiPlatformStatus,
} from '@/lib/supabase-data-api-platform-core';
import {
  getNexaDataApiIsolationReadiness,
  type NexaDataApiIsolationReadinessReason,
  type NexaDataApiIsolationReadinessStatus,
} from '@/lib/supabase-data-api-isolation';
import {
  getNexaRuntimeRoleSecurity,
  type NexaRuntimeRoleSecurityReason,
  type NexaRuntimeRoleSecurityStatus,
} from '@/lib/runtime-role-security';
import {
  getNexaDataApiRemediationReadiness,
  type NexaDataApiRemediationReadinessAction,
  type NexaDataApiRemediationReadinessReason,
  type NexaDataApiRemediationReadinessSqlFeasibility,
  type NexaDataApiRemediationReadinessStatus,
} from '@/lib/supabase-data-api-remediation-readiness';
import { NEXA_VERSION } from '@/lib/version';

export type HealthStatus = {
  status: 'ok' | 'degraded';
  service: 'nexa';
  version: string;
  database: 'ok' | 'unavailable';
  runtimeRoleSecurity: NexaRuntimeRoleSecurityStatus;
  runtimeRoleSecurityReason: NexaRuntimeRoleSecurityReason;
  dataApiIsolation: NexaDataApiIsolationReadinessStatus;
  dataApiIsolationReason: NexaDataApiIsolationReadinessReason;
  dataApiPlatform: NexaDataApiPlatformStatus;
  dataApiPlatformReason: NexaDataApiPlatformReason;
  dataApiEffectiveSecurity: NexaDataApiEffectiveSecurityStatus;
  dataApiEffectiveSecurityReason: NexaDataApiEffectiveSecurityReason;
  dataApiRemediationStatus: NexaDataApiRemediationReadinessStatus;
  dataApiRemediationAction: NexaDataApiRemediationReadinessAction;
  dataApiRemediationSqlFeasibility: NexaDataApiRemediationReadinessSqlFeasibility;
  dataApiRemediationReason: NexaDataApiRemediationReadinessReason;
  aiGateway: 'configured' | 'missing';
  aiGatewayOperational: NexaAiGatewayReadiness['status'];
  aiGatewayReason: NexaAiGatewayReadiness['reason'];
  aiGatewayCredits: NexaAiGatewayReadiness['credits'];
  aiGatewayModel: string | null;
  aiGatewayModelAvailable: boolean;
  aiGatewayProviderCount: number;
  rateLimitSecret: 'configured' | 'missing';
  latencyMs: number;
};

export async function getReadiness(): Promise<HealthStatus> {
  const started = Date.now();
  const rateLimitSecretConfigured = hasConfiguredRateLimitSecret();

  const [databaseResult, runtimeRoleSecurity, dataApiIsolation, dataApiPlatform, gateway] = await Promise.all([
    query('select 1 as ok')
      .then(() => 'ok' as const)
      .catch(() => 'unavailable' as const),
    getNexaRuntimeRoleSecurity(),
    getNexaDataApiIsolationReadiness(),
    getNexaDataApiPlatformReadiness(),
    getNexaAiGatewayReadiness(),
  ]);

  const dataApiEffectiveSecurity = classifyNexaDataApiEffectiveSecurity({
    platformStatus: dataApiPlatform.status,
    isolationStatus: dataApiIsolation.status,
  });

  const dataApiRemediation = await getNexaDataApiRemediationReadiness({
    platformStatus: dataApiPlatform.status,
    isolationStatus: dataApiIsolation.status,
  });

  const healthy = (
    databaseResult === 'ok'
    && runtimeRoleSecurity.status === 'secure'
    && dataApiEffectiveSecurity.status === 'secure'
    && gateway.status === 'operational'
    && rateLimitSecretConfigured
  );

  return {
    status: healthy ? 'ok' : 'degraded',
    service: 'nexa',
    version: NEXA_VERSION,
    database: databaseResult,
    runtimeRoleSecurity: runtimeRoleSecurity.status,
    runtimeRoleSecurityReason: runtimeRoleSecurity.reason,
    dataApiIsolation: dataApiIsolation.status,
    dataApiIsolationReason: dataApiIsolation.reason,
    dataApiPlatform: dataApiPlatform.status,
    dataApiPlatformReason: dataApiPlatform.reason,
    dataApiEffectiveSecurity: dataApiEffectiveSecurity.status,
    dataApiEffectiveSecurityReason: dataApiEffectiveSecurity.reason,
    dataApiRemediationStatus: dataApiRemediation.status,
    dataApiRemediationAction: dataApiRemediation.recommendedAction,
    dataApiRemediationSqlFeasibility: dataApiRemediation.sqlRemediationFeasibility,
    dataApiRemediationReason: dataApiRemediation.reason,
    aiGateway: gateway.configured ? 'configured' : 'missing',
    aiGatewayOperational: gateway.status,
    aiGatewayReason: gateway.reason,
    aiGatewayCredits: gateway.credits,
    aiGatewayModel: gateway.model,
    aiGatewayModelAvailable: gateway.modelAvailable,
    aiGatewayProviderCount: gateway.providerCount,
    rateLimitSecret: rateLimitSecretConfigured ? 'configured' : 'missing',
    latencyMs: Date.now() - started,
  };
}
