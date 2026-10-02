import { requireUser } from '@/lib/auth';
import { getConversationActivityTrace } from '@/lib/conversation-activity-trace';
import { getRequestId, jsonResponse } from '@/lib/http';
import { enforceUserReadRateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId(request);
  try {
    const user = await requireUser();
    const readLimited = await enforceUserReadRateLimit(user.id, 'conversation-activity-trace', requestId, 20);
    if (readLimited) return readLimited;

    const { id } = await params;
    const rawRequestId = new URL(request.url).searchParams.get('requestId')?.trim() ?? '';
    if (!rawRequestId || rawRequestId.length > 128) {
      return jsonResponse({ error: 'requestId must be between 1 and 128 characters.' }, { status: 400, requestId });
    }

    const result = await getConversationActivityTrace(user.id, id, rawRequestId);
    if (!result) return jsonResponse({ error: 'Conversation not found.' }, { status: 404, requestId });
    return jsonResponse(result, { requestId });
  } catch (error) {
    const status = error instanceof Error && error.message === 'UNAUTHENTICATED' ? 401 : 500;
    return jsonResponse({ error: status === 401 ? 'Sign in required.' : 'Could not load execution trace.' }, { status, requestId });
  }
}
