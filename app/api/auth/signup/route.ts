import { createUser } from '@/lib/auth';
import { consumeRateLimit, getRequestFingerprint, rateLimitKey, rateLimitResponse } from '@/lib/rate-limit';
import { getRequestId, jsonResponse, mapBodyError, readJsonBody } from '@/lib/http';
import { recordSecurityEvent } from '@/lib/audit';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  let body: Record<string, unknown>;
  try {
    body = await readJsonBody<Record<string, unknown>>(request, 16 * 1024);
  } catch (error) {
    return jsonResponse({ error: mapBodyError(error) ?? 'Invalid request.' }, { status: 400, requestId });
  }

  try {
    const limit = await consumeRateLimit({ key: rateLimitKey('signup-ip', getRequestFingerprint(request)), limit: 4, windowSeconds: 15 * 60 });
    if (!limit.allowed) {
      await recordSecurityEvent({ action: 'rate_limited', requestId, success: false, metadata: { scope: 'signup' } });
      return rateLimitResponse(limit, requestId);
    }

    const user = await createUser({
      name: String(body?.name ?? ''),
      email: String(body?.email ?? ''),
      password: String(body?.password ?? ''),
    });
    await recordSecurityEvent({ action: 'signup', userId: user.id, requestId });
    return jsonResponse({ user }, { status: 201, requestId });
  } catch (error) {
    const raw = error instanceof Error ? error.message : '';
    const duplicate = raw.toLowerCase().includes('duplicate key') || raw.toLowerCase().includes('unique constraint');
    const validationMessages = new Set([
      'Name is required.',
      'Enter a valid email address.',
      'Password must be at least 8 characters.',
      'Password must be 128 characters or fewer.',
    ]);
    const isValidation = validationMessages.has(raw);
    const message = duplicate
      ? 'An account with that email already exists.'
      : isValidation
        ? raw
        : 'Could not create account right now.';
    await recordSecurityEvent({ action: 'signup', requestId, success: false, metadata: { reason: duplicate ? 'duplicate_account' : isValidation ? 'validation' : 'internal_error' } });
    return jsonResponse({ error: message }, { status: duplicate ? 409 : isValidation ? 400 : 500, requestId });
  }
}
