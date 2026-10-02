import { withTransaction } from '@/lib/db';

export type ExecutionAttemptTraceKind = 'lifecycle' | 'ai' | 'tool';
export type ExecutionAttemptTraceCursor = { snapshotAt: string; createdAt: string; id: string; kind: ExecutionAttemptTraceKind };

const MAX_CURSOR_LENGTH = 256;
const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
const KIND_RANK: Record<ExecutionAttemptTraceKind, number> = { lifecycle: 0, ai: 1, tool: 2 };

export function encodeExecutionAttemptTraceCursor(cursor: ExecutionAttemptTraceCursor) {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

export function decodeExecutionAttemptTraceCursor(value: string | null | undefined): ExecutionAttemptTraceCursor | null {
  if (!value || value.length > MAX_CURSOR_LENGTH) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Partial<ExecutionAttemptTraceCursor>;
    if (typeof parsed.snapshotAt !== 'string' || Number.isNaN(new Date(parsed.snapshotAt).getTime())) return null;
    if (typeof parsed.createdAt !== 'string' || typeof parsed.id !== 'string' || parsed.id.length > 128) return null;
    if (!UUID_RE.test(parsed.id) || Number.isNaN(new Date(parsed.createdAt).getTime())) return null;
    if (parsed.kind !== 'lifecycle' && parsed.kind !== 'ai' && parsed.kind !== 'tool') return null;
    return { snapshotAt: parsed.snapshotAt, createdAt: parsed.createdAt, id: parsed.id, kind: parsed.kind };
  } catch {
    return null;
  }
}

function cursorCondition(cursor: ExecutionAttemptTraceCursor | null | undefined, rank: number) {
  if (!cursor) return { sql: '', values: [] as string[] };
  return {
    sql: `and (created_at > $5::timestamptz or (created_at = $5::timestamptz and ($6::int < ${rank} or ($6::int = ${rank} and id > $7::uuid))))`,
    values: [cursor.createdAt, String(KIND_RANK[cursor.kind]), cursor.id],
  };
}

export async function getConversationExecutionAttemptTrace(
  userId: string,
  conversationId: string,
  attemptId: string,
  limit = 100,
  cursor?: ExecutionAttemptTraceCursor | null,
) {
  const boundedLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
  return withTransaction(async (client) => {
    await client.query('set transaction isolation level repeatable read');
    await client.query('set transaction read only');

    const snapshotResult = await client.query<{ snapshot_at: string }>('select now() as snapshot_at');
    const snapshotAt = cursor?.snapshotAt ?? snapshotResult.rows[0]?.snapshot_at;
    if (!snapshotAt) return null;

    const attemptResult = await client.query<{
      id: string;
      workflow_id: string;
      request_id: string;
      status: string;
      terminal_reason: string | null;
      acquired_at: string;
      heartbeat_at: string;
      completed_at: string | null;
    }>(
      `select a.id, a.workflow_id, a.request_id, a.status, a.terminal_reason, a.acquired_at, a.heartbeat_at, a.completed_at
       from workflow_execution_attempts a
       join workflows w on w.id = a.workflow_id
       join conversations c on c.id = w.conversation_id
       where a.id = $1::uuid and a.user_id = $2 and w.user_id = $2 and c.id = $3 and c.user_id = $2
       limit 1`,
      [attemptId, userId, conversationId],
    );
    if (!attemptResult.rows[0]) return null;

    const lifecycleCursor = cursorCondition(cursor, KIND_RANK.lifecycle);
    const aiCursor = cursorCondition(cursor, KIND_RANK.ai);
    const toolCursor = cursorCondition(cursor, KIND_RANK.tool);
    const baseParams = [attemptId, userId, conversationId, snapshotAt];

    const [lifecycle, ai, tools] = await Promise.all([
      client.query<{ id: string; event_type: string; sequence_no: string; created_at: string }>(
        `select id, event_type, sequence_no, created_at
         from workflow_execution_attempt_events
         where attempt_id = $1::uuid and user_id = $2 and created_at <= $4::timestamptz
         ${lifecycleCursor.sql}
         order by created_at asc, id asc
         limit ${boundedLimit + 1}`,
        [...baseParams, ...lifecycleCursor.values],
      ),
      client.query<{ id: string; status: string; duration_ms: number | null; step_count: number | null; finish_reason: string | null; created_at: string }>(
        `select id, status, duration_ms, step_count, finish_reason, created_at
         from ai_runs
         where execution_attempt_id = $1::uuid and user_id = $2 and conversation_id = $3 and created_at <= $4::timestamptz
         ${aiCursor.sql}
         order by created_at asc, id asc
         limit ${boundedLimit + 1}`,
        [...baseParams, ...aiCursor.values],
      ),
      client.query<{ id: string; tool_name: string; risk: string; status: string; attempt: number; blocked_reason: string | null; duration_ms: number | null; created_at: string }>(
        `select id, tool_name, risk, status, attempt, blocked_reason, duration_ms, created_at
         from tool_runs
         where execution_attempt_id = $1::uuid and user_id = $2 and conversation_id = $3 and created_at <= $4::timestamptz
         ${toolCursor.sql}
         order by created_at asc, id asc
         limit ${boundedLimit + 1}`,
        [...baseParams, ...toolCursor.values],
      ),
    ]);

    const rows = [
      ...lifecycle.rows.map((row) => ({ id: row.id, kind: 'lifecycle' as const, name: row.event_type, status: 'recorded', createdAt: row.created_at, sequenceNo: Number(row.sequence_no) })),
      ...ai.rows.map((row) => ({ id: row.id, kind: 'ai' as const, name: 'AI run', status: row.status, createdAt: row.created_at, durationMs: row.duration_ms, stepCount: row.step_count, finishReason: row.finish_reason })),
      ...tools.rows.map((row) => ({ id: row.id, kind: 'tool' as const, name: row.tool_name, status: row.status, createdAt: row.created_at, risk: row.risk, attempt: row.attempt, durationMs: row.duration_ms, blockedReason: row.blocked_reason })),
    ].sort((a, b) => {
      const time = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (time) return time;
      const kind = KIND_RANK[a.kind as ExecutionAttemptTraceKind] - KIND_RANK[b.kind as ExecutionAttemptTraceKind];
      return kind || a.id.localeCompare(b.id);
    });

    const hasMore = lifecycle.rows.length + ai.rows.length + tools.rows.length > boundedLimit;
    const boundedRows = rows.slice(0, boundedLimit);
    const last = boundedRows[boundedRows.length - 1];
    const nextCursor = hasMore && last
      ? encodeExecutionAttemptTraceCursor({ snapshotAt, createdAt: last.createdAt, id: last.id, kind: last.kind })
      : null;

    return {
      conversationId,
      snapshotAt,
      attempt: {
        id: attemptResult.rows[0].id,
        workflowId: attemptResult.rows[0].workflow_id,
        requestId: attemptResult.rows[0].request_id,
        status: attemptResult.rows[0].status,
        terminalReason: attemptResult.rows[0].terminal_reason,
        acquiredAt: attemptResult.rows[0].acquired_at,
        heartbeatAt: attemptResult.rows[0].heartbeat_at,
        completedAt: attemptResult.rows[0].completed_at,
      },
      events: boundedRows,
      nextCursor,
    };
  });
}
