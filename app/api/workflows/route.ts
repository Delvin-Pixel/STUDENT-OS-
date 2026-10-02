import { requireUser } from '@/lib/auth';
import { createWorkflow, listWorkflows } from '@/lib/workflows';
import { getRequestId, jsonResponse, mapBodyError, readJsonBody } from '@/lib/http';
import { enforceUserMutationRateLimit } from '@/lib/rate-limit';
import { getIdempotencyKey, hashRequestBody, mapIdempotencyError, withIdempotency } from '@/lib/idempotency';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const params = new URL(request.url).searchParams;
    const workflows = await listWorkflows(user.id, {
      projectId: params.get('projectId'),
      conversationId: params.get('conversationId'),
      limit: Number(params.get('limit') ?? 20),
    });
    return Response.json({ workflows });
  } catch (error) {
    const status = error instanceof Error && error.message === 'UNAUTHENTICATED' ? 401 : 500;
    return Response.json({ error: status === 401 ? 'Sign in required.' : 'Could not load workflows.' }, { status });
  }
}

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  try {
    const user = await requireUser();
    const limited = await enforceUserMutationRateLimit(user.id, 'workflows', requestId, 12);
    if (limited) return limited;
    let body: Record<string, unknown>;
    try { body = await readJsonBody<Record<string, unknown>>(request, 32 * 1024); }
    catch (error) { return jsonResponse({ error: mapBodyError(error) ?? 'Invalid request.' }, { status: 400, requestId: getRequestId(request) }); }
    const projectId = body?.projectId ? String(body.projectId) : null;
    const conversationId = body?.conversationId ? String(body.conversationId) : null;
    const workflowRequest = String(body?.request ?? '');
    const idempotencyKey = getIdempotencyKey(request);
    const result = await withIdempotency(
      { userId: user.id, scope: 'workflows:create', key: idempotencyKey, requestHash: hashRequestBody(body) },
      async (client) => {
        const workflowId = await createWorkflow({
          userId: user.id,
          projectId,
          conversationId,
          request: workflowRequest,
          client,
          returnId: true,
        });
        const workflowResult = await client.query(
          `select id, user_id, project_id, conversation_id, title, request, workflow_type, status,
                  plan, result_summary, metadata, created_at, updated_at, completed_at
           from workflows where id = $1 and user_id = $2 limit 1`,
          [workflowId, user.id],
        );
        const steps = await client.query(
          `select id, workflow_id, step_order, title, kind, status, tool_names, input, output, started_at, completed_at
           from workflow_steps where workflow_id = $1 order by step_order asc`,
          [workflowId],
        );
        return { status: 201, body: { workflow: { ...workflowResult.rows[0], steps: steps.rows } } };
      },
    );
    return jsonResponse(result.result.body, {
      status: result.result.status,
      requestId,
      headers: result.replay ? { 'X-Idempotency-Replayed': 'true' } : undefined,
    });
  } catch (error) {
    const idempotencyMessage = mapIdempotencyError(error);
    if (idempotencyMessage) return jsonResponse({ error: idempotencyMessage }, { status: 409, requestId });
    const message = error instanceof Error ? error.message : '';
    const clientErrors = new Set(['Workflow request is required.', 'Project not found.', 'Conversation not found.', 'Conversation does not belong to that project.']);
    const status = message === 'UNAUTHENTICATED' ? 401 : clientErrors.has(message) ? 400 : 500;
    return jsonResponse({ error: status === 500 ? 'Could not create workflow.' : message }, { status, requestId });
  }
}
