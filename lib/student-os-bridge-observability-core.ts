import { createHmac } from 'node:crypto';

export const STUDENT_OS_BRIDGE_EVENT_TYPES = [
  'claimed',
  'recovered',
  'rate_limited',
  'mismatch',
  'in_progress',
  'replayed',
  'completed',
  'failed',
  'operational_rejected',
  'ownership_lost',
] as const;

export type StudentOsBridgeEventType = (typeof STUDENT_OS_BRIDGE_EVENT_TYPES)[number];

export function fingerprintStudentOsBridgeUser(externalUserId: string, secret: string) {
  const userId = String(externalUserId ?? '').trim();
  const key = String(secret ?? '');
  if (!userId || userId.length > 128) {
    throw new Error('Student OS bridge user identity is invalid.');
  }
  if (key.length < 32) {
    throw new Error('RATE_LIMIT_SECRET must be at least 32 characters for bridge observability.');
  }
  return createHmac('sha256', key).update(userId).digest('hex');
}

export function normalizeStudentOsBridgeDurationMs(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(86_400_000, Math.floor(value)));
}
