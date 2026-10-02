import { query } from '@/lib/db';

type TraceRow = {
  id: string;
  created_at: string;
  kind: 'tool' | 'ai';
  name: string;
  status: string;
  risk?: 'read' | 'write' | 'external' | null;
  attempt?: number | null;
  duration_ms?: number | null;
  blocked_reason?: string | null;
  step_count?: number | null;
  finish_reason?: string | null;
  workflow_id?: string | null;
  execution_attempt_id?: string | null;
};

export async function getConversationActivityTrace(userId: string, conversationId: string, requestId: string) {
  const owned = await query<{ id: string }>(
    `select id from conversations where id = $1 and user_id = $2 limit 1`,
    [conversationId, userId],
  );
  if (!owned.rows[0]) return null;


  const attempt = await query<{
    id: string;
    status: string;
    acquired_at: string;
    heartbeat_at: string;
    completed_at: string | null;
    terminal_reason: string | null;
  }>(
    `select a.id, a.status, a.acquired_at, a.heartbeat_at, a.completed_at, a.terminal_reason
     from workflow_execution_attempts a
     join workflows w on w.id = a.workflow_id
     where a.user_id = $1 and w.user_id = $1 and w.conversation_id = $2 and a.request_id = $3
     order by a.acquired_at desc, a.id desc
     limit 1`,
    [userId, conversationId, requestId],
  );

  const [tools, aiRuns, attemptEvents] = await Promise.all([
    query<TraceRow>(
      `select id, created_at, 'tool'::text as kind, tool_name as name, status, execution_attempt_id,
              risk, attempt, duration_ms, blocked_reason
       from tool_runs
       where conversation_id = $1 and user_id = $2 and request_id = $3
       order by created_at asc, id asc
       limit 50`,
      [conversationId, userId, requestId],
    ),
    query<TraceRow>(
      `select id, created_at, 'ai'::text as kind, model as name, status, execution_attempt_id,
              step_count, finish_reason, duration_ms, workflow_id
       from ai_runs
       where conversation_id = $1 and user_id = $2 and request_id = $3
       order by created_at asc, id asc
       limit 50`,
      [conversationId, userId, requestId],
    ),
    query<{ id: string; event_type: string; sequence_no: string; created_at: string }>(
      `select e.id, e.event_type, e.sequence_no, e.created_at
       from workflow_execution_attempt_events e
       join workflow_execution_attempts a on a.id = e.attempt_id
       join workflows w on w.id = a.workflow_id
       where e.user_id = $1 and w.user_id = $1 and w.conversation_id = $2 and a.request_id = $3
       order by e.sequence_no asc, e.id asc
       limit 50`,
      [userId, conversationId, requestId],
    ),
  ]);

  const events = [...tools.rows, ...aiRuns.rows]
    .sort((a, b) => {
      const time = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return time || a.id.localeCompare(b.id);
    })
    .slice(0, 100)
    .map((item) => ({
      id: item.id,
      kind: item.kind,
      name: item.name,
      status: item.status,
      createdAt: item.created_at,
      risk: item.risk ?? null,
      attempt: item.attempt ?? null,
      durationMs: item.duration_ms ?? null,
      blockedReason: item.blocked_reason ?? null,
      stepCount: item.step_count ?? null,
      finishReason: item.finish_reason ?? null,
      workflowId: item.workflow_id ?? null,
      executionAttemptId: item.execution_attempt_id ?? null,
    }));

  return {
    conversationId,
    requestId,
    attempt: attempt.rows[0]
      ? {
          id: attempt.rows[0].id,
          status: attempt.rows[0].status,
          acquiredAt: attempt.rows[0].acquired_at,
          heartbeatAt: attempt.rows[0].heartbeat_at,
          completedAt: attempt.rows[0].completed_at,
              terminalReason: attempt.rows[0].terminal_reason,
          events: attemptEvents.rows.map((event) => ({
            id: event.id,
            sequenceNo: Number(event.sequence_no),
            type: event.event_type,
            createdAt: event.created_at,
          })),
        }
      : null,
    events,
  };
}
