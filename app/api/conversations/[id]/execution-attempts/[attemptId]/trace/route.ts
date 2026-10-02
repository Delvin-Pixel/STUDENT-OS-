import { decodeExecutionAttemptTraceCursor, getConversationExecutionAttemptTrace } from '@/lib/conversation-execution-attempt-trace';
import { requireUser } from '@/lib/auth';
import { getRequestId, jsonResponse } from '@/lib/http';
import { enforceUserReadRateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
const MAX_LIMIT = 100;
const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;

export async function GET(request: Request, { params }: { params: Promise<{ id: string; attemptId: string }> }) {
  const requestId = getRequestId(request);
  try {
    const user = await requireUser();
    const readLimited = await enforceUserReadRateLimit(user.id, 'conversation-execution-attempt-trace', requestId, 20);
    if (readLimited) return readLimited;

    const { id: conversationId, attemptId } = await params;
    if (!UUID_RE.test(attemptId)) return jsonResponse({ error: 'Invalid execution attempt id.' }, { status: 400, requestId });
    const url = new URL(request.url);
    const rawLimit = Number(url.searchParams.get('limit') ?? '100');
    if (!Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > MAX_LIMIT) {
      return jsonResponse({ error: 'limit must be an integer from 1 to 100.' }, { status: 400, requestId });
    }
    const rawCursor = url.searchParams.get('cursor');
    if (rawCursor && rawCursor.length > 256) return jsonResponse({ error: 'cursor is too long.' }, { status: 400, requestId });
    const cursor = rawCursor ? decodeExecutionAttemptTraceCursor(rawCursor) : null;
    if (rawCursor && !cursor) return jsonResponse({ error: 'Invalid cursor.' }, { status: 400, requestId });

    const result = await getConversationExecutionAttemptTrace(user.id, conversationId, attemptId, rawLimit, cursor);
    if (!result) return jsonResponse({ error: 'Execution attempt not found.' }, { status: 404, requestId });
    return jsonResponse(result, { requestId });
  } catch (error) {
    const status = error instanceof Error && error.message === 'UNAUTHENTICATED' ? 401 : 500;
    return jsonResponse({ error: status === 401 ? 'Sign in required.' : 'Could not load execution attempt trace.' }, { status, requestId });
  }
}
