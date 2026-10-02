import { query, withTransaction } from '@/lib/db';
import type { PoolClient, QueryResultRow } from 'pg';
import { buildWorkflowPlan, detectWorkflowType, shouldCreateWorkflow } from '@/lib/workflow-planner';
import { recordWorkflowEvent } from '@/lib/workflow-events';
import { assertWorkflowExecutionLease, recordWorkflowExecutionAttemptEvent as recordExecutionAttemptEventWithSequence } from '@/lib/workflow-execution-lease';
export { buildWorkflowPlan, detectWorkflowType, shouldCreateWorkflow } from '@/lib/workflow-planner';

export type WorkflowType = 'research' | 'create' | 'build' | 'analyze' | 'plan' | 'general';
export type WorkflowStatus = 'queued' | 'running' | 'verifying' | 'completed' | 'failed' | 'cancelled';
export type WorkflowStepKind = 'understand' | 'research' | 'execute' | 'verify' | 'deliver';
export type WorkflowStepStatus = 'queued' | 'running' | 'completed' | 'failed' | 'skipped' | 'cancelled';

export type Workflow = {
  id: string;
  user_id: string;
  project_id: string | null;
  conversation_id: string | null;
  title: string;
  request: string;
  workflow_type: WorkflowType;
  status: WorkflowStatus;
  plan: Array<{ order: number; title: string; kind: WorkflowStepKind }>;
  result_summary: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  steps?: WorkflowStep[];
};

export type WorkflowStep = {
  id: string;
  workflow_id: string;
  step_order: number;
  title: string;
  kind: WorkflowStepKind;
  status: WorkflowStepStatus;
  tool_names: string[];
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  started_at: string | null;
  completed_at: string | null;
};

const WORKFLOW_ROWS = `
  select id, user_id, project_id, conversation_id, title, request, workflow_type, status,
         plan, result_summary, metadata, created_at, updated_at, completed_at
  from workflows
`;

function normalize(value: unknown, max: number) {
  return String(value ?? '').replace(/\r\n/g, '\n').trim().slice(0, max);
}

function titleFromRequest(request: string) {
  const cleaned = normalize(request, 90).replace(/[.!?]+$/, '');
  return cleaned || 'NEXA workflow';
}

export async function createWorkflow(params: {
  userId: string;
  projectId?: string | null;
  conversationId?: string | null;
  request: string;
  client?: PoolClient;
  returnId?: boolean;
}) {
  const request = normalize(params.request, 8000);
  if (!request) throw new Error('Workflow request is required.');

  const projectId = params.projectId ?? null;
  const conversationId = params.conversationId ?? null;
  const { type, plan } = buildWorkflowPlan(request);

  const create = async (client: PoolClient) => {
    if (projectId) {
      const project = await client.query('select id from projects where id = $1 and user_id = $2 limit 1', [projectId, params.userId]);
      if (!project.rows[0]) throw new Error('Project not found.');
    }

    if (conversationId) {
      const conversation = await client.query<{ id: string; project_id: string | null }>(
        'select id, project_id from conversations where id = $1 and user_id = $2 limit 1',
        [conversationId, params.userId],
      );
      if (!conversation.rows[0]) throw new Error('Conversation not found.');
      if (projectId && conversation.rows[0].project_id !== projectId) throw new Error('Conversation does not belong to that project.');
    }

    const created = await client.query<Pick<Workflow, 'id'>>(
      `insert into workflows (user_id, project_id, conversation_id, title, request, workflow_type, status, plan)
       values ($1, $2, $3, $4, $5, $6, 'queued', $7::jsonb)
       returning id`,
      [params.userId, projectId, conversationId, titleFromRequest(request), request, type, JSON.stringify(plan)],
    );

    for (const step of plan) {
      await client.query(
        `insert into workflow_steps (workflow_id, step_order, title, kind)
         values ($1, $2, $3, $4)`,
        [created.rows[0].id, step.order, step.title, step.kind],
      );
    }
    await recordWorkflowEvent({ userId: params.userId, workflowId: created.rows[0].id, eventType: 'created', toStatus: 'queued', details: { workflowType: type, stepCount: plan.length }, client });
    return created.rows[0].id;
  };

  const id = params.client ? await create(params.client) : await withTransaction(create);
  if (params.returnId) return id;
  return getWorkflow(params.userId, id);
}

