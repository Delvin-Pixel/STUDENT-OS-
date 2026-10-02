import { withTransaction, query } from '@/lib/db';
import { hashRequestBody, validateIdempotencyKey } from '@/lib/idempotency-core';
import type { PoolClient } from 'pg';

const CHAT_TURN_TTL_SECONDS = 24 * 60 * 60;
const DEFAULT_CHAT_TURN_LEASE_MS = 15_000;
const DEFAULT_CHAT_TURN_HEARTBEAT_MS = 3_000;
const IN_PROGRESS = 'in_progress' as const;
const REPLAY = 'replay' as const;
const CLAIMED = 'claimed' as const;

export type ChatTurnLeaseIdentity = {
  requestId: string;
  attemptId: string;
};

type ChatTurnResumeState = {
  conversationId: string | null;
  workflowId: string | null;
  executionAttemptId: string | null;
  userMessageId: string | null;
};

export class ChatTurnIdempotencyError extends Error {
  code: 'INVALID_KEY' | 'KEY_REUSE_MISMATCH';
  constructor(code: 'INVALID_KEY' | 'KEY_REUSE_MISMATCH') {
    super(code);
    this.name = 'ChatTurnIdempotencyError';
    this.code = code;
  }
}

export type ChatTurnClaim =
  | ({ kind: typeof CLAIMED; turnId: string; attemptId: string; recovered: boolean; previousRequestId: string | null } & ChatTurnResumeState)
  | { kind: typeof IN_PROGRESS; turnId: string }
  | {
      kind: typeof REPLAY;
      turnId: string;
      status: 'completed' | 'failed' | 'aborted';
      conversationId: string | null;
      workflowId: string | null;
      executionAttemptId: string | null;
      assistantMessageId: string | null;
      errorMessage: string | null;
      responseStatus: number | null;
    };

function boundedLeaseMs(value: unknown) {
  return Math.max(10_000, Math.min(120_000, Number(value ?? DEFAULT_CHAT_TURN_LEASE_MS)));
}

function boundedHeartbeatMs(value: unknown) {
  return Math.max(1_000, Math.min(30_000, Number(value ?? DEFAULT_CHAT_TURN_HEARTBEAT_MS)));
}

export function getChatTurnIdempotencyKey(request: Request) {
  const raw = request.headers.get('idempotency-key');
  if (!raw) return null;
  const key = validateIdempotencyKey(raw);
  if (!key) throw new ChatTurnIdempotencyError('INVALID_KEY');
  return key;
}

export function hashChatTurnRequest(body: unknown) {
  return hashRequestBody(body);
}

