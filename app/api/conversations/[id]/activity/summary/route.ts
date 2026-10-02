import { requireUser } from '@/lib/auth';
import { getConversationExecutionSummary } from '@/lib/conversation-execution-summary';
import { getRequestId, jsonResponse } from '@/lib/http';
import { enforceUserReadRateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId(request);
  try {
    const user = await requireUser();
    const readLimited = await enforceUserReadRateLimit(user.id, 'conversation-activity-summary', requestId, 30);
    if (readLimited) return readLimited;

    const { id } = await params;
    const result = await getConversationExecutionSummary(user.id, id);
    if (!result) return jsonResponse({ error: 'Conversation not found.' }, { status: 404, requestId });
    return jsonResponse(result, { requestId });
  } catch (error) {
    const status = error instanceof Error && error.message === 'UNAUTHENTICATED' ? 401 : 500;
    return jsonResponse({ error: status === 401 ? 'Sign in required.' : 'Could not load execution summary.' }, { status, requestId });
  }
}
