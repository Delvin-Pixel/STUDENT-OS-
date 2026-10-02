import { requireUser } from '@/lib/auth';
import { getConversationActivity } from '@/lib/conversation-activity';
import { getRequestId, jsonResponse } from '@/lib/http';
import { enforceUserReadRateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId(request);
  try {
    const user = await requireUser();
    const readLimited = await enforceUserReadRateLimit(user.id, 'conversation-activity', requestId, 30);
    if (readLimited) return readLimited;

    const { id } = await params;
    const rawLimit = new URL(request.url).searchParams.get('limit');
    const limit = rawLimit === null ? 50 : Number(rawLimit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      return jsonResponse({ error: 'limit must be an integer between 1 and 100.' }, { status: 400, requestId });
    }

    const cursor = new URL(request.url).searchParams.get('cursor');
    if (cursor && cursor.length > 256) {
      return jsonResponse({ error: 'cursor is invalid.' }, { status: 400, requestId });
    }
    const result = await getConversationActivity(user.id, id, limit, cursor);
    if (!result) return jsonResponse({ error: 'Conversation not found.' }, { status: 404, requestId });
    return jsonResponse(result, { requestId });
  } catch (error) {
    const status = error instanceof Error && error.message === 'UNAUTHENTICATED' ? 401 : 500;
    return jsonResponse({ error: status === 401 ? 'Sign in required.' : 'Could not load conversation activity.' }, { status, requestId });
  }
}
