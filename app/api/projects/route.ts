import { requireUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { getRequestId, jsonResponse, mapBodyError, readJsonBody } from '@/lib/http';
import { enforceUserMutationRateLimit } from '@/lib/rate-limit';
import { getIdempotencyKey, hashRequestBody, mapIdempotencyError, withIdempotency } from '@/lib/idempotency';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const user = await requireUser();
    const result = await query(
      `select p.id, p.name, p.description, p.created_at, p.updated_at,
              (select count(*)::int from conversations c where c.project_id = p.id and c.user_id = p.user_id) as conversation_count,
              (select count(*)::int from project_files f where f.project_id = p.id and f.user_id = p.user_id) as file_count
       from projects p
       where p.user_id = $1
       order by p.updated_at desc
       limit 100`,
      [user.id],
    );
    return Response.json({ projects: result.rows });
  } catch (error) {
    const status = error instanceof Error && error.message === 'UNAUTHENTICATED' ? 401 : 500;
    return Response.json({ error: status === 401 ? 'Sign in required.' : 'Could not load projects.' }, { status });
  }
}

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  try {
    const user = await requireUser();
    const limited = await enforceUserMutationRateLimit(user.id, 'projects', requestId, 30);
    if (limited) return limited;
    let body: Record<string, unknown>;
    try { body = await readJsonBody<Record<string, unknown>>(request, 16 * 1024); }
    catch (error) { return jsonResponse({ error: mapBodyError(error) ?? 'Invalid request.' }, { status: 400, requestId: getRequestId(request) }); }
    const name = String(body?.name ?? '').trim().slice(0, 80);
    const description = String(body?.description ?? '').trim().slice(0, 300);

    if (!name) return jsonResponse({ error: 'Project name is required.' }, { status: 400, requestId });

    const idempotencyKey = getIdempotencyKey(request);
    const result = await withIdempotency(
      { userId: user.id, scope: 'projects:create', key: idempotencyKey, requestHash: hashRequestBody(body) },
      async (client) => {
        const created = await client.query(
          `insert into projects (user_id, name, description)
           values ($1, $2, $3)
           returning id, name, description, created_at, updated_at`,
          [user.id, name, description],
        );
        return { status: 201, body: { project: created.rows[0] } };
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
    return jsonResponse({ error: status === 401 ? 'Sign in required.' : 'Could not create project.' }, { status, requestId });
  }
}
