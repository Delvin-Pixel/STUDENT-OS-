import { createHash, timingSafeEqual } from 'node:crypto';
import { embed, generateText, gateway } from 'ai';
import { getNexaAiRuntimeConfig } from '@/lib/ai-runtime';
import { getProjectSemanticConfig } from '@/lib/project-semantic';
import { extractRichProjectKnowledge, getRichProjectFileConfig, normalizeRichProjectFileInput } from '@/lib/project-rich-files';
import { getVoiceTranscriptionConfig, transcribeVoiceAudio, type VoiceAudioInput, VoiceAudioError } from '@/lib/voice';
import { getStudentOsBridgeReadiness } from '@/lib/student-os-bridge-readiness';
import { NEXA_VERSION } from '@/lib/version';

const DEFAULT_DIAGNOSTICS_TIMEOUT_MS = 20_000;
const MAX_DIAGNOSTICS_TIMEOUT_MS = 60_000;
const MAX_DIAGNOSTIC_FIXTURE_BYTES = 512 * 1024;
const BUILTIN_RICH_SMOKE_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl8sAAAAASUVORK5CYII=';

export type CapabilityName = 'chat' | 'embedding' | 'voice' | 'richExtraction';
export type CapabilityCheckStatus = 'ok' | 'failed' | 'skipped';

export type CapabilitySmokeInput = {
  checks?: unknown;
  voice?: {
    data?: unknown;
    mediaType?: unknown;
    durationMs?: unknown;
  } | null;
  rich?: {
    data?: unknown;
    mediaType?: unknown;
    filename?: unknown;
    size?: unknown;
  } | null;
};

export type CapabilitySmokeResult = {
  capability: CapabilityName;
  status: CapabilityCheckStatus;
  model: string | null;
  latencyMs: number;
  code: string | null;
  metadata?: Record<string, string | number | boolean | null>;
};

