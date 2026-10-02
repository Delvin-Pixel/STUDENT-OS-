import { query } from '@/lib/db';

type SummaryRow = { count: number };

type ExecutionRow = {
  id: string;
  workflow_id: string;
  status: 'running';
  heartbeat_at: string;
  lease_expires_at: string | null;
  heartbeat_age_ms: string;
  lease_remaining_ms: string | null;
};

export type ExecutionHealth = 'healthy' | 'heartbeat_delayed' | 'lease_expired';

const DEFAULT_HEARTBEAT_GRACE_MS = 15_000;

function heartbeatGraceMs() {
  const raw = process.env.NEXA_EXECUTION_HEARTBEAT_GRACE_MS;
  if (raw === undefined || raw === '') return DEFAULT_HEARTBEAT_GRACE_MS;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 5_000 || value > 60_000) {
    throw new Error('NEXA_EXECUTION_HEARTBEAT_GRACE_MS must be an integer from 5000 to 60000.');
  }
  return value;
}

function healthFor(row: ExecutionRow, graceMs: number): ExecutionHealth {
  if (!row.lease_expires_at || Number(row.lease_remaining_ms ?? 0) <= 0) return 'lease_expired';
  if (Number(row.heartbeat_age_ms) > graceMs) return 'heartbeat_delayed';
  return 'healthy';
}

export async function getConversationExecutionSummary(userId: string, conversationId: string) {
  const owned = await query<{ id: string }>(
    `select id from conversations where id = $1 and user_id = $2 limit 1`,
    [conversationId, userId],
  );
  if (!owned.rows[0]) return null;

  const graceMs = heartbeatGraceMs();
  const [aiRuns, workflows, recentTools, executions] = await Promise.all([
    query<SummaryRow>(
      `select count(*)::int as count
       from ai_runs
       where conversation_id = $1 and user_id = $2 and status = 'running'`,
      [conversationId, userId],
    ),
    query<SummaryRow>(
      `select count(*)::int as count
       from workflows
       where conversation_id = $1 and user_id = $2 and status in ('queued','running','verifying')`,
      [conversationId, userId],
    ),
    query<SummaryRow>(
      `select count(*)::int as count
       from tool_runs
       where conversation_id = $1 and user_id = $2 and created_at >= now() - interval '2 minutes'`,
      [conversationId, userId],
    ),
    query<ExecutionRow>(
      `select a.id,
              a.workflow_id,
              a.status,
              a.heartbeat_at,
              l.expires_at as lease_expires_at,
              greatest(0, extract(epoch from (now() - a.heartbeat_at)) * 1000)::bigint as heartbeat_age_ms,
              case when l.expires_at is null then null
                   else extract(epoch from (l.expires_at - now())) * 1000 end::bigint as lease_remaining_ms
       from workflow_execution_attempts a
       join workflows w on w.id = a.workflow_id
       left join workflow_execution_leases l
         on l.workflow_id = a.workflow_id
        and l.attempt_id = a.id
       where a.user_id = $1
         and w.user_id = $1
         and w.conversation_id = $2
         and a.status = 'running'
       order by a.heartbeat_at asc, a.id asc
       limit 50`,
      [userId, conversationId],
    ),
  ]);

  const activeAiRuns = aiRuns.rows[0]?.count ?? 0;
  const activeWorkflows = workflows.rows[0]?.count ?? 0;
  const recentToolRuns = recentTools.rows[0]?.count ?? 0;
  const liveExecutions = executions.rows.map((row) => ({
    attemptId: row.id,
    workflowId: row.workflow_id,
    status: row.status,
    heartbeatAt: row.heartbeat_at,
    leaseExpiresAt: row.lease_expires_at,
    heartbeatAgeMs: Math.max(0, Number(row.heartbeat_age_ms)),
    leaseRemainingMs: row.lease_remaining_ms == null ? null : Number(row.lease_remaining_ms),
    health: healthFor(row, graceMs),
  }));
  const degradedExecutions = liveExecutions.filter((execution) => execution.health !== 'healthy').length;

  return {
    conversationId,
    activeAiRuns,
    activeWorkflows,
    recentToolRuns,
    working: activeAiRuns > 0 || activeWorkflows > 0,
    heartbeatGraceMs: graceMs,
    liveExecutions,
    degradedExecutions,
    liveness: degradedExecutions > 0 ? 'attention' : liveExecutions.length > 0 ? 'healthy' : 'idle',
  } as const;
}