export async function claimChatTurn(userId: string, key: string, requestHash: string, requestId: string): Promise<ChatTurnClaim> {
  const leaseMs = boundedLeaseMs(undefined);
  return withTransaction(async (client) => {
    await client.query(
      `delete from chat_turns
       where user_id = $1 and idempotency_key = $2 and expires_at <= now()`,
      [userId, key],
    );
    const inserted = await client.query<{
      id: string;
      owner_attempt_id: string;
    }>(
      `insert into chat_turns (
         user_id, idempotency_key, request_hash, status, expires_at,
         owner_request_id, owner_attempt_id, heartbeat_at, lease_expires_at
       )
       values (
         $1, $2, $3, 'running', now() + ($4 * interval '1 second'),
         $5, gen_random_uuid(), clock_timestamp(), clock_timestamp() + ($6::int * interval '1 millisecond')
       )
       on conflict (user_id, idempotency_key) do nothing
       returning id, owner_attempt_id`,
      [userId, key, requestHash, CHAT_TURN_TTL_SECONDS, requestId, leaseMs],
    );
    if (inserted.rows[0]) {
      return {
        kind: CLAIMED,
        turnId: inserted.rows[0].id,
        attemptId: inserted.rows[0].owner_attempt_id,
        recovered: false,
        previousRequestId: null,
        conversationId: null,
        workflowId: null,
        executionAttemptId: null,
        userMessageId: null,
      };
    }

    const result = await client.query<{
      id: string;
      request_hash: string;
      status: 'running' | 'completed' | 'failed' | 'aborted';
      conversation_id: string | null;
      workflow_id: string | null;
      execution_attempt_id: string | null;
      user_message_id: string | null;
      assistant_message_id: string | null;
      error_message: string | null;
      response_status: number | null;
      owner_request_id: string | null;
      owner_attempt_id: string | null;
      lease_expires_at: string | null;
    }>(
      `select id, request_hash, status, conversation_id, workflow_id, execution_attempt_id,
              user_message_id, assistant_message_id, error_message, response_status,
              owner_request_id, owner_attempt_id, lease_expires_at
       from chat_turns
       where user_id = $1 and idempotency_key = $2
       for update`,
      [userId, key],
    );
    const row = result.rows[0];
    if (!row) throw new Error('Chat turn idempotency record could not be created.');
    if (row.request_hash !== requestHash) throw new ChatTurnIdempotencyError('KEY_REUSE_MISMATCH');

    if (row.status === 'running') {
      const leaseIsLive = Boolean(row.owner_attempt_id && row.lease_expires_at && new Date(row.lease_expires_at).getTime() > Date.now());
      if (leaseIsLive) return { kind: IN_PROGRESS, turnId: row.id };

      const recovered = await client.query<{
        owner_attempt_id: string;
        conversation_id: string | null;
        workflow_id: string | null;
        execution_attempt_id: string | null;
        user_message_id: string | null;
      }>(
        `update chat_turns
         set owner_request_id = $3,
             owner_attempt_id = gen_random_uuid(),
             heartbeat_at = clock_timestamp(),
             lease_expires_at = clock_timestamp() + ($4::int * interval '1 millisecond'),
             recovery_count = recovery_count + 1,
             updated_at = now()
         where id = $1 and user_id = $2 and status = 'running'
         returning owner_attempt_id, conversation_id, workflow_id, execution_attempt_id, user_message_id`,
        [row.id, userId, requestId, leaseMs],
      );
      const next = recovered.rows[0];
      if (!next) return { kind: IN_PROGRESS, turnId: row.id };
      return {
        kind: CLAIMED,
        turnId: row.id,
        attemptId: next.owner_attempt_id,
        recovered: true,
        previousRequestId: row.owner_request_id,
        conversationId: next.conversation_id,
        workflowId: next.workflow_id,
        executionAttemptId: next.execution_attempt_id,
        userMessageId: next.user_message_id,
      };
    }

    return {
      kind: REPLAY,
      turnId: row.id,
      status: row.status,
      conversationId: row.conversation_id,
      workflowId: row.workflow_id,
      executionAttemptId: row.execution_attempt_id,
      assistantMessageId: row.assistant_message_id,
      errorMessage: row.error_message,
      responseStatus: row.response_status,
    };
  });
}

export async function assertChatTurnLease(
  client: PoolClient,
  input: { userId: string; turnId: string } & ChatTurnLeaseIdentity,
) {
  const result = await client.query(
    `select id
     from chat_turns
     where id = $1
       and user_id = $2
       and status = 'running'
       and owner_request_id = $3
       and owner_attempt_id = $4::uuid
       and lease_expires_at > clock_timestamp()
     for update`,
    [input.turnId, input.userId, input.requestId, input.attemptId],
  );
  return result.rows.length === 1;
}

export async function renewChatTurnLease(input: {
  userId: string;
  turnId: string;
} & ChatTurnLeaseIdentity & { leaseMs?: number }) {
  const leaseMs = boundedLeaseMs(input.leaseMs);
  const result = await query(
    `update chat_turns
     set heartbeat_at = clock_timestamp(),
         lease_expires_at = clock_timestamp() + ($5::int * interval '1 millisecond'),
         updated_at = now()
     where id = $1
       and user_id = $2
       and status = 'running'
       and owner_request_id = $3
       and owner_attempt_id = $4::uuid
       and lease_expires_at > clock_timestamp()
     returning id`,
    [input.turnId, input.userId, input.requestId, input.attemptId, leaseMs],
  );
  return result.rows.length === 1;
}

