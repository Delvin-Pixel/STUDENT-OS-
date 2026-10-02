import { requireUser } from '@/lib/auth';
import { getRequestId, jsonResponse } from '@/lib/http';
import { enforceUserMutationRateLimit } from '@/lib/rate-limit';
import { refreshRichProjectFileExtraction, RichProjectFileError } from '@/lib/project-rich-files';

export const runtime = 'nodejs';

export async function POST(request: Request, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  const requestId = getRequestId(request);
  try {
    const user = await requireUser();
    const { id, fileId } = await params;
    const limited = await enforceUserMutationRateLimit(user.id, 'project-rich-extraction', requestId, 12);
    if (limited) return limited;
    const extraction = await refreshRichProjectFileExtraction(user.id, user.plan, id, fileId);
    return jsonResponse({ extraction }, { requestId });
  } catch (error) {
    if (error instanceof RichProjectFileError) {
      const status = error.code === 'RICH_FILE_GATEWAY_UNCONFIGURED' || error.code === 'RICH_FILE_EXTRACTION_FAILED' ? 503 : 400;
      return jsonResponse({ error: error.message }, { status, requestId });
    }
    const status = error instanceof Error && error.message === 'UNAUTHENTICATED'
      ? 401
      : error instanceof Error && error.message === 'Rich project file not found.'
        ? 404
        : 500;
    return jsonResponse({ error: status === 401 ? 'Sign in required.' : status === 404 ? 'Rich project file not found.' : 'Could not extract rich project knowledge.' }, { status, requestId });
  }
}
