import { query } from '@/lib/db';

type ActivityRow = {
  id: string;
  created_at: string;
  request_id: string | null;
  execution_attempt_id?: string | null;
  kind: 'tool' | 'ai' | 'workflow';
  status: string;
  name: string;
  risk?: 'read' | 'write' | 'external' | null;
  attempt?: number | null;
  duration_ms?: number | null;
  blocked_reason?: string | null;
  step_count?: number | null;
  finish_reason?: string | null;
  workflow_id?: string | null;
  step_order?: number | null;
  from_status?: string | null;
  to_status?: string | null;
};

type ActivityCursor = { createdAt: string; id: string };

function encodeCursor(cursor: ActivityCursor) {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

function decodeCursor(value: string | null): ActivityCursor | null {
  if (!value || value.length > 256) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (typeof parsed?.createdAt !== 'string' || typeof parsed?.id !== 'string') return null;
    if (parsed.id.length > 128 || Number.isNaN(new Date(parsed.createdAt).getTime())) return null;
    return { createdAt: parsed.createdAt, id: parsed.id };
  } catch { return null; }
}

export async function getConversationActivity(userId: string, conversationId: string, limit = 50, cursorValue: string | null = null) {
  const bounded = Math.max(1, Math.min(100, Number.isFinite(limit) ? Math.trunc(limit) : 50));
  const cursor = decodeCursor(cursorValue);
  const cursorTime = cursor?.createdAt ?? null;
  const cursorId = cursor?.id ?? null;
  const owned = await query<{ id: string; project_id: string | null }>(
    `select id, project_id from conversations where id = $1 and user_id = $2 limit 1`,
    [conversationId, userId],
  );
  if (!owned.rows[0]) return null;

  const [tools, aiRuns, workflows] = await Promise.all([
    query<ActivityRow>(
      `select id, created_at, request_id, execution_attempt_id, 'tool'::text as kind, status, tool_name as name,
              risk, attempt, duration_ms, blocked_reason
       from tool_runs
       where conversation_id = $1 and user_id = $2
         and ($4::timestamptz is null or created_at < $4::timestamptz or (created_at = $4::timestamptz and id < $5::text))
       order by created_at desc, id desc
       limit $3`,
      [conversationId, userId, bounded + 1, cursorTime, cursorId],
    ),
    query<ActivityRow>(
      `select id, created_at, request_id, execution_attempt_id, 'ai'::text as kind, status, model as name,
              step_count, finish_reason, duration_ms, workflow_id
       from ai_runs
       where conversation_id = $1 and user_id = $2
         and ($4::timestamptz is null or created_at < $4::timestamptz or (created_at = $4::timestamptz and id < $5::text))
       order by created_at desc, id desc
       limit $3`,
      [conversationId, userId, bounded + 1, cursorTime, cursorId],
    ),
    query<ActivityRow>(
      `select e.id, e.created_at, null::text as request_id, 'workflow'::text as kind,
              coalesce(e.to_status, e.event_type) as status, e.event_type as name,
              e.workflow_id, e.step_order, e.from_status, e.to_status
       from workflow_events e
       join workflows w on w.id = e.workflow_id
       where e.user_id = $2 and w.user_id = $2 and w.conversation_id = $1
         and ($4::timestamptz is null or e.created_at < $4::timestamptz or (e.created_at = $4::timestamptz and e.id < $5::text))
       order by e.created_at desc, e.id desc
       limit $3`,
      [conversationId, userId, bounded + 1, cursorTime, cursorId],
    ),
  ]);

  const activity = [...tools.rows, ...aiRuns.rows, ...workflows.rows]
    .sort((a, b) => {
      const time = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      return time || b.id.localeCompare(a.id);
    })
    .slice(0, bounded)
    .map((item) => {
      const base = {
        id: item.id,
        kind: item.kind,
        name: item.name,
        status: item.status,
        createdAt: item.created_at,
        requestId: item.request_id,
      };
      if (item.kind === 'tool') {
        return { ...base, risk: item.risk ?? null, attempt: item.attempt ?? 1, durationMs: item.duration_ms ?? 0, blockedReason: item.blocked_reason ?? null };
      }
      if (item.kind === 'ai') {
        return { ...base, stepCount: item.step_count ?? 0, finishReason: item.finish_reason ?? null, durationMs: item.duration_ms ?? null, workflowId: item.workflow_id ?? null };
      }
      return { ...base, workflowId: item.workflow_id ?? null, stepOrder: item.step_order ?? null, fromStatus: item.from_status ?? null, toStatus: item.to_status ?? null };
    });

  const fetchedRows = tools.rows.length + aiRuns.rows.length + workflows.rows.length;
  const hasMore = fetchedRows > bounded;
  const tail = activity[activity.length - 1];
  const nextCursor = hasMore && tail ? encodeCursor({ createdAt: tail.createdAt, id: tail.id }) : null;
  return { conversationId, projectId: owned.rows[0].project_id, activity, nextCursor };
}
