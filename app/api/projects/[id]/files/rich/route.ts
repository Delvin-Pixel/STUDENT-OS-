import { requireUser } from '@/lib/auth';
import { getRequestId, jsonResponse, mapBodyError, readJsonBody } from '@/lib/http';
import { getIdempotencyKey, hashRequestBody, mapIdempotencyError, withIdempotency } from '@/lib/idempotency';
import { enforceUserMutationRateLimit } from '@/lib/rate-limit';
import { getProjectFile, ProjectFileNameConflictError } from '@/lib/project-files';
import {
  createRichProjectFile,
  getRichProjectFileLimits,
  refreshRichProjectFileExtractionBestEffort,
  RichProjectFileError,
} from '@/lib/project-rich-files';

export const runtime = 'nodejs';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId(request);
  try {
    const user = await requireUser();
    const { id } = await params;
    const limits = getRichProjectFileLimits(user.plan);
    const limited = await enforceUserMutationRateLimit(user.id, 'project-rich-files', requestId, limits.requestsPerMinute);
    if (limited) return limited;

    let body: Record<string, unknown>;
    try {
      const maxJsonBytes = Math.ceil((limits.maxBytesPerFile * 4) / 3) + 96_000;
      body = await readJsonBody<Record<string, unknown>>(request, maxJsonBytes);
    } catch (error) {
      return jsonResponse({ error: mapBodyError(error) ?? 'Invalid rich-file request.' }, { status: 400, requestId });
    }

    const idempotencyKey = getIdempotencyKey(request);
    const result = await withIdempotency(
      { userId: user.id, scope: `project-rich-files:create:${id}`, key: idempotencyKey, requestHash: hashRequestBody(body) },
      async () => {
        const file = await createRichProjectFile({
          userId: user.id,
          plan: user.plan,
          projectId: id,
          filename: String(body.filename ?? ''),
          mediaType: body.mediaType ? String(body.mediaType) : null,
          data: String(body.data ?? ''),
          size: body.size == null ? null : Number(body.size),
        });
        return { status: 201, body: { fileId: file.id } };
      },
    );

    const responseBody = result.result.body as { fileId?: string };
    const fileId = responseBody.fileId ? String(responseBody.fileId) : null;
    if (!fileId) return jsonResponse({ error: 'Could not save rich project file.' }, { status: 500, requestId });
    if (!result.replay) await refreshRichProjectFileExtractionBestEffort(user.id, user.plan, id, fileId);
    const file = await getProjectFile(user.id, id, fileId);
    return jsonResponse({ file: file ? { ...file, content: undefined } : null }, {
      status: result.result.status,
      requestId,
      headers: result.replay ? { 'X-Idempotency-Replayed': 'true' } : undefined,
    });
  } catch (error) {
    const idempotencyMessage = mapIdempotencyError(error);
    if (idempotencyMessage) return jsonResponse({ error: idempotencyMessage }, { status: 409, requestId });
    if (error instanceof ProjectFileNameConflictError) return jsonResponse({ error: error.message }, { status: 409, requestId });
    if (error instanceof RichProjectFileError) {
      const status = error.code === 'RICH_PROJECT_STORAGE_FULL' ? 409 : 400;
      return jsonResponse({ error: error.message }, { status, requestId });
    }
    const status = error instanceof Error && error.message === 'UNAUTHENTICATED'
      ? 401
      : error instanceof Error && error.message === 'Project not found.'
        ? 404
        : 400;
    return jsonResponse({ error: status === 401 ? 'Sign in required.' : error instanceof Error ? error.message : 'Could not save rich project file.' }, { status, requestId });
  }
}
