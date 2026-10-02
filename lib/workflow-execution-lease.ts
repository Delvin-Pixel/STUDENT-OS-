import { query, withTransaction } from '@/lib/db';
import type { PoolClient } from 'pg';

const DEFAULT_LEASE_MS = 30_000;
const DEFAULT_HEARTBEAT_MS = 5_000;

type LeaseOptions = {
  userId: string;
  workflowId: string;
  requestId: string;
  attemptId: string;
  controller: AbortController;
  leaseMs?: number;
  heartbeatMs?: number;
};

export type WorkflowExecutionLease = {
  stop: () => void;
};

export type WorkflowExecutionAttemptStatus = 'running' | 'completed' | 'failed' | 'cancelled' | 'aborted' | 'lease_lost' | 'recovered';

export type WorkflowExecutionAttemptEventType = Exclude<WorkflowExecutionAttemptStatus, 'running'> | 'acquired';

export async function recordWorkflowExecutionAttemptEvent(client: PoolClient, input: {
  attemptId: string;
  workflowId: string;
  userId: string;
  eventType: WorkflowExecutionAttemptEventType;
  details?: Record<string, unknown>;
}) {
  const attempt = await client.query<{ id: string; status: WorkflowExecutionAttemptStatus }>(
    `select id, status
     from workflow_execution_attempts
     where id = $1 and workflow_id = $2 and user_id = $3
     for update`,
    [input.attemptId, input.workflowId, input.userId],
  );
  if (!attempt.rows[0]) throw new Error('Execution attempt not found.');
  if (attempt.rows[0].status !== 'running') {
    throw new Error('Execution attempt is terminal.');
  }

  const nextSequence = await client.query<{ sequence_no: string }>(
    `select coalesce(max(sequence_no), 0) + 1 as sequence_no
     from workflow_execution_attempt_events
     where attempt_id = $1`,
    [input.attemptId],
  );
  const sequenceNo = Number(nextSequence.rows[0]?.sequence_no ?? 1);
  await client.query(
    `insert into workflow_execution_attempt_events (attempt_id, workflow_id, user_id, event_type, details, sequence_no)
     values ($1, $2, $3, $4, $5::jsonb, $6)`,
    [input.attemptId, input.workflowId, input.userId, input.eventType, JSON.stringify(input.details ?? {}), sequenceNo],
  );
}

function boundedLeaseMs(value: unknown) {
  return Math.max(10_000, Math.min(120_000, Number(value ?? DEFAULT_LEASE_MS)));
}

function boundedHeartbeatMs(value: unknown) {
  return Math.max(1_000, Math.min(30_000, Number(value ?? DEFAULT_HEARTBEAT_MS)));
}

