import { getNexaAiRuntimeConfig } from '@/lib/ai-runtime';
import {
  classifyNexaAiGatewaySnapshot,
  type NexaAiGatewayCreditState,
  type NexaAiGatewayOperationalStatus,
  type NexaAiGatewayReadinessReason,
  type NexaAiGatewaySnapshot,
} from '@/lib/ai-gateway-readiness-core';

const DEFAULT_GATEWAY_READINESS_TIMEOUT_MS = 5_000;
const GATEWAY_READINESS_CACHE_MS = 30_000;

type GatewayFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export type NexaAiGatewayReadiness = Readonly<{
  status: NexaAiGatewayOperationalStatus;
  reason: NexaAiGatewayReadinessReason | null;
  configured: boolean;
  authenticated: boolean;
  credits: NexaAiGatewayCreditState;
  model: string | null;
  modelAvailable: boolean;
  providerCount: number;
  checkedAt: string;
  latencyMs: number;
}>;

type CachedGatewayReadiness = {
  expiresAt: number;
  value: NexaAiGatewayReadiness;
};

const globalForGatewayReadiness = globalThis as typeof globalThis & {
  nexaAiGatewayReadinessCache?: CachedGatewayReadiness;
};

function boundedTimeoutMs() {
  const raw = process.env.NEXA_AI_GATEWAY_READINESS_TIMEOUT_MS;
  if (raw === undefined || raw === '') return DEFAULT_GATEWAY_READINESS_TIMEOUT_MS;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1_000 || value > 15_000) {
    throw new Error('NEXA_AI_GATEWAY_READINESS_TIMEOUT_MS must be an integer from 1000 to 15000.');
  }
  return value;
}

async function jsonOrNull(response: Response) {
  try {
    return await response.json() as unknown;
  } catch {
    return null;
  }
}

function creditBalance(body: unknown) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const value = (body as Record<string, unknown>).balance;
  return typeof value === 'string' || typeof value === 'number' ? value : null;
}

function modelPresent(body: unknown, model: string) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return false;
  const data = (body as Record<string, unknown>).data;
  return Array.isArray(data) && data.some((item) => (
    item
    && typeof item === 'object'
    && !Array.isArray(item)
    && (item as Record<string, unknown>).id === model
  ));
}

function endpointCount(body: unknown) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return 0;
  const data = (body as Record<string, unknown>).data;
  if (Array.isArray(data)) return data.length;
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const endpoints = (data as Record<string, unknown>).endpoints;
    return Array.isArray(endpoints) ? endpoints.length : 0;
  }
  return 0;
}

function networkFailure(
  started: number,
  configured: boolean,
  model: string | null,
  timedOut: boolean,
): NexaAiGatewayReadiness {
  const classification = classifyNexaAiGatewaySnapshot({
    keyConfigured: configured,
    timedOut,
    creditsHttpStatus: null,
    creditsBalance: null,
    modelsHttpStatus: null,
    modelPresent: false,
    endpointsHttpStatus: null,
    endpointCount: 0,
  });
  return Object.freeze({
    ...classification,
    configured,
    authenticated: false,
    model,
    modelAvailable: false,
    providerCount: 0,
    checkedAt: new Date().toISOString(),
    latencyMs: Date.now() - started,
  });
}

export type NexaAiGatewayReadinessOptions = Readonly<{
  apiKey?: string;
  model?: string;
  fetchImpl?: GatewayFetch;
  timeoutMs?: number;
  bypassCache?: boolean;
}>;

export async function getNexaAiGatewayReadiness(
  options: NexaAiGatewayReadinessOptions = {},
): Promise<NexaAiGatewayReadiness> {
  const started = Date.now();
  const apiKey = String(options.apiKey ?? process.env.AI_GATEWAY_API_KEY ?? '').trim();
  const configured = apiKey.length > 0;
  const model = options.model ?? (() => {
    try {
      return getNexaAiRuntimeConfig().model;
    } catch {
      return null;
    }
  })();

  if (!configured) {
    return networkFailure(started, false, model, false);
  }

  if (!model) {
    const classification = classifyNexaAiGatewaySnapshot({
      keyConfigured: true,
      timedOut: false,
      creditsHttpStatus: 200,
      creditsBalance: 1,
      modelsHttpStatus: 200,
      modelPresent: false,
      endpointsHttpStatus: 200,
      endpointCount: 0,
    });
    return Object.freeze({
      ...classification,
      configured: true,
      authenticated: true,
      model: null,
      modelAvailable: false,
      providerCount: 0,
      checkedAt: new Date().toISOString(),
      latencyMs: Date.now() - started,
    });
  }

  const useCache = !options.bypassCache && !options.fetchImpl && options.apiKey === undefined && options.model === undefined;
  const cached = globalForGatewayReadiness.nexaAiGatewayReadinessCache;
  if (useCache && cached && cached.expiresAt > Date.now() && cached.value.model === model) {
    return cached.value;
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? boundedTimeoutMs();
  const signal = AbortSignal.timeout(timeoutMs);
  const headers = { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' };

  try {
    const encodedModel = model.split('/').map(encodeURIComponent).join('/');
    const [creditsResponse, modelsResponse, endpointsResponse] = await Promise.all([
      fetchImpl('https://ai-gateway.vercel.sh/v1/credits', {
        headers,
        cache: 'no-store',
        signal,
      }),
      fetchImpl('https://ai-gateway.vercel.sh/v1/models', {
        headers,
        cache: 'no-store',
        signal,
      }),
      fetchImpl(`https://ai-gateway.vercel.sh/v1/models/${encodedModel}/endpoints`, {
        headers,
        cache: 'no-store',
        signal,
      }),
    ]);

    const [creditsBody, modelsBody, endpointsBody] = await Promise.all([
      jsonOrNull(creditsResponse),
      jsonOrNull(modelsResponse),
      jsonOrNull(endpointsResponse),
    ]);

    const snapshot: NexaAiGatewaySnapshot = {
      keyConfigured: true,
      timedOut: false,
      creditsHttpStatus: creditsResponse.status,
      creditsBalance: creditBalance(creditsBody),
      modelsHttpStatus: modelsResponse.status,
      modelPresent: modelPresent(modelsBody, model),
      endpointsHttpStatus: endpointsResponse.status,
      endpointCount: endpointCount(endpointsBody),
    };
    const classification = classifyNexaAiGatewaySnapshot(snapshot);
    const value = Object.freeze({
      ...classification,
      configured: true,
      authenticated: creditsResponse.ok,
      model,
      modelAvailable: snapshot.modelPresent,
      providerCount: snapshot.endpointCount,
      checkedAt: new Date().toISOString(),
      latencyMs: Date.now() - started,
    });

    if (useCache) {
      globalForGatewayReadiness.nexaAiGatewayReadinessCache = {
        expiresAt: Date.now() + GATEWAY_READINESS_CACHE_MS,
        value,
      };
    }
    return value;
  } catch (error) {
    const timedOut = (
      error instanceof Error
      && (error.name === 'TimeoutError' || error.name === 'AbortError')
    );
    const value = networkFailure(started, true, model, timedOut);
    if (useCache) {
      globalForGatewayReadiness.nexaAiGatewayReadinessCache = {
        expiresAt: Date.now() + GATEWAY_READINESS_CACHE_MS,
        value,
      };
    }
    return value;
  }
}
