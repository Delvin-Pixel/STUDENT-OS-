import { createHmac, randomBytes } from 'node:crypto';
import { query } from '@/lib/db';

const developmentSecret = randomBytes(32).toString('hex');

export function hasConfiguredRateLimitSecret() {
  const secret = process.env.RATE_LIMIT_SECRET;
  return Boolean(secret && secret.length >= 32);
}

function getSecret() {
  const configured = process.env.RATE_LIMIT_SECRET;
  if (configured && configured.length >= 32) return configured;
  if (process.env.NODE_ENV === 'production') throw new Error('RATE_LIMIT_SECRET must be at least 32 characters in production.');
  return developmentSecret;
}

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: Date;
  retryAfterSeconds: number;
};

function fingerprint(value: string) {
  return createHmac('sha256', getSecret()).update(value).digest('hex');
}

function windowStart(windowSeconds: number) {
  const size = Math.max(1, windowSeconds) * 1000;
  return new Date(Math.floor(Date.now() / size) * size);
}

export function getRequestFingerprint(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const real = request.headers.get('x-real-ip')?.trim();
  return forwarded || real || 'unknown-client';
}

export function rateLimitKey(scope: string, value: string) {
  return `${scope}:${fingerprint(value)}`;
}

export async function consumeRateLimit(params: {
  key: string;
  limit: number;
  windowSeconds: number;
}): Promise<RateLimitResult> {
  const limit = Math.max(1, Math.floor(params.limit));
  const windowSeconds = Math.max(1, Math.floor(params.windowSeconds));
  const start = windowStart(windowSeconds);
  const resetAt = new Date(start.getTime() + windowSeconds * 1000);

  await query('delete from rate_limit_buckets where bucket_key = $1 and expires_at <= now()', [params.key]);

  const result = await query<{ request_count: number }>(
    `insert into rate_limit_buckets (bucket_key, window_start, request_count, expires_at)
     values ($1, $2, 1, $3)
     on conflict (bucket_key, window_start)
     do update set request_count = rate_limit_buckets.request_count + 1,
                   expires_at = excluded.expires_at
     where rate_limit_buckets.request_count < $4
     returning request_count`,
    [params.key, start, resetAt, limit],
  );

  const count = Number(result.rows[0]?.request_count ?? limit);
  const allowed = result.rows.length > 0;
  const remaining = Math.max(0, limit - count);
  const retryAfterSeconds = Math.max(1, Math.ceil((resetAt.getTime() - Date.now()) / 1000));

  return { allowed, limit, remaining, resetAt, retryAfterSeconds };
}

export async function enforceUserMutationRateLimit(
  userId: string,
  scope: string,
  requestId: string,
  limit = 60,
) {
  const result = await consumeRateLimit({
    key: rateLimitKey(`mutation-${scope}`, userId),
    limit,
    windowSeconds: 60,
  });
  if (!result.allowed) return rateLimitResponse(result, requestId);
  return null;
}

export async function enforceUserReadRateLimit(
  userId: string,
  scope: string,
  requestId: string,
  limit = 60,
) {
  const result = await consumeRateLimit({
    key: rateLimitKey(`read-${scope}`, userId),
    limit,
    windowSeconds: 60,
  });
  if (!result.allowed) return rateLimitResponse(result, requestId);
  return null;
}

export function rateLimitResponse(result: RateLimitResult, requestId?: string) {
  return Response.json(
    { error: 'Too many requests. Please try again shortly.' },
    {
      status: 429,
      headers: {
        'Retry-After': String(result.retryAfterSeconds),
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': String(result.remaining),
        'X-RateLimit-Reset': result.resetAt.toISOString(),
        ...(requestId ? { 'X-Request-Id': requestId } : {}),
      },
    },
  );
}
