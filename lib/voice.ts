import { experimental_transcribe as transcribe, gateway } from 'ai';
import type { VoiceInput } from '@/lib/multimodal';

const DEFAULT_TRANSCRIPTION_MODEL = 'google/gemini-3.5-transcribe';
const DEFAULT_TRANSCRIPTION_TIMEOUT_MS = 45_000;
const DEFAULT_TRANSCRIPTION_MAX_RETRIES = 1;
const MAX_TRANSCRIPT_CHARS = 16_000;

const ALLOWED_VOICE_MEDIA_TYPES = new Set([
  'audio/webm',
  'audio/ogg',
  'audio/wav',
  'audio/mpeg',
  'audio/mp4',
  'audio/x-m4a',
  'audio/flac',
]);

export type VoiceTranscriptionResult = {
  text: string;
  durationMs?: number | null;
  language?: string | null;
  model?: string | null;
};

export type VoiceTranscriber = {
  transcribe(input: { audio: Buffer; mediaType: string }): Promise<VoiceTranscriptionResult>;
};

export type VoiceAudioInput = {
  data: string;
  mediaType: string;
  durationMs?: number | null;
  source?: 'microphone' | 'imported' | 'unknown';
};

export class VoiceAudioError extends Error {
  code:
    | 'VOICE_UNSUPPORTED'
    | 'VOICE_TOO_LARGE'
    | 'VOICE_TOO_LONG'
    | 'VOICE_INVALID_ENCODING'
    | 'VOICE_EMPTY'
    | 'VOICE_GATEWAY_UNCONFIGURED'
    | 'VOICE_TRANSCRIPTION_FAILED';

  constructor(code: VoiceAudioError['code'], message: string) {
    super(message);
    this.name = 'VoiceAudioError';
    this.code = code;
  }
}

