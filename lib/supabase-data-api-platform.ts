import {
  classifyNexaDataApiPlatformProbe,
  type NexaDataApiPlatformReason,
  type NexaDataApiPlatformStatus,
} from '@/lib/supabase-data-api-platform-core';

export const NEXA_DATA_API_PLATFORM_CACHE_MS = 60_000;
const DEFAULT_TIMEOUT_MS = 5_000;

export type NexaDataApiPlatformReadiness = Readonly<{
  status: NexaDataApiPlatformStatus;
  reason: NexaDataApiPlatformReason;
  checkedAt: string;
  latencyMs: number;
}>;

type CachedValue = Readonly<{
  expiresAt: number;
  value: NexaDataApiPlatformReadiness;
}>;

const globalForDataApiPlatform = globalThis as typeof globalThis & {
  nexaDataApiPlatformReadinessCache?: CachedValue;
};

function timeoutMs() {
  const raw = process.env.NEXA_SUPABASE_DATA_API_PROBE_TIMEOUT_MS;
  if (raw === undefined || raw === '') return DEFAULT_TIMEOUT_MS;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1000 || value > 15000) {
    throw new Error('NEXA_SUPABASE_DATA_API_PROBE_TIMEOUT_MS must be an integer from 1000 to 15000.');
  }
  return value;
}

function configuredEndpoint() {
  const rawUrl = String(process.env.NEXA_SUPABASE_URL ?? '').trim();
  const apiKey = String(process.env.NEXA_SUPABASE_PUBLISHABLE_KEY ?? '').trim();
  if (!rawUrl || !apiKey) return null;

  const url = new URL(rawUrl);
  if (
    url.protocol !== 'https:'
    || !/^[a-z0-9]{20}\.supabase\.co$/.test(url.hostname)
    || (url.pathname !== '/' && url.pathname !== '')
    || url.search
    || url.hash
  ) {
    throw new Error('NEXA_SUPABASE_URL must be the HTTPS root URL of a Supabase project.');
  }

  return Object.freeze({
    url: new URL('/rest/v1/', url.origin).toString(),
    apiKey,
  });
}

export async function getNexaDataApiPlatformReadiness(
  options: Readonly<{ bypassCache?: boolean; fetchImpl?: typeof fetch }> = {},
): Promise<NexaDataApiPlatformReadiness> {
  const started = Date.now();
  const useCache = !options.bypassCache && !options.fetchImpl;
  const cached = globalForDataApiPlatform.nexaDataApiPlatformReadinessCache;
  if (useCache && cached && cached.expiresAt > Date.now()) return cached.value;

  let endpoint: ReturnType<typeof configuredEndpoint>;
  try {
    endpoint = configuredEndpoint();
  } catch {
    endpoint = null;
  }

  if (!endpoint) {
    const classification = classifyNexaDataApiPlatformProbe({
      configured: false,
      httpStatus: null,
      failed: false,
    });
    return Object.freeze({
      ...classification,
      checkedAt: new Date().toISOString(),
      latencyMs: Date.now() - started,
    });
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  try {
    const response = await fetchImpl(endpoint.url, {
      method: 'GET',
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs()),
      headers: {
        Accept: 'application/openapi+json',
        apikey: endpoint.apiKey,
      },
    });

    try {
      await response.body?.cancel();
    } catch {}

    const classification = classifyNexaDataApiPlatformProbe({
      configured: true,
      httpStatus: response.status,
      failed: false,
    });
    const value = Object.freeze({
      ...classification,
      checkedAt: new Date().toISOString(),
      latencyMs: Date.now() - started,
    } satisfies NexaDataApiPlatformReadiness);

    if (useCache) {
      globalForDataApiPlatform.nexaDataApiPlatformReadinessCache = {
        expiresAt: Date.now() + NEXA_DATA_API_PLATFORM_CACHE_MS,
        value,
      };
    }

    return value;
  } catch {
    const classification = classifyNexaDataApiPlatformProbe({
      configured: true,
      httpStatus: null,
      failed: true,
    });
    const value = Object.freeze({
      ...classification,
      checkedAt: new Date().toISOString(),
      latencyMs: Date.now() - started,
    } satisfies NexaDataApiPlatformReadiness);

    if (useCache) {
      globalForDataApiPlatform.nexaDataApiPlatformReadinessCache = {
        expiresAt: Date.now() + NEXA_DATA_API_PLATFORM_CACHE_MS,
        value,
      };
    }

    return value;
  }
}