export async function getWorkflow(userId: string, id: string, projectId?: string | null) {
  const values: unknown[] = [id, userId];
  const projectClause = projectId === undefined ? '' : ' and project_id is not distinct from $3::uuid';
  if (projectId !== undefined) values.push(projectId);
  const workflowResult = await query<Workflow>(`${WORKFLOW_ROWS} where id = $1 and user_id = $2${projectClause} limit 1`, values);
  const workflow = workflowResult.rows[0];
  if (!workflow) return null;
  const steps = await query<WorkflowStep>(
    `select id, workflow_id, step_order, title, kind, status, tool_names, input, output, started_at, completed_at
     from workflow_steps where workflow_id = $1 order by step_order asc`,
    [id],
  );
  return { ...workflow, steps: steps.rows };
}

export async function listWorkflows(userId: string, options: { projectId?: string | null; conversationId?: string | null; limit?: number } = {}) {
  const conditions = ['user_id = $1'];
  const values: unknown[] = [userId];
  if (options.projectId) {
    values.push(options.projectId);
    conditions.push(`project_id = $${values.length}`);
  }
  if (options.conversationId) {
    values.push(options.conversationId);
    conditions.push(`conversation_id = $${values.length}`);
  }
  const limit = Math.max(1, Math.min(50, options.limit ?? 20));
  const result = await query<Workflow>(`${WORKFLOW_ROWS} where ${conditions.join(' and ')} order by updated_at desc limit ${limit}`, values);
  if (result.rows.length === 0) return [];
  const ids = result.rows.map((workflow) => workflow.id);
  const steps = await query<WorkflowStep>(
    `select id, workflow_id, step_order, title, kind, status, tool_names, input, output, started_at, completed_at
     from workflow_steps where workflow_id = any($1::uuid[]) order by workflow_id, step_order asc`,
    [ids],
  );
  const byWorkflow = new Map<string, WorkflowStep[]>();
  for (const step of steps.rows) {
    const list = byWorkflow.get(step.workflow_id) ?? [];
    list.push(step);
    byWorkflow.set(step.workflow_id, list);
  }
  return result.rows.map((workflow) => ({ ...workflow, steps: byWorkflow.get(workflow.id) ?? [] }));
}

export async function startWorkflow(userId: string, workflowId: string, client?: PoolClient) {
  const start = async (tx: PoolClient) => {
    const result = await tx.query(
      `update workflows
       set status = 'running', updated_at = now()
       where id = $1 and user_id = $2 and status = 'queued'
       returning id`,
      [workflowId, userId],
    );
    if (!result.rows[0]) return false;
    await tx.query(
      `update workflow_steps
       set status = 'running', started_at = coalesce(started_at, now())
       where workflow_id = $1 and step_order = 1`,
      [workflowId],
    );
    await recordWorkflowEvent({ userId, workflowId, eventType: 'started', fromStatus: 'queued', toStatus: 'running', stepOrder: 1, client: tx });
    return true;
  };
  return client ? start(client) : withTransaction(start);
}

export async function setStepStatus(
  userId: string,
  workflowId: string,
  order: number,
  status: WorkflowStepStatus,
  output?: Record<string, unknown>,
  toolNames?: string[],
  client?: PoolClient,
  executionLease?: { userId: string; workflowId: string; requestId: string; attemptId?: string | null },
) {
  const nextOutput = output ?? {};
  const run = <T extends QueryResultRow>(text: string, values: unknown[] = []) => client ? client.query<T>(text, values) : query<T>(text, values);
  if (client && executionLease) {
    const owned = await assertWorkflowExecutionLease(client, executionLease);
    if (!owned) return false;
  }
  await run(
    `update workflow_steps
     set status = $1,
         output = case when $2::jsonb = '{}'::jsonb then output else $2::jsonb end,
         tool_names = case when $3::text[] = '{}'::text[] then tool_names else $3::text[] end,
         started_at = case when $1 = 'running' and started_at is null then now() else started_at end,
         completed_at = case when $1 in ('completed','failed','skipped') then now() else completed_at end
     where workflow_id = $4
       and step_order = $5
       and exists (select 1 from workflows where id = $4 and user_id = $6 and status in ('running','verifying'))`,
    [status, JSON.stringify(nextOutput), toolNames ?? [], workflowId, order, userId],
  );
  await run(`update workflows set updated_at = now() where id = $1 and user_id = $2 and status in ('running','verifying')`, [workflowId, userId]);
  return true;
}

