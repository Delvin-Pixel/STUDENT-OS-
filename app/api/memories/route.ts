import { requireUser } from '@/lib/auth';
import { createMemory, listMemories, type MemoryKind } from '@/lib/memory';
import { getRequestId, jsonResponse, mapBodyError, readJsonBody } from '@/lib/http';
import { enforceUserMutationRateLimit } from '@/lib/rate-limit';
import { getIdempotencyKey, hashRequestBody, mapIdempotencyError, withIdempotency } from '@/lib/idempotency';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const params = new URL(request.url).searchParams;
    const scope = params.get('scope') === 'project' ? 'project' : 'saved';
    const projectId = params.get('projectId');
    if (scope === 'project' && !projectId) return Response.json({ error: 'Project ID required.' }, { status: 400 });
    const memories = await listMemories(user.id, { scope, projectId });
    return Response.json({ memories, enabled: user.memory_enabled });
  } catch (error) {
    const status = error instanceof Error && error.message === 'UNAUTHENTICATED' ? 401 : 500;
    return Response.json({ error: status === 401 ? 'Sign in required.' : 'Could not load memory.' }, { status });
  }
}

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  try {
    const user = await requireUser();
    const limited = await enforceUserMutationRateLimit(user.id, 'memories', requestId, 30);
    if (limited) return limited;
    let body: Record<string, unknown>;
    try { body = await readJsonBody<Record<string, unknown>>(request, 32 * 1024); }
    catch (error) { return jsonResponse({ error: mapBodyError(error) ?? 'Invalid request.' }, { status: 400, requestId: getRequestId(request) }); }
    const idempotencyKey = getIdempotencyKey(request);
    const result = await withIdempotency(
      { userId: user.id, scope: 'memories:create', key: idempotencyKey, requestHash: hashRequestBody(body) },
      async (client) => {
        if (!user.memory_enabled) throw new Error('Memory is turned off for this account.');
        const scope = body?.scope === 'project' ? 'project' : 'saved';
        const projectId = body?.projectId ? String(body.projectId) : null;
        const memory = await createMemory({
          userId: user.id,
          plan: user.plan,
          scope,
          kind: body?.kind === undefined ? undefined : String(body.kind) as MemoryKind,
          label: body?.label === undefined ? undefined : String(body.label),
          content: String(body?.content ?? ''),
          projectId,
          sourceConversationId: body?.sourceConversationId ? String(body.sourceConversationId) : null,
          importance: body?.importance === undefined ? undefined : Number(body.importance),
          client,
        });
        return { status: 201, body: { memory } };
      },
    );
    return jsonResponse(result.result.body, {
      status: result.result.status,
      requestId,
      headers: result.replay ? { 'X-Idempotency-Replayed': 'true' } : undefined,
    });
  } catch (error) {
    const idempotencyMessage = mapIdempotencyError(error);
    if (idempotencyMessage) return jsonResponse({ error: idempotencyMessage }, { status: 409, requestId });
    const message = error instanceof Error ? error.message : '';
    const clientErrors = new Set([
      'Memory is turned off for this account.',
      'Memory content is required.',
      'Project memory requires a project.',
      'Project not found.',
      'Source conversation not found.',
      'Source conversation does not belong to that project.',
      'Unsupported memory kind.',
      'Memory importance must be a number.',
    ]);
    const isClientError = clientErrors.has(message);
    const status = message === 'UNAUTHENTICATED' ? 401 : isClientError ? 400 : 500;
    return jsonResponse({ error: status === 500 ? 'Could not save memory.' : message }, { status, requestId });
  }
}
