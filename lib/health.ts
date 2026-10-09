import { getNexaAiGatewayReadiness, type NexaAiGatewayReadiness } from '@/lib/ai-gateway-readiness';
import { query } from '@/lib/db';
import { hasConfiguredRateLimitSecret } from '@/lib/rate-limit';
import { NEXA_VERSION } from '@/lib/version';

export type HealthStatus = {
  status: 'ok' | 'degraded';
  service: 'nexa';
  version: string;
  database: 'ok' | 'unavailable';
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

  const [databaseResult, gateway] = await Promise.all([
    query('select 1 as ok')
      .then(() => 'ok' as const)
      .catch(() => 'unavailable' as const),
    getNexaAiGatewayReadiness(),
  ]);

  const healthy = (
    databaseResult === 'ok'
    && gateway.status === 'operational'
    && rateLimitSecretConfigured
  );

  return {
    status: healthy ? 'ok' : 'degraded',
    service: 'nexa',
    version: NEXA_VERSION,
    database: databaseResult,
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