export async function acquireWorkflowExecutionLease(input: {
  userId: string;
  workflowId: string;
  requestId: string;
  leaseMs?: number;
  supersedeRequestId?: string | null;
}) {
  const leaseMs = boundedLeaseMs(input.leaseMs);
  return withTransaction(async (client) => {
    const workflow = await client.query<{ id: string; user_id: string }>(
      `select id, user_id
       from workflows
       where id = $1 and user_id = $2 and status in ('running','verifying')
       for update`,
      [input.workflowId, input.userId],
    );
    if (!workflow.rows[0]) return { acquired: false, attemptId: null };

    const existing = await client.query<{ request_id: string; expires_at: string; attempt_id: string | null }>(
      `select request_id, expires_at, attempt_id
       from workflow_execution_leases
       where workflow_id = $1
       for update`,
      [input.workflowId],
    );
    const current = existing.rows[0];
    const canSupersede = Boolean(
      current
      && input.supersedeRequestId
      && current.request_id === input.supersedeRequestId
      && current.request_id !== input.requestId
    );
    if (current && new Date(current.expires_at).getTime() > Date.now() && current.request_id !== input.requestId && !canSupersede) {
      return { acquired: false, attemptId: null };
    }

    let attemptId: string | null = current?.attempt_id ?? null;
    const sameActiveRequest = Boolean(current && current.request_id === input.requestId && new Date(current.expires_at).getTime() > Date.now());
    if (current?.request_id !== input.requestId && current?.attempt_id) {
      const replacedAttempt = await client.query<{ id: string; workflow_id: string; user_id: string }>(
        `select id, workflow_id, user_id
         from workflow_execution_attempts
         where id = $1 and status = 'running'
         for update`,
        [current.attempt_id],
      );
      if (replacedAttempt.rows[0]) {
        const terminalReason = canSupersede
          ? 'Execution ownership was superseded by recovered chat-turn ownership.'
          : 'Lease expired before ownership was replaced.';
        await recordWorkflowExecutionAttemptEvent(client, {
          attemptId: replacedAttempt.rows[0].id,
          workflowId: replacedAttempt.rows[0].workflow_id,
          userId: replacedAttempt.rows[0].user_id,
          eventType: 'lease_lost',
          details: { reason: terminalReason },
        });
        await client.query(
          `update workflow_execution_attempts
           set status = 'lease_lost', terminal_reason = $2, completed_at = now()
           where id = $1 and status = 'running'`,
          [current.attempt_id, terminalReason],
        );
      }
      attemptId = null;
    }

    if (!attemptId) {
      const existingAttempt = await client.query<{ id: string; status: WorkflowExecutionAttemptStatus }>(
        `select id, status from workflow_execution_attempts where workflow_id = $1 and request_id = $2 for update`,
        [input.workflowId, input.requestId],
      );
      if (existingAttempt.rows[0]) {
        if (existingAttempt.rows[0].status !== 'running') {
          return { acquired: false, attemptId: existingAttempt.rows[0].id, terminalStatus: existingAttempt.rows[0].status };
        }
        attemptId = existingAttempt.rows[0].id;
      } else {
        const created = await client.query<{ id: string }>(
          `insert into workflow_execution_attempts (workflow_id, user_id, request_id, status)
           values ($1, $2, $3, 'running')
           returning id`,
          [input.workflowId, input.userId, input.requestId],
        );
        attemptId = created.rows[0]?.id ?? null;
      }
    } else if (!sameActiveRequest) {
      const currentAttempt = await client.query<{ id: string; status: WorkflowExecutionAttemptStatus }>(
        `select id, status
         from workflow_execution_attempts
         where id = $1 and workflow_id = $2 and user_id = $3
         for update`,
        [attemptId, input.workflowId, input.userId],
      );
      if (!currentAttempt.rows[0]) {
        return { acquired: false, attemptId: null };
      }
      if (currentAttempt.rows[0].status !== 'running') {
        await client.query(
          `delete from workflow_execution_leases
           where workflow_id = $1 and user_id = $2 and request_id = $3 and attempt_id = $4::uuid`,
          [input.workflowId, input.userId, input.requestId, attemptId],
        );
        return { acquired: false, attemptId, terminalStatus: currentAttempt.rows[0].status };
      }
      await client.query(
        `update workflow_execution_attempts
         set acquired_at = clock_timestamp(), heartbeat_at = clock_timestamp(), completed_at = null
         where id = $1 and user_id = $2 and status = 'running'`,
        [attemptId, input.userId],
      );
    }

    if (!attemptId) return { acquired: false, attemptId: null };
    const shouldRecordAcquiredEvent = !sameActiveRequest;
    await client.query(
      `insert into workflow_execution_leases
         (workflow_id, user_id, request_id, attempt_id, acquired_at, heartbeat_at, expires_at)
       values ($1, $2, $3, $4, clock_timestamp(), clock_timestamp(), clock_timestamp() + ($5::int * interval '1 millisecond'))
       on conflict (workflow_id) do update
         set user_id = excluded.user_id,
             request_id = excluded.request_id,
             attempt_id = excluded.attempt_id,
             acquired_at = excluded.acquired_at,
             heartbeat_at = excluded.heartbeat_at,
             expires_at = excluded.expires_at`,
      [input.workflowId, input.userId, input.requestId, attemptId, leaseMs],
    );
    if (shouldRecordAcquiredEvent) {
      await recordWorkflowExecutionAttemptEvent(client, { attemptId, workflowId: input.workflowId, userId: input.userId, eventType: 'acquired', details: { requestId: input.requestId } });
    }
    return { acquired: true, attemptId };
  });
}

export async function renewWorkflowExecutionLease(input: {
  userId: string;
  workflowId: string;
  requestId: string;
  attemptId: string;
  leaseMs?: number;
}) {
  const leaseMs = boundedLeaseMs(input.leaseMs);
  return withTransaction(async (client) => {
    const renewed = await client.query<{ attempt_id: string }>(
      `update workflow_execution_leases
       set heartbeat_at = clock_timestamp(),
           expires_at = clock_timestamp() + ($5::int * interval '1 millisecond')
       where workflow_id = $1
         and user_id = $2
         and request_id = $3
         and attempt_id = $4
         and expires_at > clock_timestamp()
       returning attempt_id`,
      [input.workflowId, input.userId, input.requestId, input.attemptId, leaseMs],
    );
    if (!renewed.rows[0]) return false;
    await client.query(
      `update workflow_execution_attempts
       set heartbeat_at = clock_timestamp()
       where id = $1 and workflow_id = $2 and user_id = $3 and status = 'running'`,
      [input.attemptId, input.workflowId, input.userId],
    );
    return true;
  });
}

