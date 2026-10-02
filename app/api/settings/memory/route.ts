import { enforceUserMutationRateLimit } from '@/lib/rate-limit';
import { requireUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { getRequestId, jsonResponse, mapBodyError, readJsonBody } from '@/lib/http';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const user = await requireUser();
    return Response.json({ enabled: user.memory_enabled });
  } catch (error) {
    const status = error instanceof Error && error.message === 'UNAUTHENTICATED' ? 401 : 500;
    return Response.json({ error: status === 401 ? 'Sign in required.' : 'Could not load memory settings.' }, { status });
  }
}

export async function PATCH(request: Request) {
  const requestId = getRequestId(request);
  try {
    const user = await requireUser();
    const limited = await enforceUserMutationRateLimit(user.id, 'memory-settings', requestId, 20);
    if (limited) return limited;
    let body: Record<string, unknown>;
    try { body = await readJsonBody<Record<string, unknown>>(request, 4 * 1024); }
    catch (error) { return jsonResponse({ error: mapBodyError(error) ?? 'Invalid request.' }, { status: 400, requestId: getRequestId(request) }); }
    if (typeof body?.enabled !== 'boolean') return jsonResponse({ error: 'enabled must be a boolean.' }, { status: 400, requestId });
    const enabled = body.enabled;
    await query('update users set memory_enabled = $1 where id = $2', [enabled, user.id]);
    return Response.json({ enabled });
  } catch (error) {
    const status = error instanceof Error && error.message === 'UNAUTHENTICATED' ? 401 : 500;
    return Response.json({ error: status === 401 ? 'Sign in required.' : 'Could not update memory settings.' }, { status });
  }
}
