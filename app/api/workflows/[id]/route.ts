import { requireUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { cancelWorkflow, cancelWorkflowAttempt, getWorkflow } from '@/lib/workflows';
import { getRequestId } from '@/lib/http';
import { enforceUserMutationRateLimit } from '@/lib/rate-limit';
import { getNextCheckpoint } from '@/lib/agent-checkpoints';
import { listWorkflowEvents } from '@/lib/workflow-events';

export const runtime = 'nodejs';

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const workflow = await getWorkflow(user.id, id);
    if (!workflow) return Response.json({ error: 'Workflow not found.' }, { status: 404 });
    const [resumeCheckpoint, events, lease] = await Promise.all([getNextCheckpoint(user.id, id), listWorkflowEvents(user.id, id, 40), query<{ attempt_id: string | null }>('select attempt_id from workflow_execution_leases where workflow_id = $1 and user_id = $2 limit 1', [id, user.id])]);
    return Response.json({ workflow, resumeCheckpoint, events, executionAttemptId: lease.rows[0]?.attempt_id ?? null });
  } catch (error) {
    const status = error instanceof Error && error.message === 'UNAUTHENTICATED' ? 401 : 500;
    return Response.json({ error: status === 401 ? 'Sign in required.' : 'Could not load workflow.' }, { status });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId(request);
  try {
    const user = await requireUser();
    const limited = await enforceUserMutationRateLimit(user.id, 'workflow-cancels', requestId, 30);
    if (limited) return limited;
    const { id } = await context.params;
    const attemptId = new URL(request.url).searchParams.get('attemptId');
    if (attemptId && !UUID_RE.test(attemptId)) return Response.json({ error: 'Invalid execution attempt id.' }, { status: 400, headers: { 'X-Request-Id': requestId } });
    if (attemptId) {
      const result = await cancelWorkflowAttempt(user.id, id, attemptId);
      if (!result.ok) {
        const status = result.code === 'not_found' ? 404 : 409;
        return Response.json({ error: result.code === 'stale_attempt' ? 'This execution attempt is no longer active.' : 'This execution attempt is not active.' }, { status, headers: { 'X-Request-Id': requestId } });
      }
      return Response.json({ cancelled: true, alreadyCancelled: result.alreadyCancelled, executionAttemptId: attemptId }, { headers: { 'X-Request-Id': requestId, 'X-NEXA-Execution-Attempt-Id': attemptId } });
    }
    const cancelled = await cancelWorkflow(user.id, id);
    if (!cancelled) return Response.json({ error: 'Workflow is not active or was not found.' }, { status: 409 });
    return Response.json({ cancelled: true }, { headers: { 'X-Request-Id': requestId } });
  } catch (error) {
    const status = error instanceof Error && error.message === 'UNAUTHENTICATED' ? 401 : 500;
    return Response.json({ error: status === 401 ? 'Sign in required.' : 'Could not cancel workflow.' }, { status });
  }
}
