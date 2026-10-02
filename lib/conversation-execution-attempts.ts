import { query } from '@/lib/db';

export type ExecutionAttemptHistoryCursor = { acquiredAt: string; id: string };

export type ExecutionAttemptHistoryRow = {
  id: string;
  workflow_id: string;
  request_id: string;
  status: string;
  terminal_reason: string | null;
  acquired_at: string;
  heartbeat_at: string;
  completed_at: string | null;
  event_count: string;
};

const MAX_CURSOR_LENGTH = 256;

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;

export function encodeExecutionAttemptCursor(cursor: ExecutionAttemptHistoryCursor) {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

export function decodeExecutionAttemptCursor(value: string | null | undefined): ExecutionAttemptHistoryCursor | null {
  if (!value || value.length > MAX_CURSOR_LENGTH) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Partial<ExecutionAttemptHistoryCursor>;
    if (typeof parsed.acquiredAt !== 'string' || typeof parsed.id !== 'string' || parsed.id.length > 128) return null;
    if (!UUID_RE.test(parsed.id)) return null;
    if (Number.isNaN(new Date(parsed.acquiredAt).getTime())) return null;
    return { acquiredAt: parsed.acquiredAt, id: parsed.id };
  } catch {
    return null;
  }
}

export async function getConversationExecutionAttempts(
  userId: string,
  conversationId: string,
  limit = 50,
  cursor?: ExecutionAttemptHistoryCursor | null,
) {
  const boundedLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
  const owned = await query<{ id: string }>(
    `select id from conversations where id = $1 and user_id = $2 limit 1`,
    [conversationId, userId],
  );
  if (!owned.rows[0]) return null;

  const cursorCondition = cursor
    ? `and (a.acquired_at, a.id) < ($3::timestamptz, $4::uuid)`
    : '';
  const params = cursor
    ? [userId, conversationId, cursor.acquiredAt, cursor.id]
    : [userId, conversationId];
  const rows = await query<ExecutionAttemptHistoryRow>(
    `select a.id, a.workflow_id, a.request_id, a.status, a.terminal_reason, a.acquired_at, a.heartbeat_at, a.completed_at,
            (select count(*)::bigint from workflow_execution_attempt_events e where e.attempt_id = a.id) as event_count
     from workflow_execution_attempts a
     join workflows w on w.id = a.workflow_id
     where a.user_id = $1 and w.user_id = $1 and w.conversation_id = $2
       ${cursorCondition}
     order by a.acquired_at desc, a.id desc
     limit ${boundedLimit + 1}`,
    params,
  );

  const hasMore = rows.rows.length > boundedLimit;
  const attempts = rows.rows.slice(0, boundedLimit).map((row) => ({
    id: row.id,
    workflowId: row.workflow_id,
    requestId: row.request_id,
    status: row.status,
    terminalReason: row.terminal_reason,
    acquiredAt: row.acquired_at,
    heartbeatAt: row.heartbeat_at,
    completedAt: row.completed_at,
    eventCount: Number(row.event_count),
  }));
  const nextCursor = hasMore && attempts.length
    ? encodeExecutionAttemptCursor({ acquiredAt: attempts[attempts.length - 1].acquiredAt, id: attempts[attempts.length - 1].id })
    : null;

  return { conversationId, attempts, nextCursor };
}


export type ExecutionAttemptEventCursor = { sequenceNo: number; id: string };

export function encodeExecutionAttemptEventCursor(cursor: ExecutionAttemptEventCursor) {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

export function decodeExecutionAttemptEventCursor(value: string | null | undefined): ExecutionAttemptEventCursor | null {
  if (!value || value.length > MAX_CURSOR_LENGTH) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Partial<ExecutionAttemptEventCursor>;
    const sequenceNo = Number(parsed.sequenceNo);
    if (!Number.isSafeInteger(sequenceNo) || sequenceNo < 1 || typeof parsed.id !== 'string' || parsed.id.length > 128) return null;
    if (!UUID_RE.test(parsed.id)) return null;
    return { sequenceNo, id: parsed.id };
  } catch {
    return null;
  }
}

export async function getConversationExecutionAttemptDetail(
  userId: string,
  conversationId: string,
  attemptId: string,
  limit = 100,
  cursor?: ExecutionAttemptEventCursor | null,
) {
  const boundedLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
  const attemptResult = await query<{
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

  const cursorCondition = cursor
    ? `and (e.sequence_no, e.id) > ($4::bigint, $5::uuid)`
    : '';
  const params = cursor
    ? [attemptId, userId, conversationId, cursor.sequenceNo, cursor.id]
    : [attemptId, userId, conversationId];
  const events = await query<{ id: string; event_type: string; sequence_no: string; created_at: string }>(
    `select e.id, e.event_type, e.sequence_no, e.created_at
     from workflow_execution_attempt_events e
     where e.attempt_id = $1::uuid and e.user_id = $2
       ${cursorCondition}
     order by e.sequence_no asc, e.id asc
     limit ${boundedLimit + 1}`,
    params,
  );
  const hasMore = events.rows.length > boundedLimit;
  const boundedEvents = events.rows.slice(0, boundedLimit).map((event) => ({
    id: event.id,
    sequenceNo: Number(event.sequence_no),
    type: event.event_type,
    createdAt: event.created_at,
  }));
  const nextCursor = hasMore && boundedEvents.length
    ? encodeExecutionAttemptEventCursor({ sequenceNo: boundedEvents[boundedEvents.length - 1].sequenceNo, id: boundedEvents[boundedEvents.length - 1].id })
    : null;

  return {
    conversationId,
    attempt: {
      id: attemptResult.rows[0].id,
      workflowId: attemptResult.rows[0].workflow_id,
      requestId: attemptResult.rows[0].request_id,
      status: attemptResult.rows[0].status,
      terminalReason: attemptResult.rows[0].terminal_reason,
      acquiredAt: attemptResult.rows[0].acquired_at,
      heartbeatAt: attemptResult.rows[0].heartbeat_at,
      completedAt: attemptResult.rows[0].completed_at,
      events: boundedEvents,
      nextCursor,
    },
  };
}