function boundedInteger(name: string, fallback: number, min: number, max: number) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer from ${min} to ${max}.`);
  }
  return value;
}

function getTranscriptionModelId() {
  const model = (process.env.NEXA_TRANSCRIPTION_MODEL ?? DEFAULT_TRANSCRIPTION_MODEL).trim();
  if (!model || model.length > 200 || !/^[A-Za-z0-9._:/-]+$/.test(model)) {
    throw new Error('NEXA_TRANSCRIPTION_MODEL must be a valid model identifier.');
  }
  return model;
}

export function getVoiceTranscriptionConfig() {
  return {
    model: getTranscriptionModelId(),
    timeoutMs: boundedInteger('NEXA_TRANSCRIPTION_TIMEOUT_MS', DEFAULT_TRANSCRIPTION_TIMEOUT_MS, 5_000, 120_000),
    maxRetries: boundedInteger('NEXA_TRANSCRIPTION_MAX_RETRIES', DEFAULT_TRANSCRIPTION_MAX_RETRIES, 0, 2),
  };
}

export function getVoiceUploadLimits(plan: 'free' | 'premium') {
  return plan === 'premium'
    ? { maxBytes: 3 * 1024 * 1024, maxDurationMs: 5 * 60 * 1000, requestsPerMinute: 20 }
    : { maxBytes: 2 * 1024 * 1024, maxDurationMs: 2 * 60 * 1000, requestsPerMinute: 6 };
}

function normalizeMediaType(mediaType: string) {
  return String(mediaType ?? '').split(';', 1)[0].trim().toLowerCase();
}

function hasSignature(bytes: Buffer, expected: number[], offset = 0) {
  if (bytes.length < offset + expected.length) return false;
  return expected.every((value, index) => bytes[offset + index] === value);
}

function validateAudioSignature(mediaType: string, bytes: Buffer) {
  if (mediaType === 'audio/webm') return hasSignature(bytes, [0x1a, 0x45, 0xdf, 0xa3]);
  if (mediaType === 'audio/ogg') return bytes.subarray(0, 4).toString('ascii') === 'OggS';
  if (mediaType === 'audio/wav') return bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WAVE';
  if (mediaType === 'audio/flac') return bytes.subarray(0, 4).toString('ascii') === 'fLaC';
  if (mediaType === 'audio/mp4' || mediaType === 'audio/x-m4a') return bytes.subarray(4, 8).toString('ascii') === 'ftyp';
  if (mediaType === 'audio/mpeg') {
    return bytes.subarray(0, 3).toString('ascii') === 'ID3' || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0);
  }
  return false;
}

export function normalizeVoiceAudioInput(input: VoiceAudioInput, plan: 'free' | 'premium') {
  const limits = getVoiceUploadLimits(plan);
  const mediaType = normalizeMediaType(input.mediaType);
  if (!ALLOWED_VOICE_MEDIA_TYPES.has(mediaType)) {
    throw new VoiceAudioError('VOICE_UNSUPPORTED', 'This audio format is not supported.');
  }

  const prefix = `data:${mediaType};base64,`;
  const data = String(input.data ?? '');
  if (!data.startsWith(prefix)) {
    throw new VoiceAudioError('VOICE_INVALID_ENCODING', 'Voice audio encoding is invalid.');
  }
  const base64 = data.slice(prefix.length);
  if (!base64 || /[^A-Za-z0-9+/=\r\n]/.test(base64)) {
    throw new VoiceAudioError('VOICE_INVALID_ENCODING', 'Voice audio encoding is invalid.');
  }

  const audio = Buffer.from(base64, 'base64');
  if (!audio.length) throw new VoiceAudioError('VOICE_EMPTY', 'The recording is empty.');
  if (audio.length > limits.maxBytes) {
    throw new VoiceAudioError('VOICE_TOO_LARGE', `Voice recordings are limited to ${Math.round(limits.maxBytes / 1024 / 1024)} MB on this plan.`);
  }
  if (!validateAudioSignature(mediaType, audio)) {
    throw new VoiceAudioError('VOICE_INVALID_ENCODING', 'Voice audio does not match its declared format.');
  }

  const durationMs = input.durationMs == null ? null : Number(input.durationMs);
  if (durationMs !== null && (!Number.isFinite(durationMs) || durationMs < 0 || durationMs > limits.maxDurationMs + 5_000)) {
    throw new VoiceAudioError('VOICE_TOO_LONG', `Voice recordings are limited to ${Math.round(limits.maxDurationMs / 60_000)} minutes on this plan.`);
  }
  const rawSource = String(input.source ?? 'unknown');
  const source = rawSource === 'microphone' || rawSource === 'imported' ? rawSource : 'unknown';
  return { audio, mediaType, durationMs, source, limits };
}

export async function transcribeVoiceAudio(input: VoiceAudioInput, plan: 'free' | 'premium') {
  const normalized = normalizeVoiceAudioInput(input, plan);
  if (!process.env.AI_GATEWAY_API_KEY) {
    throw new VoiceAudioError('VOICE_GATEWAY_UNCONFIGURED', 'Voice transcription is not configured yet.');
  }
  const config = getVoiceTranscriptionConfig();

  try {
    const result = await transcribe({
      model: gateway.transcriptionModel(config.model),
      audio: normalized.audio,
      maxRetries: config.maxRetries,
      abortSignal: AbortSignal.timeout(config.timeoutMs),
    });
    const text = String(result.text ?? '').trim().slice(0, MAX_TRANSCRIPT_CHARS);
    if (!text) throw new VoiceAudioError('VOICE_EMPTY', 'No speech was detected in that recording.');

    const providerDurationMs = Number.isFinite(Number(result.durationInSeconds))
      ? Math.max(0, Math.round(Number(result.durationInSeconds) * 1000))
      : null;
    const durationMs = providerDurationMs ?? normalized.durationMs;
    if (durationMs !== null && durationMs > normalized.limits.maxDurationMs) {
      throw new VoiceAudioError('VOICE_TOO_LONG', `Voice recordings are limited to ${Math.round(normalized.limits.maxDurationMs / 60_000)} minutes on this plan.`);
    }
    const language = result.language ? String(result.language).trim().slice(0, 32) : null;
    return {
      transcript: text,
      durationMs,
      language,
      source: normalized.source,
      model: config.model,
    };
  } catch (error) {
    if (error instanceof VoiceAudioError) throw error;
    throw new VoiceAudioError('VOICE_TRANSCRIPTION_FAILED', 'NEXA could not transcribe that recording. Please try again.');
  }
}

// Provider-neutral voice context remains separate from chat persistence so realtime or
// alternate transcription providers can evolve without changing the conversation contract.
export function buildVoiceContext(transcript: string, meta: VoiceInput | null = null) {
  return {
    transcript: transcript.trim().slice(0, MAX_TRANSCRIPT_CHARS),
    durationMs: meta?.durationMs ?? null,
    source: meta?.source ?? 'unknown',
  };
}
