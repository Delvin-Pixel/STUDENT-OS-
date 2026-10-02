import { requireUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { getRequestId, jsonResponse, mapBodyError, readJsonBody } from '@/lib/http';
import { enforceUserMutationRateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const project = await query(
      `select id, name, description, created_at, updated_at
       from projects where id = $1 and user_id = $2 limit 1`,
      [id, user.id],
    );
    if (!project.rows[0]) return Response.json({ error: 'Project not found.' }, { status: 404 });

    const conversations = await query(
      `select id, title, created_at, updated_at
       from conversations
       where project_id = $1 and user_id = $2
       order by updated_at desc
       limit 100`,
      [id, user.id],
    );

    return Response.json({ project: project.rows[0], conversations: conversations.rows });
  } catch (error) {
    const status = error instanceof Error && error.message === 'UNAUTHENTICATED' ? 401 : 500;
    return Response.json({ error: status === 401 ? 'Sign in required.' : 'Could not load project.' }, { status });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId(request);
  try {
    const user = await requireUser();
    const limited = await enforceUserMutationRateLimit(user.id, 'project-updates', requestId, 60);
    if (limited) return limited;
    const { id } = await params;
    let body: Record<string, unknown>;
    try { body = await readJsonBody<Record<string, unknown>>(request, 16 * 1024); }
    catch (error) { return jsonResponse({ error: mapBodyError(error) ?? 'Invalid request.' }, { status: 400, requestId: getRequestId(request) }); }
    const name = body?.name === undefined ? undefined : String(body.name).trim().slice(0, 80);
    const description = body?.description === undefined ? undefined : String(body.description).trim().slice(0, 300);

    if (name !== undefined && !name) return Response.json({ error: 'Project name is required.' }, { status: 400 });
    if (name === undefined && description === undefined) return Response.json({ error: 'Nothing to update.' }, { status: 400 });

    const current = await query<{ name: string; description: string }>(
      `select name, description from projects where id = $1 and user_id = $2 limit 1`,
      [id, user.id],
    );
    if (!current.rows[0]) return Response.json({ error: 'Project not found.' }, { status: 404 });

    const result = await query(
      `update projects
       set name = $1, description = $2, updated_at = now()
       where id = $3 and user_id = $4
       returning id, name, description, created_at, updated_at`,
      [name ?? current.rows[0].name, description ?? current.rows[0].description, id, user.id],
    );
    return Response.json({ project: result.rows[0] });
  } catch (error) {
    const status = error instanceof Error && error.message === 'UNAUTHENTICATED' ? 401 : 500;
    return Response.json({ error: status === 401 ? 'Sign in required.' : 'Could not update project.' }, { status });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId(request);
  try {
    const user = await requireUser();
    const limited = await enforceUserMutationRateLimit(user.id, 'project-deletes', requestId, 30);
    if (limited) return limited;
    const { id } = await params;
    const result = await query(
      `delete from projects where id = $1 and user_id = $2 returning id`,
      [id, user.id],
    );
    if (!result.rows[0]) return Response.json({ error: 'Project not found.' }, { status: 404 });
    return Response.json({ ok: true });
  } catch (error) {
    const status = error instanceof Error && error.message === 'UNAUTHENTICATED' ? 401 : 500;
    return Response.json({ error: status === 401 ? 'Sign in required.' : 'Could not delete project.' }, { status });
  }
}