export async function advanceWorkflow(userId: string, workflowId: string, currentOrder: number, toolNames: string[]) {
  await setStepStatus(userId, workflowId, currentOrder, 'completed', { toolNames }, toolNames);
  await setStepStatus(userId, workflowId, currentOrder + 1, 'running');
}

export async function resumeWorkflow(userId: string, workflowId: string, stepOrder: number) {
  return withTransaction(async (client) => {
    const result = await client.query(
      `update workflows
       set status = 'running', updated_at = now()
       where id = $1 and user_id = $2 and status = 'failed'
       returning id`,
      [workflowId, userId],
    );
    if (!result.rows[0]) return false;
    await client.query(
      `update workflow_steps
       set status = 'running', started_at = coalesce(started_at, now()), completed_at = null
       where workflow_id = $1 and step_order = $2`,
      [workflowId, stepOrder],
    );
    await recordWorkflowEvent({ userId, workflowId, eventType: 'resumed', fromStatus: 'failed', toStatus: 'running', stepOrder, client });
    return true;
  });
}

export async function beginVerification(userId: string, workflowId: string, executionLease?: { userId: string; workflowId: string; requestId: string; attemptId?: string | null }) {
  return withTransaction(async (client) => {
    if (executionLease && !(await assertWorkflowExecutionLease(client, executionLease))) return false;
    const transition = await client.query(
      `update workflows
       set status = 'verifying', updated_at = now()
       where id = $1 and user_id = $2 and status = 'running'
       returning id`,
      [workflowId, userId],
    );
    if (!transition.rows[0]) return false;
    await recordWorkflowEvent({ userId, workflowId, eventType: 'verifying', fromStatus: 'running', toStatus: 'verifying', client });

    const verifyStep = await client.query<{ step_order: number }>(
      `select step_order from workflow_steps where workflow_id = $1 and kind = 'verify' order by step_order asc limit 1`,
      [workflowId],
    );
    if (verifyStep.rows[0]) {
      await setStepStatus(userId, workflowId, verifyStep.rows[0].step_order, 'running', {}, [], client, executionLease);
    }
    return true;
  });
}

export async function completeWorkflow(userId: string, workflowId: string, resultSummary: string, metadata: Record<string, unknown> = {}, executionLease?: { userId: string; workflowId: string; requestId: string; attemptId?: string | null }) {
  return withTransaction(async (client) => {
    if (executionLease && !(await assertWorkflowExecutionLease(client, executionLease))) return false;
    const current = await client.query(
      `select id from workflows where id = $1 and user_id = $2 and status = 'verifying' for update`,
      [workflowId, userId],
    );
    if (!current.rows[0]) return false;

    const steps = await client.query<WorkflowStep>(
      `select id, workflow_id, step_order, title, kind, status, tool_names, input, output, started_at, completed_at
       from workflow_steps where workflow_id = $1 order by step_order asc`,
      [workflowId],
    );
    const verifyStep = steps.rows.find((step) => step.kind === 'verify');
    const deliverStep = steps.rows.find((step) => step.kind === 'deliver');
    if (verifyStep) await setStepStatus(userId, workflowId, verifyStep.step_order, 'completed', metadata, [], client, executionLease);
    if (deliverStep) await setStepStatus(userId, workflowId, deliverStep.step_order, 'completed', metadata, [], client, executionLease);

    await client.query(
      `update workflows
       set status = 'completed', result_summary = $1, metadata = metadata || $2::jsonb, updated_at = now(), completed_at = now()
       where id = $3 and user_id = $4 and status = 'verifying'`,
      [normalize(resultSummary, 2000), JSON.stringify(metadata), workflowId, userId],
    );
    await recordWorkflowEvent({ userId, workflowId, eventType: 'completed', fromStatus: 'verifying', toStatus: 'completed', details: { resultSummary: normalize(resultSummary, 300) }, client });
    await client.query(
      `update workflow_checkpoints c
       set status = 'consumed', updated_at = now()
       from workflows w
       where c.workflow_id = w.id and w.id = $1 and w.user_id = $2 and c.status in ('ready','blocked')`,
      [workflowId, userId],
    );
    return true;
  });
}

