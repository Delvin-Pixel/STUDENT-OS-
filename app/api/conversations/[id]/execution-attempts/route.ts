import { NextResponse } from 'next/server';
import { getRequestId } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { enforceUserReadRateLimit } from '@/lib/rate-limit';
import { decodeExecutionAttemptCursor, getConversationExecutionAttempts } from '@/lib/conversation-execution-attempts';

const MAX_LIMIT = 100;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId(request);
  try {
    const user = await requireUser();
    const limited = await enforceUserReadRateLimit(user.id, 'execution-attempts', requestId, 30);
    if (limited) return limited;
    const { id: conversationId } = await params;
    const url = new URL(request.url);
    const rawLimit = Number(url.searchParams.get('limit') ?? '50');
    if (!Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > MAX_LIMIT) {
      return NextResponse.json({ error: 'limit must be an integer from 1 to 100.', requestId }, { status: 400, headers: { 'X-Request-Id': requestId } });
    }
    const rawCursor = url.searchParams.get('cursor');
    if (rawCursor && rawCursor.length > 256) {
      return NextResponse.json({ error: 'cursor is too long.', requestId }, { status: 400, headers: { 'X-Request-Id': requestId } });
    }
    const cursor = rawCursor ? decodeExecutionAttemptCursor(rawCursor) : null;
    if (rawCursor && !cursor) {
      return NextResponse.json({ error: 'Invalid cursor.', requestId }, { status: 400, headers: { 'X-Request-Id': requestId } });
    }
    const result = await getConversationExecutionAttempts(user.id, conversationId, rawLimit, cursor);
    if (!result) return NextResponse.json({ error: 'Conversation not found.', requestId }, { status: 404, headers: { 'X-Request-Id': requestId } });
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store', 'X-Request-Id': requestId } });
  } catch (error) {
    const message = error instanceof Error && error.message === 'Unauthorized' ? 'Unauthorized.' : 'Could not load execution attempts.';
    const status = message === 'Unauthorized.' ? 401 : 500;
    return NextResponse.json({ error: message, requestId }, { status, headers: { 'X-Request-Id': requestId } });
  }
}