export function startChatTurnLeaseHeartbeat(input: {
  userId: string;
  turnId: string;
  requestId: string;
  attemptId: string;
  controller: AbortController;
  leaseMs?: number;
  heartbeatMs?: number;
}) {
  let stopped = false;
  const leaseMs = boundedLeaseMs(input.leaseMs);
  const heartbeatMs = boundedHeartbeatMs(input.heartbeatMs);

  const heartbeat = async () => {
    if (stopped || input.controller.signal.aborted) return;
    try {
      const renewed = await renewChatTurnLease({
        userId: input.userId,
        turnId: input.turnId,
        requestId: input.requestId,
        attemptId: input.attemptId,
        leaseMs,
      });
      if (!renewed && !input.controller.signal.aborted) input.controller.abort('NEXA_CHAT_TURN_LEASE_LOST');
    } catch {
      if (!stopped && !input.controller.signal.aborted) input.controller.abort('NEXA_CHAT_TURN_LEASE_LOST');
    }
  };

  const timer = setInterval(() => void heartbeat(), heartbeatMs);
  return {
    stop: () => {
      stopped = true;
      clearInterval(timer);
    },
  };
}

export async function updateChatTurn(
  userId: string,
  turnId: string,
  lease: ChatTurnLeaseIdentity,
  update: {
    conversationId?: string | null;
    workflowId?: string | null;
    executionAttemptId?: string | null;
    userMessageId?: string | null;
  },
) {
  const result = await query(
    `update chat_turns
     set conversation_id = coalesce($5::uuid, conversation_id),
         workflow_id = coalesce($6::uuid, workflow_id),
         execution_attempt_id = coalesce($7::uuid, execution_attempt_id),
         user_message_id = coalesce($8::uuid, user_message_id),
         updated_at = now()
     where id = $1
       and user_id = $2
       and status = 'running'
       and owner_request_id = $3
       and owner_attempt_id = $4::uuid
       and lease_expires_at > clock_timestamp()
     returning id`,
    [turnId, userId, lease.requestId, lease.attemptId, update.conversationId ?? null, update.workflowId ?? null, update.executionAttemptId ?? null, update.userMessageId ?? null],
  );
  return result.rows.length === 1;
}

export async function consumeChatTurnQuota(input: {
  userId: string;
  turnId: string;
  lease: ChatTurnLeaseIdentity;
  dailyLimit: number;
}) {
  return withTransaction(async (client) => {
    const owned = await assertChatTurnLease(client, { userId: input.userId, turnId: input.turnId, ...input.lease });
    if (!owned) return { owned: false, allowed: false, alreadyCounted: false };
    const turn = await client.query<{ quota_consumed_at: string | null }>(
      `select quota_consumed_at from chat_turns where id = $1 and user_id = $2`,
      [input.turnId, input.userId],
    );
    if (turn.rows[0]?.quota_consumed_at) return { owned: true, allowed: true, alreadyCounted: true };

    const usage = await client.query<{ message_count: number }>(
      `insert into usage_daily (user_id, usage_date, message_count)
       values ($1, current_date, 1)
       on conflict (user_id, usage_date)
       do update set message_count = usage_daily.message_count + 1
       where usage_daily.message_count < $2
       returning message_count`,
      [input.userId, input.dailyLimit],
    );
    if (usage.rows.length === 0) return { owned: true, allowed: false, alreadyCounted: false };
    await client.query(
      `update chat_turns set quota_consumed_at = now(), updated_at = now() where id = $1 and user_id = $2`,
      [input.turnId, input.userId],
    );
    return { owned: true, allowed: true, alreadyCounted: false };
  });
}

