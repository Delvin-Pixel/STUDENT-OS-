export type NexaAiGatewayOperationalStatus = 'operational' | 'degraded' | 'missing';

export type NexaAiGatewayReadinessReason =
  | 'ai_gateway_missing'
  | 'ai_gateway_timeout'
  | 'ai_gateway_authentication_failed'
  | 'ai_gateway_credits_exhausted'
  | 'ai_gateway_model_unavailable'
  | 'ai_gateway_provider_unavailable'
  | 'ai_gateway_status_unavailable';

export type NexaAiGatewayCreditState = 'available' | 'exhausted' | 'unknown';

export type NexaAiGatewaySnapshot = Readonly<{
  keyConfigured: boolean;
  timedOut: boolean;
  creditsHttpStatus: number | null;
  creditsBalance: string | number | null;
  modelsHttpStatus: number | null;
  modelPresent: boolean;
  endpointsHttpStatus: number | null;
  endpointCount: number;
}>;

export type NexaAiGatewayClassification = Readonly<{
  status: NexaAiGatewayOperationalStatus;
  reason: NexaAiGatewayReadinessReason | null;
  credits: NexaAiGatewayCreditState;
}>;

function httpOk(status: number | null) {
  return status !== null && status >= 200 && status < 300;
}

function normalizedBalance(value: string | number | null) {
  if (value === null || value === '') return null;
  const amount = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

export function classifyNexaAiGatewaySnapshot(
  snapshot: NexaAiGatewaySnapshot,
): NexaAiGatewayClassification {
  if (!snapshot.keyConfigured) {
    return Object.freeze({
      status: 'missing',
      reason: 'ai_gateway_missing',
      credits: 'unknown',
    });
  }

  if (snapshot.timedOut) {
    return Object.freeze({
      status: 'degraded',
      reason: 'ai_gateway_timeout',
      credits: 'unknown',
    });
  }

  if (snapshot.creditsHttpStatus === 401 || snapshot.creditsHttpStatus === 403) {
    return Object.freeze({
      status: 'degraded',
      reason: 'ai_gateway_authentication_failed',
      credits: 'unknown',
    });
  }

  if (
    !httpOk(snapshot.creditsHttpStatus)
    || !httpOk(snapshot.modelsHttpStatus)
    || !httpOk(snapshot.endpointsHttpStatus)
  ) {
    return Object.freeze({
      status: 'degraded',
      reason: 'ai_gateway_status_unavailable',
      credits: 'unknown',
    });
  }

  const balance = normalizedBalance(snapshot.creditsBalance);
  if (balance === null) {
    return Object.freeze({
      status: 'degraded',
      reason: 'ai_gateway_status_unavailable',
      credits: 'unknown',
    });
  }

  if (balance <= 0) {
    return Object.freeze({
      status: 'degraded',
      reason: 'ai_gateway_credits_exhausted',
      credits: 'exhausted',
    });
  }

  if (!snapshot.modelPresent) {
    return Object.freeze({
      status: 'degraded',
      reason: 'ai_gateway_model_unavailable',
      credits: 'available',
    });
  }

  if (snapshot.endpointCount <= 0) {
    return Object.freeze({
      status: 'degraded',
      reason: 'ai_gateway_provider_unavailable',
      credits: 'available',
    });
  }

  return Object.freeze({
    status: 'operational',
    reason: null,
    credits: 'available',
  });
}