function boundedInteger(name: string, fallback: number, min: number, max: number) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer from ${min} to ${max}.`);
  }
  return value;
}

function diagnosticsTimeoutMs() {
  return boundedInteger('NEXA_DIAGNOSTICS_TIMEOUT_MS', DEFAULT_DIAGNOSTICS_TIMEOUT_MS, 3_000, MAX_DIAGNOSTICS_TIMEOUT_MS);
}

function configuredDiagnosticsToken() {
  const enabled = String(process.env.NEXA_DIAGNOSTICS_ENABLED ?? '').trim().toLowerCase() === 'true';
  const token = String(process.env.NEXA_DIAGNOSTICS_TOKEN ?? '');
  if (!enabled || token.length < 32) return null;
  return token;
}

function safeEqualSecret(left: string, right: string) {
  const leftHash = createHash('sha256').update(left).digest();
  const rightHash = createHash('sha256').update(right).digest();
  return timingSafeEqual(leftHash, rightHash);
}

export function authorizeCapabilityDiagnostics(request: Request): 'ok' | 'disabled' | 'unauthorized' {
  const expected = configuredDiagnosticsToken();
  if (!expected) return 'disabled';
  const authorization = request.headers.get('authorization') ?? '';
  const bearer = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  const explicit = request.headers.get('x-nexa-diagnostics-token')?.trim() ?? '';
  const provided = bearer || explicit;
  return provided && safeEqualSecret(provided, expected) ? 'ok' : 'unauthorized';
}

function safeConfig<T>(getConfig: () => T) {
  try {
    return { ok: true as const, value: getConfig() };
  } catch {
    return { ok: false as const, value: null };
  }
}

export function getCapabilityConfiguration() {
  const gatewayConfigured = Boolean(process.env.AI_GATEWAY_API_KEY);
  const chat = safeConfig(getNexaAiRuntimeConfig);
  const embedding = safeConfig(getProjectSemanticConfig);
  const voice = safeConfig(getVoiceTranscriptionConfig);
  const rich = safeConfig(getRichProjectFileConfig);
  const studentOsBridge = getStudentOsBridgeReadiness();
  return {
    service: 'nexa' as const,
    version: NEXA_VERSION,
    diagnostics: configuredDiagnosticsToken() ? 'enabled' as const : 'disabled' as const,
    gateway: gatewayConfigured ? 'configured' as const : 'missing' as const,
    capabilities: {
      chat: { configured: gatewayConfigured && chat.ok, model: chat.ok ? chat.value.model : null },
      embedding: { configured: gatewayConfigured && embedding.ok, model: embedding.ok ? embedding.value.model : null, dimensions: embedding.ok ? embedding.value.dimensions : null },
      voice: { configured: gatewayConfigured && voice.ok, model: voice.ok ? voice.value.model : null },
      richExtraction: { configured: gatewayConfigured && rich.ok, model: rich.ok ? rich.value.model : null },
    },
    integrations: {
      studentOsBridge: {
        status: studentOsBridge.status,
        providerContractVersion: studentOsBridge.providerContractVersion,
        academicDecisionAuthority: studentOsBridge.academicDecisionAuthority,
      },
    },
  };
}

function normalizeChecks(value: unknown): CapabilityName[] {
  const allowed = new Set<CapabilityName>(['chat', 'embedding', 'voice', 'richExtraction']);
  const source = value == null ? ['chat', 'embedding'] : Array.isArray(value) ? value : [];
  const checks: CapabilityName[] = [];
  for (const item of source) {
    const name = String(item) as CapabilityName;
    if (!allowed.has(name)) throw new Error('INVALID_CAPABILITY_CHECK');
    if (!checks.includes(name)) checks.push(name);
  }
  if (!checks.length) throw new Error('INVALID_CAPABILITY_CHECK');
  return checks;
}

function encodedDataBytes(data: string) {
  const comma = data.indexOf(',');
  if (comma < 0) return Number.POSITIVE_INFINITY;
  const base64 = data.slice(comma + 1).replace(/[\r\n]/g, '');
  return Math.floor((base64.length * 3) / 4);
}

async function probeChat(): Promise<CapabilitySmokeResult> {
  const started = Date.now();
  const config = getNexaAiRuntimeConfig();
  try {
    if (!process.env.AI_GATEWAY_API_KEY) throw new Error('gateway_unconfigured');
    const result = await generateText({
      model: config.model,
      prompt: 'NEXA deployment capability probe. Reply with the single token NEXA_SMOKE_OK.',
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(Math.min(config.timeout.stepMs, diagnosticsTimeoutMs())),
    });
    const ok = String(result.text ?? '').trim().length > 0;
    return { capability: 'chat', status: ok ? 'ok' : 'failed', model: config.model, latencyMs: Date.now() - started, code: ok ? null : 'empty_response' };
  } catch {
    return { capability: 'chat', status: 'failed', model: config.model, latencyMs: Date.now() - started, code: 'provider_unavailable' };
  }
}

async function probeEmbedding(): Promise<CapabilitySmokeResult> {
  const started = Date.now();
  const config = getProjectSemanticConfig();
  try {
    if (!process.env.AI_GATEWAY_API_KEY) throw new Error('gateway_unconfigured');
    const result = await embed({
      model: gateway.embeddingModel(config.model),
      value: 'NEXA capability smoke probe',
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(Math.min(config.timeoutMs, diagnosticsTimeoutMs())),
      providerOptions: { openai: { dimensions: config.dimensions } },
    });
    const vector = result.embedding;
    const finite = vector.length > 0 && vector.every((value) => Number.isFinite(value));
    const dimensionsMatch = vector.length === config.dimensions;
    const ok = finite && dimensionsMatch;
    return {
      capability: 'embedding',
      status: ok ? 'ok' : 'failed',
      model: config.model,
      latencyMs: Date.now() - started,
      code: ok ? null : finite ? 'dimension_mismatch' : 'invalid_embedding',
      metadata: { dimensions: vector.length },
    };
  } catch {
    return { capability: 'embedding', status: 'failed', model: config.model, latencyMs: Date.now() - started, code: 'provider_unavailable' };
  }
}

async function probeVoice(input: CapabilitySmokeInput['voice']): Promise<CapabilitySmokeResult> {
  const started = Date.now();
  const config = getVoiceTranscriptionConfig();
  const data = String(input?.data ?? '');
  const mediaType = String(input?.mediaType ?? '');
  if (!data || !mediaType) {
    return { capability: 'voice', status: 'skipped', model: config.model, latencyMs: Date.now() - started, code: 'fixture_required' };
  }
  if (encodedDataBytes(data) > MAX_DIAGNOSTIC_FIXTURE_BYTES) {
    return { capability: 'voice', status: 'failed', model: config.model, latencyMs: Date.now() - started, code: 'fixture_too_large' };
  }
  try {
    const voiceInput: VoiceAudioInput = {
      data,
      mediaType,
      durationMs: input?.durationMs == null ? null : Number(input.durationMs),
      source: 'imported',
    };
    const result = await transcribeVoiceAudio(voiceInput, 'free');
    return {
      capability: 'voice',
      status: result.transcript ? 'ok' : 'failed',
      model: result.model ?? config.model,
      latencyMs: Date.now() - started,
      code: result.transcript ? null : 'empty_transcript',
      metadata: { language: result.language ?? null, durationMs: result.durationMs ?? null },
    };
  } catch (error) {
    const code = error instanceof VoiceAudioError && !['VOICE_GATEWAY_UNCONFIGURED', 'VOICE_TRANSCRIPTION_FAILED'].includes(error.code)
      ? 'invalid_fixture'
      : 'provider_unavailable';
    return { capability: 'voice', status: 'failed', model: config.model, latencyMs: Date.now() - started, code };
  }
}

async function probeRichExtraction(input: CapabilitySmokeInput['rich']): Promise<CapabilitySmokeResult> {
  const started = Date.now();
  const config = getRichProjectFileConfig();
  const data = String(input?.data ?? BUILTIN_RICH_SMOKE_PNG);
  const mediaType = String(input?.mediaType ?? 'image/png');
  const filename = String(input?.filename ?? 'nexa-smoke.png');
  if (encodedDataBytes(data) > MAX_DIAGNOSTIC_FIXTURE_BYTES) {
    return { capability: 'richExtraction', status: 'failed', model: config.model, latencyMs: Date.now() - started, code: 'fixture_too_large' };
  }
  try {
    const normalized = normalizeRichProjectFileInput({ filename, mediaType, data, size: input?.size == null ? null : Number(input.size) }, 'free');
    const result = await extractRichProjectKnowledge({
      filename: normalized.filename,
      mediaType: normalized.mediaType,
      bytes: normalized.bytes,
      maxChars: 2_000,
      timeoutMs: Math.min(config.timeoutMs, diagnosticsTimeoutMs()),
      maxRetries: 0,
    });
    return {
      capability: 'richExtraction',
      status: result.text ? 'ok' : 'failed',
      model: result.model,
      latencyMs: Date.now() - started,
      code: result.text ? null : 'empty_extraction',
    };
  } catch (error) {
    const code = error instanceof Error && error.name === 'RichProjectFileError' ? 'invalid_fixture' : 'provider_unavailable';
    return { capability: 'richExtraction', status: 'failed', model: config.model, latencyMs: Date.now() - started, code };
  }
}

export async function runCapabilitySmoke(input: CapabilitySmokeInput) {
  const checks = normalizeChecks(input.checks);
  const results: CapabilitySmokeResult[] = [];
  for (const check of checks) {
    if (check === 'chat') results.push(await probeChat());
    else if (check === 'embedding') results.push(await probeEmbedding());
    else if (check === 'voice') results.push(await probeVoice(input.voice));
    else results.push(await probeRichExtraction(input.rich));
  }
  const status = results.every((result) => result.status === 'ok') ? 'ok' as const : 'degraded' as const;
  return { status, service: 'nexa' as const, version: NEXA_VERSION, checkedAt: new Date().toISOString(), results };
}
