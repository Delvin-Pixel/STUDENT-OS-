import { query } from '@/lib/db';
import type { PoolClient, QueryResultRow } from 'pg';

export type CheckpointStatus = 'pending' | 'ready' | 'consumed' | 'blocked';

export type AgentCheckpoint = {
  id: string;
  workflow_id: string;
  step_order: number;
  checkpoint_key: string;
  status: CheckpointStatus;
  state: Record<string, unknown>;
  resume_count: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

function clampText(value: unknown, max: number) {
  return String(value ?? '').replace(/\r\n/g, '\n').trim().slice(0, max);
}

function safeState(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

export async function upsertCheckpoint(params: {
  userId: string;
  workflowId: string;
  stepOrder: number;
  checkpointKey: string;
  status?: CheckpointStatus;
  state?: Record<string, unknown>;
  lastError?: string | null;
  client?: PoolClient;
}) {
  const run = <T extends QueryResultRow>(text: string, values: unknown[] = []) => params.client ? params.client.query<T>(text, values) : query<T>(text, values);
  const result = await run<AgentCheckpoint>(
    `insert into workflow_checkpoints (workflow_id, step_order, checkpoint_key, status, state, last_error)
     select $1, $2, $3, $4, $5::jsonb, $6
     where exists (select 1 from workflows where id = $1 and user_id = $7 and status in ('running','verifying'))
     on conflict (workflow_id, checkpoint_key) do update
       set step_order = excluded.step_order,
           status = case when workflow_checkpoints.status in ('consumed','blocked') then workflow_checkpoints.status else excluded.status end,
           state = case when workflow_checkpoints.status = 'consumed' then workflow_checkpoints.state else excluded.state end,
           last_error = case when workflow_checkpoints.status = 'consumed' then workflow_checkpoints.last_error else excluded.last_error end,
           updated_at = now()
     returning id, workflow_id, step_order, checkpoint_key, status, state, resume_count, last_error, created_at, updated_at`,
    [
      params.workflowId,
      params.stepOrder,
      clampText(params.checkpointKey, 120),
      params.status ?? 'ready',
      JSON.stringify(safeState(params.state)),
      params.lastError ? clampText(params.lastError, 1000) : null,
      params.userId,
    ],
  );
  return result.rows[0] ?? null;
}

export async function listCheckpoints(userId: string, workflowId: string) {
  const result = await query<AgentCheckpoint>(
    `select c.id, c.workflow_id, c.step_order, c.checkpoint_key, c.status, c.state, c.resume_count, c.last_error, c.created_at, c.updated_at
     from workflow_checkpoints c
     join workflows w on w.id = c.workflow_id
     where c.workflow_id = $1 and w.user_id = $2
     order by c.step_order asc, c.updated_at desc`,
    [workflowId, userId],
  );
  return result.rows;
}

export async function getNextCheckpoint(userId: string, workflowId: string) {
  const result = await query<AgentCheckpoint>(
    `select c.id, c.workflow_id, c.step_order, c.checkpoint_key, c.status, c.state, c.resume_count, c.last_error, c.created_at, c.updated_at
     from workflow_checkpoints c
     join workflows w on w.id = c.workflow_id
     where c.workflow_id = $1 and w.user_id = $2 and w.status = 'failed' and c.status in ('ready','blocked')
     order by c.step_order desc, c.updated_at desc
     limit 1`,
    [workflowId, userId],
  );
  return result.rows[0] ?? null;
}

export async function consumeCheckpoint(userId: string, checkpointId: string) {
  const result = await query<AgentCheckpoint>(
    `with target as (
       select c.id, c.workflow_id, c.step_order
       from workflow_checkpoints c
       join workflows w on w.id = c.workflow_id
       where c.id = $1 and w.user_id = $2 and c.status = 'ready'
     ),
     consumed as (
       update workflow_checkpoints c
       set status = 'consumed',
           resume_count = c.resume_count + 1,
           updated_at = now()
       from target t
       where c.id = t.id
          or (c.workflow_id = t.workflow_id and c.status = 'ready' and c.step_order <= t.step_order)
       returning c.id
     )
     select c.id, c.workflow_id, c.step_order, c.checkpoint_key, c.status, c.state, c.resume_count, c.last_error, c.created_at, c.updated_at
     from workflow_checkpoints c
     join workflows w on w.id = c.workflow_id
     where c.id = $1 and w.user_id = $2`,
    [checkpointId, userId],
  );
  return result.rows[0] ?? null;
}

export async function blockCheckpoint(userId: string, checkpointId: string, error: string, state: Record<string, unknown> = {}) {
  const result = await query<AgentCheckpoint>(
    `update workflow_checkpoints c
     set status = 'blocked', last_error = $1, state = $2::jsonb, updated_at = now()
     from workflows w
     where c.id = $3 and c.workflow_id = w.id
       and w.user_id = $4
     returning c.id, c.workflow_id, c.step_order, c.checkpoint_key, c.status, c.state, c.resume_count, c.last_error, c.created_at, c.updated_at`,
    [clampText(error, 1000), JSON.stringify(safeState(state)), checkpointId, userId],
  );
  return result.rows[0] ?? null;
}