export async function failWorkflow(userId: string, workflowId: string, message: string, executionLease?: { userId: string; workflowId: string; requestId: string; attemptId?: string | null }) {
  await withTransaction(async (client) => {
    if (executionLease && !(await assertWorkflowExecutionLease(client, executionLease))) return;
    const current = await client.query<{ status: WorkflowStatus }>(
      `select status from workflows where id = $1 and user_id = $2 and status in ('queued','running','verifying') for update`,
      [workflowId, userId],
    );
    if (!current.rows[0]) return;
    const fromStatus = current.rows[0].status;
    await client.query(
      `update workflows
       set status = 'failed', result_summary = $1, updated_at = now(), completed_at = now()
       where id = $2 and user_id = $3 and status in ('queued','running','verifying')`,
      [normalize(message, 2000), workflowId, userId],
    );
    await recordWorkflowEvent({ userId, workflowId, eventType: 'failed', fromStatus, toStatus: 'failed', details: { message: normalize(message, 300) }, client });
    await client.query(
      `update workflow_steps
       set status = 'failed', completed_at = now(), output = output || $1::jsonb
       where workflow_id = $2 and status = 'running'`,
      [JSON.stringify({ error: normalize(message, 2000) }), workflowId],
    );
  });
}

export async function cancelWorkflowAttempt(userId: string, workflowId: string, attemptId: string) {
  return withTransaction(async (client) => {
    const workflow = await client.query<{ status: WorkflowStatus }>(
      `select status
       from workflows
       where id = $1 and user_id = $2
       for update`,
      [workflowId, userId],
    );
    if (!workflow.rows[0]) return { ok: false as const, code: 'not_found' as const };

    const attempt = await client.query<{ id: string; status: string; request_id: string }>(
      `select id, status, request_id
       from workflow_execution_attempts
       where id = $1 and workflow_id = $2 and user_id = $3
       for update`,
      [attemptId, workflowId, userId],
    );
    if (!attempt.rows[0]) return { ok: false as const, code: 'not_found' as const };

    if (attempt.rows[0].status === 'cancelled') {
      await client.query(
        `delete from workflow_execution_leases
         where workflow_id = $1 and user_id = $2 and attempt_id = $3`,
        [workflowId, userId, attemptId],
      );
      return { ok: true as const, alreadyCancelled: true as const, requestId: attempt.rows[0].request_id };
    }
    if (attempt.rows[0].status !== 'running') {
      return { ok: false as const, code: 'not_active' as const, status: attempt.rows[0].status };
    }

    const lease = await client.query<{ request_id: string }>(
      `select request_id
       from workflow_execution_leases
       where workflow_id = $1 and user_id = $2 and attempt_id = $3
       for update`,
      [workflowId, userId, attemptId],
    );
    if (!lease.rows[0]) return { ok: false as const, code: 'stale_attempt' as const };

    const workflowActive = ['queued', 'running', 'verifying'].includes(workflow.rows[0].status);
    if (workflowActive) {
      const fromStatus = workflow.rows[0].status;
      await client.query(
        `update workflows
         set status = 'cancelled', updated_at = now(), completed_at = now()
         where id = $1 and user_id = $2 and status in ('queued','running','verifying')`,
        [workflowId, userId],
      );
      await client.query(
        `update workflow_steps
         set status = 'cancelled', completed_at = now(), output = output || $1::jsonb
         where workflow_id = $2 and status in ('queued','running')`,
        [JSON.stringify({ cancellation: 'Workflow cancelled by user.' }), workflowId],
      );
      await client.query(
        `update workflow_checkpoints
         set status = 'consumed', updated_at = now()
         where workflow_id = $1 and status in ('ready','blocked')`,
        [workflowId],
      );
      await recordWorkflowEvent({ userId, workflowId, eventType: 'cancelled', fromStatus, toStatus: 'cancelled', details: { attemptId }, client });
    }

    await recordExecutionAttemptEventWithSequence(client, {
      attemptId, workflowId, userId, eventType: 'cancelled', details: { reason: 'Workflow was cancelled by the user.' },
    });
    await client.query(
      `update workflow_execution_attempts
       set status = 'cancelled', terminal_reason = 'Workflow was cancelled by the user.', completed_at = now()
       where id = $1 and workflow_id = $2 and user_id = $3 and status = 'running'`,
      [attemptId, workflowId, userId],
    );
    await client.query(
      `delete from workflow_execution_leases
       where workflow_id = $1 and user_id = $2 and attempt_id = $3`,
      [workflowId, userId, attemptId],
    );
    return { ok: true as const, alreadyCancelled: false as const, requestId: attempt.rows[0].request_id };
  });
}

