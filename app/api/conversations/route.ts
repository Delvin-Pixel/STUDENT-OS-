import { requireUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { getRequestId, jsonResponse, mapBodyError, readJsonBody } from '@/lib/http';
import { enforceUserMutationRateLimit } from '@/lib/rate-limit';
import { getIdempotencyKey, hashRequestBody, mapIdempotencyError, withIdempotency } from '@/lib/idempotency';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const result = projectId
      ? await query(
          `select id, project_id, title, created_at, updated_at
           from conversations
           where user_id = $1 and project_id = $2
           order by updated_at desc
           limit 100`,
          [user.id, projectId],
        )
      : await query(
          `select id, project_id, title, created_at, updated_at
           from conversations
           where user_id = $1
           order by updated_at desc
           limit 50`,
          [user.id],
        );
    return Response.json({ conversations: result.rows });
  } catch (error) {
    const status = error instanceof Error && error.message === 'UNAUTHENTICATED' ? 401 : 500;
    return Response.json({ error: status === 401 ? 'Sign in required.' : 'Could not load conversations.' }, { status });
  }
}

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  try {
    const user = await requireUser();
    const limited = await enforceUserMutationRateLimit(user.id, 'conversations', requestId, 30);
    if (limited) return limited;
    let body: Record<string, unknown>;
    try { body = await readJsonBody<Record<string, unknown>>(request, 16 * 1024); }
    catch (error) { return jsonResponse({ error: mapBodyError(error) ?? 'Invalid request.' }, { status: 400, requestId: getRequestId(request) }); }
    const title = String(body?.title ?? 'New conversation').trim().slice(0, 120) || 'New conversation';
    const projectId = body?.projectId ? String(body.projectId) : null;

    if (projectId) {
      const project = await query(
        `select id from projects where id = $1 and user_id = $2 limit 1`,
        [projectId, user.id],
      );
      if (!project.rows[0]) return Response.json({ error: 'Project not found.' }, { status: 404 });
    }

    const idempotencyKey = getIdempotencyKey(request);
    const result = await withIdempotency(
      { userId: user.id, scope: 'conversations:create', key: idempotencyKey, requestHash: hashRequestBody(body) },
      async (client) => {
        const created = await client.query(
          `insert into conversations (user_id, project_id, title)
           values ($1, $2, $3)
           returning id, project_id, title, created_at, updated_at`,
          [user.id, projectId, title],
        );
        return { status: 201, body: { conversation: created.rows[0] } };
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
    const status = error instanceof Error && error.message === 'UNAUTHENTICATED' ? 401 : 500;
    return jsonResponse({ error: status === 401 ? 'Sign in required.' : 'Could not create conversation.' }, { status, requestId });
  }
}
