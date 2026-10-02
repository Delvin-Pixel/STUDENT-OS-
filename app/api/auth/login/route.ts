import { loginUser } from '@/lib/auth';
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
  const email = String(body?.email ?? '').trim().toLowerCase();
  const client = getRequestFingerprint(request);

  try {
    const ipLimit = await consumeRateLimit({ key: rateLimitKey('login-ip', client), limit: 8, windowSeconds: 60 });
    if (!ipLimit.allowed) {
      await recordSecurityEvent({ action: 'rate_limited', requestId, success: false, metadata: { scope: 'login-ip' } });
      return rateLimitResponse(ipLimit, requestId);
    }

    if (email) {
      const identityLimit = await consumeRateLimit({ key: rateLimitKey('login-email', email), limit: 5, windowSeconds: 60 });
      if (!identityLimit.allowed) {
        await recordSecurityEvent({ action: 'rate_limited', requestId, success: false, metadata: { scope: 'login-email' } });
        return rateLimitResponse(identityLimit, requestId);
      }
    }

    const user = await loginUser(email, String(body?.password ?? ''));
    await recordSecurityEvent({ action: 'login_success', userId: user.id, requestId });
    return jsonResponse({ user }, { requestId });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const invalidCredentials = message === 'Invalid email or password.';
    await recordSecurityEvent({ action: 'login_failed', requestId, success: false, metadata: { reason: invalidCredentials ? 'invalid_credentials' : 'internal_error' } });
    return jsonResponse(
      { error: invalidCredentials ? 'Invalid email or password.' : 'Could not sign in right now.' },
      { status: invalidCredentials ? 401 : 500, requestId },
    );
  }
}
