import { query } from '@/lib/db';
import type { PoolClient } from 'pg';

export type WorkflowEventType =
  | 'created'
  | 'started'
  | 'resumed'
  | 'verifying'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'step_checkpointed'
  | 'recovered_stale';

export type WorkflowEvent = {
  id: string;
  workflow_id: string;
  user_id: string;
  event_type: WorkflowEventType;
  from_status: string | null;
  to_status: string | null;
  step_order: number | null;
  details: Record<string, unknown>;
  created_at: string;
};

export async function recordWorkflowEvent(params: {
  userId: string;
  workflowId: string;
  eventType: WorkflowEventType;
  fromStatus?: string | null;
  toStatus?: string | null;
  stepOrder?: number | null;
  details?: Record<string, unknown>;
  client?: PoolClient;
}) {
  const values = [
    params.workflowId,
    params.userId,
    params.eventType,
    params.fromStatus ?? null,
    params.toStatus ?? null,
    params.stepOrder ?? null,
    JSON.stringify(params.details ?? {}),
  ];
  const sql = `
    insert into workflow_events (workflow_id, user_id, event_type, from_status, to_status, step_order, details)
    select $1, $2, $3, $4, $5, $6, $7::jsonb
    where exists (select 1 from workflows where id = $1 and user_id = $2)
    returning id, workflow_id, user_id, event_type, from_status, to_status, step_order, details, created_at`;
  const result = params.client
    ? await params.client.query<WorkflowEvent>(sql, values)
    : await query<WorkflowEvent>(sql, values);
  return result.rows[0] ?? null;
}

export async function listWorkflowEvents(userId: string, workflowId: string, limit = 50) {
  const bounded = Math.max(1, Math.min(100, limit));
  const result = await query<WorkflowEvent>(
    `select e.id, e.workflow_id, e.user_id, e.event_type, e.from_status, e.to_status, e.step_order, e.details, e.created_at
     from workflow_events e
     where e.workflow_id = $1 and e.user_id = $2
     order by e.created_at desc
     limit ${bounded}`,
    [workflowId, userId],
  );
  return result.rows;
}