export async function cancelWorkflow(userId: string, workflowId: string) {
  return withTransaction(async (client) => {
    const current = await client.query<{ status: WorkflowStatus }>(
      `select status from workflows where id = $1 and user_id = $2 and status in ('queued','running','verifying') for update`,
      [workflowId, userId],
    );
    if (!current.rows[0]) return false;
    const fromStatus = current.rows[0].status;
    await client.query(
      `update workflows
       set status = 'cancelled', updated_at = now(), completed_at = now()
       where id = $1 and user_id = $2 and status in ('queued','running','verifying')`,
      [workflowId, userId],
    );
    await client.query(
      `update workflow_steps
       set status = 'cancelled', completed_at = now(), output = output || $1::jsonb
       where workflow_id = $2 and status in ('queued','running')`,
      [JSON.stringify({ cancellation: 'Workflow cancelled by user.' }), workflowId],
    );
    await client.query(
      `update workflow_checkpoints
       set status = 'consumed', updated_at = now()
       where workflow_id = $1 and status in ('ready','blocked')`,
      [workflowId],
    );
    await recordWorkflowEvent({ userId, workflowId, eventType: 'cancelled', fromStatus, toStatus: 'cancelled', client });
    return true;
  });
}

export async function verifyWorkflowResult(userId: string, workflowId: string, responseText: string, toolNames: string[]) {
  const workflow = await getWorkflow(userId, workflowId);
  if (!workflow) return { passed: false, checks: [{ check: 'workflow_exists', passed: false }], warnings: [] as string[] };

  const normalized = workflow.request.toLowerCase();
  const names = new Set(toolNames);
  const checks: Array<{ check: string; passed: boolean; details?: unknown }> = [
    { check: 'final_response_present', passed: Boolean(responseText.trim()) },
    { check: 'workflow_plan_present', passed: workflow.steps.length > 0 },
  ];
  const warnings: string[] = [];

  const researchRequired = workflow.workflow_type === 'research' || /\b(latest|recent|current|sources|evidence|research|look up)\b/.test(normalized);
  if (researchRequired) {
    checks.push({ check: 'live_research_tool_used', passed: names.has('tako_search') });
  }

  const artifactRequired = /\b(document|report|file|artifact|csv|json|code file|save this|deliverable)\b/.test(normalized);
  if (artifactRequired) {
    const artifactCount = await query<{ count: string }>(
      `select count(*)::text as count from artifacts where user_id = $1 and conversation_id = $2`,
      [userId, workflow.conversation_id],
    );
    checks.push({ check: 'deliverable_persisted', passed: Number(artifactCount.rows[0]?.count ?? 0) > 0 });
  }

  if (!names.has('verify_workflow')) warnings.push('The verification tool was not explicitly called by the agent; server-side checks were used instead.');
  return { passed: checks.every((check) => check.passed), checks, warnings };
}
