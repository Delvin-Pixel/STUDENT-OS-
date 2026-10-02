import { createHash } from 'node:crypto';

export const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{8,255}$/;

export function validateIdempotencyKey(raw: string | null) {
  if (!raw) return null;
  const key = raw.trim();
  return IDEMPOTENCY_KEY_PATTERN.test(key) ? key : null;
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stableValue(item)]),
    );
  }
  return value;
}

export function hashRequestBody(body: unknown) {
  return createHash('sha256').update(JSON.stringify(stableValue(body))).digest('hex');
}