export async function initializeChatTurnInput(input: {
  userId: string;
  turnId: string;
  lease: ChatTurnLeaseIdentity;
  conversationId: string | null;
  projectId: string | null;
  title: string;
  content: string;
  metadata: Record<string, unknown>;
}) {
  return withTransaction(async (client) => {
    const owned = await assertChatTurnLease(client, { userId: input.userId, turnId: input.turnId, ...input.lease });
    if (!owned) return null;
    const current = await client.query<{ conversation_id: string | null; user_message_id: string | null }>(
      `select conversation_id, user_message_id from chat_turns where id = $1 and user_id = $2`,
      [input.turnId, input.userId],
    );
    let conversationId = current.rows[0]?.conversation_id ?? input.conversationId;
    let userMessageId = current.rows[0]?.user_message_id ?? null;

    if (!conversationId) {
      const created = await client.query<{ id: string }>(
        `insert into conversations (user_id, project_id, title) values ($1, $2, $3) returning id`,
        [input.userId, input.projectId, input.title],
      );
      conversationId = created.rows[0]?.id ?? null;
    }
    if (!conversationId) throw new Error('Conversation could not be initialized.');

    if (!userMessageId) {
      const inserted = await client.query<{ id: string }>(
        `insert into messages (conversation_id, role, content, metadata)
         values ($1, 'user', $2, $3::jsonb)
         returning id`,
        [conversationId, input.content, JSON.stringify(input.metadata)],
      );
      userMessageId = inserted.rows[0]?.id ?? null;
    }

    await client.query(
      `update chat_turns
       set conversation_id = $3::uuid,
           user_message_id = coalesce($4::uuid, user_message_id),
           updated_at = now()
       where id = $1 and user_id = $2`,
      [input.turnId, input.userId, conversationId, userMessageId],
    );
    await client.query('update conversations set updated_at = now() where id = $1', [conversationId]);
    return { conversationId, userMessageId };
  });
}

export async function completeChatTurn(
  userId: string,
  turnId: string,
  lease: ChatTurnLeaseIdentity,
  assistantMessageId: string | null,
  client?: PoolClient,
) {
  if (!assistantMessageId) {
    if (!client) await failChatTurn(userId, turnId, lease, 'failed', 'NEXA did not produce a response to persist.');
    return false;
  }
  const statement = `update chat_turns
     set status = 'completed', assistant_message_id = $5::uuid,
         error_message = null, response_status = 200, updated_at = now(), completed_at = now(),
         lease_expires_at = clock_timestamp()
     where id = $1
       and user_id = $2
       and status = 'running'
       and owner_request_id = $3
       and owner_attempt_id = $4::uuid
       and lease_expires_at > clock_timestamp()
     returning id`;
  const values = [turnId, userId, lease.requestId, lease.attemptId, assistantMessageId];
  const result = client ? await client.query(statement, values) : await query(statement, values);
  return result.rows.length === 1;
}

export async function failChatTurn(
  userId: string,
  turnId: string,
  lease: ChatTurnLeaseIdentity,
  status: 'failed' | 'aborted',
  errorMessage: string | null,
  responseStatus = status === 'aborted' ? 409 : 500,
) {
  const result = await query(
    `update chat_turns
     set status = $5, error_message = $6, response_status = $7, updated_at = now(), completed_at = now(),
         lease_expires_at = clock_timestamp()
     where id = $1
       and user_id = $2
       and status = 'running'
       and owner_request_id = $3
       and owner_attempt_id = $4::uuid
       and lease_expires_at > clock_timestamp()
     returning id`,
    [turnId, userId, lease.requestId, lease.attemptId, status, errorMessage?.slice(0, 500) ?? null, responseStatus],
  );
  return result.rows.length === 1;
}

export function mapChatTurnIdempotencyError(error: unknown) {
  if (!(error instanceof ChatTurnIdempotencyError)) return null;
  if (error.code === 'INVALID_KEY') return 'Idempotency-Key must be 8–255 characters using letters, numbers, dot, underscore, colon, or hyphen.';
  return 'This Idempotency-Key was already used with a different request.';
}

export async function getReplayAssistantMessage(userId: string, conversationId: string | null, assistantMessageId: string | null) {
  if (!conversationId || !assistantMessageId) return null;
  const result = await query<{ id: string; conversation_id: string; content: string }>(
    `select m.id, m.conversation_id, m.content
     from messages m
     join conversations c on c.id = m.conversation_id
     where m.id = $1 and m.conversation_id = $2 and c.user_id = $3 and m.role = 'assistant'
     limit 1`,
    [assistantMessageId, conversationId, userId],
  );
  return result.rows[0] ?? null;
}
