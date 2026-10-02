import { requireUser } from '@/lib/auth';
import { query, withTransaction } from '@/lib/db';
import { getRequestId, jsonResponse, mapBodyError, readJsonBody } from '@/lib/http';
import { enforceUserMutationRateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const conversation = await query(
      `select id, project_id, title, created_at, updated_at
       from conversations where id = $1 and user_id = $2 limit 1`,
      [id, user.id],
    );
    if (!conversation.rows[0]) return Response.json({ error: 'Conversation not found.' }, { status: 404 });

    const messages = await query<{ id: string; role: string; content: string; metadata: unknown; execution_attempt_id: string | null; created_at: string }>(
      `select id, role, content, metadata, execution_attempt_id, created_at
       from messages where conversation_id = $1 order by created_at asc`,
      [id],
    );
    type MessageSourceRow = {
      messageId: string; order: number; label: string; sourceType: string; sourceId: string | null; title: string; excerpt: string;
      retrieval: string | null; relevance: number | null; sourceUpdatedAt: string | null; sourceUrl: string | null; provider: string | null;
    };
    const sourceRows = await query<MessageSourceRow>(
      `select message_id as "messageId", source_order as "order", source_label as label, source_type as "sourceType",
              source_id as "sourceId", title, excerpt, retrieval, relevance, source_updated_at as "sourceUpdatedAt",
              null::text as "sourceUrl", null::text as provider
       from assistant_message_sources
       where conversation_id = $1 and user_id = $2
       order by message_id asc, source_order asc`,
      [id, user.id],
    );
    const externalSourceRows = await query<MessageSourceRow>(
      `select message_id as "messageId", source_order as "order", source_label as label, 'web'::text as "sourceType",
              null::uuid as "sourceId", title, excerpt, null::text as retrieval, null::double precision as relevance,
              source_updated_at as "sourceUpdatedAt", source_url as "sourceUrl", provider
       from assistant_message_external_sources
       where conversation_id = $1 and user_id = $2
       order by message_id asc, source_order asc`,
      [id, user.id],
    );
    const sourcesByMessage = new Map<string, MessageSourceRow[]>();
    for (const source of [...sourceRows.rows, ...externalSourceRows.rows]) {
      const current = sourcesByMessage.get(source.messageId) ?? [];
      current.push(source);
      sourcesByMessage.set(source.messageId, current);
    }
    const hydratedMessages = messages.rows.map((message) => ({
      ...message,
      sources: message.role === 'assistant' ? (sourcesByMessage.get(message.id) ?? []) : [],
    }));

    return Response.json({ conversation: conversation.rows[0], messages: hydratedMessages });
  } catch (error) {
    const status = error instanceof Error && error.message === 'UNAUTHENTICATED' ? 401 : 500;
    return Response.json({ error: status === 401 ? 'Sign in required.' : 'Could not load conversation.' }, { status });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId(request);
  try {
    const user = await requireUser();
    const limited = await enforceUserMutationRateLimit(user.id, 'conversation-updates', requestId, 60);
    if (limited) return limited;
    const { id } = await params;
    let body: Record<string, unknown>;
    try { body = await readJsonBody<Record<string, unknown>>(request, 16 * 1024); }
    catch (error) { return jsonResponse({ error: mapBodyError(error) ?? 'Invalid request.' }, { status: 400, requestId: getRequestId(request) }); }
    const title = body?.title === undefined ? undefined : String(body.title).trim().slice(0, 120);
    const projectId = body?.projectId === undefined ? undefined : (body.projectId ? String(body.projectId) : null);

    if (title !== undefined && !title) return Response.json({ error: 'Conversation title is required.' }, { status: 400 });

    const result = await withTransaction(async (client) => {
      const current = await client.query<{ title: string; project_id: string | null }>(
        `select title, project_id from conversations where id = $1 and user_id = $2 for update`,
        [id, user.id],
      );
      if (!current.rows[0]) return { kind: 'not_found' as const };

      const nextProjectId = projectId === undefined ? current.rows[0].project_id : projectId;
      if (nextProjectId) {
        const project = await client.query(
          `select id from projects where id = $1 and user_id = $2 limit 1`,
          [nextProjectId, user.id],
        );
        if (!project.rows[0]) return { kind: 'project_not_found' as const };
      }

      if (nextProjectId !== current.rows[0].project_id) {
        const linked = await client.query<{ workflow_count: string; artifact_count: string; project_memory_count: string }>(
          `select
             (select count(*)::text from workflows where conversation_id = $1 and project_id is not null) as workflow_count,
             (select count(*)::text from artifacts where conversation_id = $1 and project_id is not null) as artifact_count,
             (select count(*)::text from memories where source_conversation_id = $1 and scope = 'project') as project_memory_count`,
          [id],
        );
        const row = linked.rows[0];
        if (Number(row?.workflow_count ?? 0) > 0 || Number(row?.artifact_count ?? 0) > 0 || Number(row?.project_memory_count ?? 0) > 0) {
          return { kind: 'project_locked' as const };
        }
      }

      const updated = await client.query(
        `update conversations
         set title = $1, project_id = $2, updated_at = now()
         where id = $3 and user_id = $4
         returning id, project_id, title, created_at, updated_at`,
        [title ?? current.rows[0].title, nextProjectId, id, user.id],
      );
      return { kind: 'updated' as const, conversation: updated.rows[0] };
    });

    if (result.kind === 'not_found') return Response.json({ error: 'Conversation not found.' }, { status: 404 });
    if (result.kind === 'project_not_found') return Response.json({ error: 'Project not found.' }, { status: 404 });
    if (result.kind === 'project_locked') return Response.json({ error: 'This conversation has project-bound workflows, artifacts, or memories and cannot be moved to another project.' }, { status: 409 });
    return Response.json({ conversation: result.conversation });
  } catch (error) {
    const status = error instanceof Error && error.message === 'UNAUTHENTICATED' ? 401 : 500;
    return Response.json({ error: status === 401 ? 'Sign in required.' : 'Could not update conversation.' }, { status });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId(request);
  try {
    const user = await requireUser();
    const limited = await enforceUserMutationRateLimit(user.id, 'conversation-deletes', requestId, 30);
    if (limited) return limited;
    const { id } = await params;
    const result = await query(
      `delete from conversations where id = $1 and user_id = $2 returning id`,
      [id, user.id],
    );
    if (!result.rows[0]) return Response.json({ error: 'Conversation not found.' }, { status: 404 });
    return Response.json({ ok: true });
  } catch (error) {
    const status = error instanceof Error && error.message === 'UNAUTHENTICATED' ? 401 : 500;
    return Response.json({ error: status === 401 ? 'Sign in required.' : 'Could not delete conversation.' }, { status });
  }
}
