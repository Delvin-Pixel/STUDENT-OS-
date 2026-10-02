import type { PoolClient } from 'pg';

export class ExecutionAttemptCorrelationError extends Error {
  constructor() {
    super('Execution attempt correlation validation failed.');
    this.name = 'ExecutionAttemptCorrelationError';
  }
}

export async function assertExecutionAttemptCorrelation(
  client: PoolClient,
  input: {
    userId: string;
    conversationId?: string | null;
    workflowId?: string | null;
    executionAttemptId?: string | null;
  },
) {
  if (!input.executionAttemptId) {
    if (input.workflowId !== null && input.workflowId !== undefined) {
      throw new ExecutionAttemptCorrelationError();
    }
    return;
  }

  const result = await client.query<{
    id: string;
    user_id: string;
    workflow_id: string;
    conversation_id: string | null;
    status: 'running' | 'completed' | 'failed' | 'cancelled' | 'aborted' | 'lease_lost' | 'recovered';
  }>(
    `select a.id, a.user_id, a.workflow_id, w.conversation_id, a.status
     from workflow_execution_attempts a
     join workflows w on w.id = a.workflow_id
     where a.id = $1
     for share`,
    [input.executionAttemptId],
  );

  const row = result.rows[0];
  if (!row) throw new ExecutionAttemptCorrelationError();

  const conversationId = input.conversationId ?? null;
  const workflowId = input.workflowId ?? null;
  if (
    row.user_id !== input.userId ||
    row.workflow_id !== workflowId ||
    (row.conversation_id ?? null) !== conversationId ||
    row.status !== 'running'
  ) {
    throw new ExecutionAttemptCorrelationError();
  }
}
