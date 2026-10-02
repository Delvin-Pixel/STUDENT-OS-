import { withTransaction } from '@/lib/db';
import { assertExecutionAttemptCorrelation } from '@/lib/execution-attempt-correlation';

export type AiRunStatus = 'running' | 'completed' | 'failed';

export async function startAiRun(input: {
  userId: string;
  conversationId?: string | null;
  workflowId?: string | null;
  requestId?: string | null;
  executionAttemptId?: string | null;
  model: string;
}) {
  try {
    return await withTransaction(async (client) => {
      await assertExecutionAttemptCorrelation(client, {
        userId: input.userId,
        conversationId: input.conversationId,
        workflowId: input.workflowId,
        executionAttemptId: input.executionAttemptId,
      });
      const result = await client.query<{ id: string }>(
        `insert into ai_runs (user_id, conversation_id, workflow_id, request_id, execution_attempt_id, model, status)
         values ($1, $2, $3, $4, $5, $6, 'running')
         returning id`,
        [input.userId, input.conversationId ?? null, input.workflowId ?? null, input.requestId ?? null, input.executionAttemptId ?? null, input.model],
      );
      return result.rows[0]?.id ?? null;
    });
  } catch {
    return null;
  }
}

export async function finishAiRun(input: {
  id: string | null;
  executionAttemptId?: string | null;
  durationMs: number;
  stepCount: number;
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
  finishReason?: string | null;
}) {
  if (!input.id) return;
  try {
    await withTransaction(async (client) => {
      if (input.executionAttemptId) {
        const attempt = await client.query<{ status: string }>(
          `select status
           from workflow_execution_attempts
           where id = $1
           for update`,
          [input.executionAttemptId],
        );
        if (attempt.rows[0]?.status !== 'running') return;
      }
      await client.query(
        `update ai_runs
         set status = 'completed', duration_ms = $2, step_count = $3,
             input_tokens = $4, output_tokens = $5, total_tokens = $6,
             finish_reason = $7, completed_at = now()
         where id = $1 and status = 'running'
           and ($8::uuid is null or execution_attempt_id = $8::uuid)`,
        [input.id, input.durationMs, input.stepCount, input.inputTokens ?? null, input.outputTokens ?? null, input.totalTokens ?? null, input.finishReason ?? null, input.executionAttemptId ?? null],
      );
    });
  } catch {
    // AI observability must never break a completed response.
  }
}

export async function failAiRun(input: {
  id: string | null;
  executionAttemptId?: string | null;
  durationMs: number;
  stepCount: number;
  errorName?: string | null;
  finishReason?: string | null;
}) {
  if (!input.id) return;
  try {
    await withTransaction(async (client) => {
      if (input.executionAttemptId) {
        const attempt = await client.query<{ status: string }>(
          `select status
           from workflow_execution_attempts
           where id = $1
           for update`,
          [input.executionAttemptId],
        );
        if (attempt.rows[0]?.status !== 'running') return;
      }
      await client.query(
        `update ai_runs
         set status = 'failed', duration_ms = $2, step_count = $3,
             error_name = $4, finish_reason = $5, completed_at = now()
         where id = $1 and status = 'running'
           and ($6::uuid is null or execution_attempt_id = $6::uuid)`,
        [input.id, input.durationMs, input.stepCount, input.errorName ?? null, input.finishReason ?? null, input.executionAttemptId ?? null],
      );
    });
  } catch {
    // AI observability must never break error handling.
  }
}
