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

export const STUDENT_OS_BRIDGE_CONTRACT_VERSION = '1.0' as const;
export const STUDENT_OS_BRIDGE_ACCEPT_CONTRACT_HEADER = 'X-NEXA-Bridge-Accept-Contract' as const;
export const STUDENT_OS_BRIDGE_SUPPORTED_CONTRACT_VERSIONS = Object.freeze([
  STUDENT_OS_BRIDGE_CONTRACT_VERSION,
] as const);
export const STUDENT_OS_BRIDGE_MAX_NEGOTIATED_VERSIONS = 8;
export const STUDENT_OS_BRIDGE_CONTRACT_VERSION_PATTERN = /^\d+\.\d+$/;

export type StudentOsBridgeContractNegotiation =
  | Readonly<{
      compatible: true;
      version: string;
      source: 'explicit' | 'legacy-default';
      requestedVersions: readonly string[];
      supportedVersions: readonly string[];
    }>
  | Readonly<{
      compatible: false;
      reason: 'invalid_contract_header' | 'unsupported_contract';
      requestedVersions: readonly string[];
      supportedVersions: readonly string[];
    }>;

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

export function negotiateStudentOsBridgeContract(
  rawHeader: string | null,
): StudentOsBridgeContractNegotiation {
  const supportedVersions = STUDENT_OS_BRIDGE_SUPPORTED_CONTRACT_VERSIONS;

  if (rawHeader === null || rawHeader.trim() === '') {
    return Object.freeze({
      compatible: true,
      version: STUDENT_OS_BRIDGE_CONTRACT_VERSION,
      source: 'legacy-default',
      requestedVersions: Object.freeze([]),
      supportedVersions,
    });
  }

  if (rawHeader.length > 256) {
    return Object.freeze({
      compatible: false,
      reason: 'invalid_contract_header',
      requestedVersions: Object.freeze([]),
      supportedVersions,
    });
  }

  const tokens = rawHeader.split(',').map((value) => value.trim());
  if (
    tokens.length === 0
    || tokens.length > STUDENT_OS_BRIDGE_MAX_NEGOTIATED_VERSIONS
    || tokens.some((value) => !STUDENT_OS_BRIDGE_CONTRACT_VERSION_PATTERN.test(value))
  ) {
    return Object.freeze({
      compatible: false,
      reason: 'invalid_contract_header',
      requestedVersions: Object.freeze([]),
      supportedVersions,
    });
  }

  const requestedVersions = Object.freeze([...new Set(tokens)]);
  const version = requestedVersions.find((candidate) =>
    supportedVersions.includes(candidate as typeof STUDENT_OS_BRIDGE_CONTRACT_VERSION)
  );

  if (!version) {
    return Object.freeze({
      compatible: false,
      reason: 'unsupported_contract',
      requestedVersions,
      supportedVersions,
    });
  }

  return Object.freeze({
    compatible: true,
    version,
    source: 'explicit',
    requestedVersions,
    supportedVersions,
  });
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
