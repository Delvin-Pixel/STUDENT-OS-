import { query } from '@/lib/db';
import { hasConfiguredRateLimitSecret } from '@/lib/rate-limit';
import { NEXA_VERSION } from '@/lib/version';

export type HealthStatus = {
  status: 'ok' | 'degraded';
  service: 'nexa';
  version: string;
  database: 'ok' | 'unavailable';
  aiGateway: 'configured' | 'missing';
  rateLimitSecret: 'configured' | 'missing';
  latencyMs: number;
};

export async function getReadiness(): Promise<HealthStatus> {
  const started = Date.now();
  const aiGatewayConfigured = Boolean(process.env.AI_GATEWAY_API_KEY);
  const rateLimitSecretConfigured = hasConfiguredRateLimitSecret();
  try {
    await query('select 1 as ok');
    const healthy = aiGatewayConfigured && rateLimitSecretConfigured;
    return {
      status: healthy ? 'ok' : 'degraded',
      service: 'nexa',
      version: NEXA_VERSION,
      database: 'ok',
      aiGateway: aiGatewayConfigured ? 'configured' : 'missing',
      rateLimitSecret: rateLimitSecretConfigured ? 'configured' : 'missing',
      latencyMs: Date.now() - started,
    };
  } catch {
    return {
      status: 'degraded',
      service: 'nexa',
      version: NEXA_VERSION,
      database: 'unavailable',
      aiGateway: aiGatewayConfigured ? 'configured' : 'missing',
      rateLimitSecret: rateLimitSecretConfigured ? 'configured' : 'missing',
      latencyMs: Date.now() - started,
    };
  }
}