export async function assertWorkflowExecutionLease(
  client: PoolClient,
  input: { userId: string; workflowId: string; requestId: string; attemptId?: string | null },
) {
  const result = await client.query(
    `select workflow_id
     from workflow_execution_leases
     where workflow_id = $1
       and user_id = $2
       and request_id = $3
       and ($4::uuid is null or attempt_id = $4::uuid)
       and expires_at > clock_timestamp()
     for update`,
    [input.workflowId, input.userId, input.requestId, input.attemptId ?? null],
  );
  return result.rows.length === 1;
}

export async function finalizeWorkflowExecutionAttempt(input: {
  userId: string;
  workflowId: string;
  requestId: string;
  attemptId: string;
  status: Exclude<WorkflowExecutionAttemptStatus, 'running' | 'recovered'>;
  terminalReason?: string | null;
}) {
  await withTransaction(async (client) => {
    const current = await client.query<{ id: string; status: WorkflowExecutionAttemptStatus }>(
      `select id, status
       from workflow_execution_attempts
       where id = $1 and workflow_id = $2 and user_id = $3 and request_id = $4
       for update`,
      [input.attemptId, input.workflowId, input.userId, input.requestId],
    );
    if (!current.rows[0] || current.rows[0].status !== 'running') return;
    await recordWorkflowExecutionAttemptEvent(client, {
      attemptId: input.attemptId,
      workflowId: input.workflowId,
      userId: input.userId,
      eventType: input.status,
      details: { reason: input.terminalReason ?? null },
    });
    await client.query(
      `update workflow_execution_attempts
       set status = $5,
           terminal_reason = $6,
           completed_at = now()
       where id = $1 and workflow_id = $2 and user_id = $3 and request_id = $4 and status = 'running'`,
      [input.attemptId, input.workflowId, input.userId, input.requestId, input.status, input.terminalReason ?? null],
    );
  });
}

export async function releaseWorkflowExecutionLease(input: {
  userId: string;
  workflowId: string;
  requestId: string;
  attemptId?: string | null;
  status?: Exclude<WorkflowExecutionAttemptStatus, 'running' | 'recovered'>;
  terminalReason?: string | null;
}) {
  await withTransaction(async (client) => {
    if (input.attemptId && input.status) {
      const current = await client.query<{ id: string; status: WorkflowExecutionAttemptStatus }>(
        `select id, status
         from workflow_execution_attempts
         where id = $1 and workflow_id = $2 and user_id = $3 and request_id = $4
         for update`,
        [input.attemptId, input.workflowId, input.userId, input.requestId],
      );
      if (current.rows[0]?.status === 'running') {
        await recordWorkflowExecutionAttemptEvent(client, {
          attemptId: input.attemptId,
          workflowId: input.workflowId,
          userId: input.userId,
          eventType: input.status,
          details: { reason: input.terminalReason ?? null },
        });
        await client.query(
          `update workflow_execution_attempts
           set status = $5,
               terminal_reason = $6,
               completed_at = now()
           where id = $1 and workflow_id = $2 and user_id = $3 and request_id = $4 and status = 'running'`,
          [input.attemptId, input.workflowId, input.userId, input.requestId, input.status, input.terminalReason ?? null],
        );
      }
    }
    await client.query(
      `delete from workflow_execution_leases
       where workflow_id = $1 and user_id = $2 and request_id = $3 and ($4::uuid is null or attempt_id = $4::uuid)`,
      [input.workflowId, input.userId, input.requestId, input.attemptId ?? null],
    );
  });
}

export function startWorkflowExecutionLeaseHeartbeat(input: LeaseOptions): WorkflowExecutionLease {
  let stopped = false;
  const leaseMs = boundedLeaseMs(input.leaseMs);
  const heartbeatMs = boundedHeartbeatMs(input.heartbeatMs);

  const heartbeat = async () => {
    if (stopped || input.controller.signal.aborted) return;
    try {
      const renewed = await renewWorkflowExecutionLease({
        userId: input.userId,
        workflowId: input.workflowId,
        requestId: input.requestId,
        attemptId: input.attemptId,
        leaseMs,
      });
      if (!renewed && !input.controller.signal.aborted) {
        try { await finalizeWorkflowExecutionAttempt({ userId: input.userId, workflowId: input.workflowId, requestId: input.requestId, attemptId: input.attemptId, status: 'lease_lost', terminalReason: 'Execution lease was lost before terminal cleanup.' }); } catch {}
        input.controller.abort('NEXA_WORKFLOW_LEASE_LOST');
      }
    } catch {
      if (!stopped && !input.controller.signal.aborted) {
        try { await finalizeWorkflowExecutionAttempt({ userId: input.userId, workflowId: input.workflowId, requestId: input.requestId, attemptId: input.attemptId, status: 'lease_lost', terminalReason: 'Lease heartbeat failed.' }); } catch {}
        input.controller.abort('NEXA_WORKFLOW_LEASE_LOST');
      }
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
