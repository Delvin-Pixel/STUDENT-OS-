import { timingSafeEqual } from 'node:crypto';

export const STUDENT_OS_BRIDGE_CAPABILITIES = [
  'chat',
  'explain',
  'tutor',
  'generateMaterial',
  'generateQuiz',
  'coach',
] as const;

export type StudentOsBridgeCapability = (typeof STUDENT_OS_BRIDGE_CAPABILITIES)[number];

export const STUDENT_OS_BRIDGE_MAX_BODY_BYTES = 48 * 1024;
export const STUDENT_OS_BRIDGE_SECRET_MIN_CHARS = 32;
export const STUDENT_OS_BRIDGE_DEFAULT_TIMEOUT_MS = 18_000;
export const STUDENT_OS_BRIDGE_MIN_TIMEOUT_MS = 1_000;
export const STUDENT_OS_BRIDGE_MAX_TIMEOUT_MS = 60_000;
export const STUDENT_OS_BRIDGE_REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export type StudentOsBridgeEnvelope = Readonly<{
  capability: StudentOsBridgeCapability;
  request: Readonly<Record<string, unknown> & {
    requestId: string;
    userId: string;
    prompt: string;
  }>;
}>;

function boundedTrimmedString(value: unknown, max: number) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized || normalized.length > max) return null;
  return normalized;
}

export function isConfiguredStudentOsBridgeSecret(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length >= STUDENT_OS_BRIDGE_SECRET_MIN_CHARS;
}

export function authorizeStudentOsBridge(authorization: string | null, configuredSecret: string) {
  if (!isConfiguredStudentOsBridgeSecret(configuredSecret)) return false;
  if (!authorization?.startsWith('Bearer ')) return false;
  const supplied = authorization.slice('Bearer '.length).trim();
  if (!supplied) return false;

  const suppliedBytes = Buffer.from(supplied);
  const configuredBytes = Buffer.from(configuredSecret.trim());
  if (suppliedBytes.length !== configuredBytes.length) return false;
  return timingSafeEqual(suppliedBytes, configuredBytes);
}

export function normalizeStudentOsBridgeUserHeader(value: string | null) {
  return boundedTrimmedString(value, 128);
}

export function normalizeStudentOsBridgeRequestId(value: unknown) {
  const normalized = boundedTrimmedString(value, 128);
  return normalized && STUDENT_OS_BRIDGE_REQUEST_ID_PATTERN.test(normalized)
    ? normalized
    : null;
}

export function getStudentOsBridgeTimeoutMs(raw: string | undefined) {
  if (raw === undefined || raw === '') return STUDENT_OS_BRIDGE_DEFAULT_TIMEOUT_MS;
  const value = Number(raw);
  if (
    !Number.isInteger(value)
    || value < STUDENT_OS_BRIDGE_MIN_TIMEOUT_MS
    || value > STUDENT_OS_BRIDGE_MAX_TIMEOUT_MS
  ) {
    throw new Error(
      `NEXA_STUDENT_OS_BRIDGE_TIMEOUT_MS must be an integer from ${STUDENT_OS_BRIDGE_MIN_TIMEOUT_MS} to ${STUDENT_OS_BRIDGE_MAX_TIMEOUT_MS}.`,
    );
  }
  return value;
}

export function parseStudentOsBridgeEnvelope(value: unknown): StudentOsBridgeEnvelope | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.capability !== 'string'
    || !STUDENT_OS_BRIDGE_CAPABILITIES.includes(record.capability as StudentOsBridgeCapability)
  ) {
    return null;
  }
  if (!record.request || typeof record.request !== 'object' || Array.isArray(record.request)) return null;
  const request = record.request as Record<string, unknown>;
  const requestId = normalizeStudentOsBridgeRequestId(request.requestId);
  const userId = boundedTrimmedString(request.userId, 128);
  const prompt = boundedTrimmedString(request.prompt, 12_000);
  if (!requestId || !userId || !prompt) return null;

  return Object.freeze({
    capability: record.capability as StudentOsBridgeCapability,
    request: Object.freeze({
      ...request,
      requestId,
      userId,
      prompt,
    }),
  });
}
