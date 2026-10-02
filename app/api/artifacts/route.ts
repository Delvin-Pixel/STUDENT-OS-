import { requireUser } from '@/lib/auth';
import { createArtifact, listArtifacts } from '@/lib/artifacts';
import { getRequestId, jsonResponse, mapBodyError, readJsonBody } from '@/lib/http';
import { enforceUserMutationRateLimit } from '@/lib/rate-limit';
import { getIdempotencyKey, hashRequestBody, mapIdempotencyError, withIdempotency } from '@/lib/idempotency';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const params = new URL(request.url).searchParams;
    const projectId = params.get('projectId');
    const conversationId = params.get('conversationId');
    const artifacts = await listArtifacts(user.id, { projectId, conversationId, limit: Number(params.get('limit') ?? 50) });
    return Response.json({ artifacts });
  } catch (error) {
    const status = error instanceof Error && error.message === 'UNAUTHENTICATED' ? 401 : 500;
    return Response.json({ error: status === 401 ? 'Sign in required.' : 'Could not load artifacts.' }, { status });
  }
}

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  try {
    const user = await requireUser();
    const limited = await enforceUserMutationRateLimit(user.id, 'artifacts', requestId, 20);
    if (limited) return limited;
    let body: Record<string, unknown>;
    try { body = await readJsonBody<Record<string, unknown>>(request, 2 * 1024 * 1024); }
    catch (error) { return jsonResponse({ error: mapBodyError(error) ?? 'Invalid request.' }, { status: 400, requestId }); }
    const idempotencyKey = getIdempotencyKey(request);
    const result = await withIdempotency(
      { userId: user.id, scope: 'artifacts:create', key: idempotencyKey, requestHash: hashRequestBody(body) },
      async (client) => {
        const artifact = await createArtifact({
          userId: user.id,
          plan: user.plan,
          projectId: body?.projectId ? String(body.projectId) : null,
          conversationId: body?.conversationId ? String(body.conversationId) : null,
          title: String(body?.title ?? ''),
          filename: body?.filename ? String(body.filename) : null,
          type: String(body?.type ?? '') as 'document' | 'report' | 'code' | 'data' | 'note',
          mimeType: body?.mimeType ? String(body.mimeType) : null,
          language: body?.language ? String(body.language) : null,
          content: String(body?.content ?? ''),
          metadata: body?.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata) ? body.metadata as Record<string, unknown> : {},
          client,
        });
        return { status: 201, body: { artifact } };
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
    const clientErrors = new Set(['Artifact title is required.', 'Artifact content is required.', 'Unsupported artifact type.', 'Project not found.', 'Conversation not found.', 'Conversation does not belong to that project.']);
    const status = message === 'UNAUTHENTICATED' ? 401 : clientErrors.has(message) || (message.startsWith('Your ') && message.includes('artifact limit has been reached.')) ? 400 : 500;
    return jsonResponse({ error: status === 500 ? 'Could not create artifact.' : message }, { status, requestId });
  }
}
