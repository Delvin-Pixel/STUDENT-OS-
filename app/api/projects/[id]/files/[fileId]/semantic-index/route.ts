import { requireUser } from '@/lib/auth';
import { getRequestId, jsonResponse } from '@/lib/http';
import { enforceUserMutationRateLimit } from '@/lib/rate-limit';
import { refreshProjectFileSemanticIndex } from '@/lib/project-semantic';

export const runtime = 'nodejs';

export async function POST(request: Request, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  const requestId = getRequestId(request);
  try {
    const user = await requireUser();
    const { id, fileId } = await params;
    const limited = await enforceUserMutationRateLimit(user.id, 'project-file-semantic-index', requestId, 20);
    if (limited) return limited;
    const semanticIndex = await refreshProjectFileSemanticIndex(user.id, id, fileId);
    return jsonResponse({ semanticIndex }, { requestId });
  } catch (error) {
    const status = error instanceof Error && error.message === 'UNAUTHENTICATED'
      ? 401
      : error instanceof Error && error.message === 'Project file not found.'
        ? 404
        : 500;
    return jsonResponse(
      { error: status === 401 ? 'Sign in required.' : status === 404 ? 'Project file not found.' : 'Could not rebuild the semantic index.' },
      { status, requestId },
    );
  }
}
