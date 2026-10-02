import { requireUser } from '@/lib/auth';
import { getRequestId, jsonResponse, mapBodyError, readJsonBody } from '@/lib/http';
import { getIdempotencyKey, hashRequestBody, mapIdempotencyError, withIdempotency } from '@/lib/idempotency';
import { enforceUserMutationRateLimit } from '@/lib/rate-limit';
import { createProjectFile, listProjectFiles, ProjectFileNameConflictError } from '@/lib/project-files';
import { getProjectFileSemanticStatus, refreshProjectFileSemanticIndexBestEffort } from '@/lib/project-semantic';

export const runtime = 'nodejs';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const files = await listProjectFiles(user.id, id, 100);
    return Response.json({ files });
  } catch (error) {
    const status = error instanceof Error && error.message === 'UNAUTHENTICATED' ? 401 : 500;
    return Response.json({ error: status === 401 ? 'Sign in required.' : 'Could not load project files.' }, { status });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId(request);
  try {
    const user = await requireUser();
    const { id } = await params;
    const limited = await enforceUserMutationRateLimit(user.id, 'project-files', requestId, 30);
    if (limited) return limited;

    let body: Record<string, unknown>;
    try { body = await readJsonBody<Record<string, unknown>>(request, user.plan === 'premium' ? 650_000 : 180_000); }
    catch (error) { return jsonResponse({ error: mapBodyError(error) ?? 'Invalid request.' }, { status: 400, requestId }); }

    const idempotencyKey = getIdempotencyKey(request);
    const result = await withIdempotency(
      { userId: user.id, scope: `project-files:create:${id}`, key: idempotencyKey, requestHash: hashRequestBody(body) },
      async () => {
        const file = await createProjectFile({
          userId: user.id,
          plan: user.plan,
          projectId: id,
          filename: String(body.filename ?? ''),
          mediaType: body.mediaType ? String(body.mediaType) : null,
          content: String(body.content ?? ''),
        });
        return { status: 201, body: { file: { ...file, content: undefined } } };
      },
    );
    const responseBody = result.result.body as { file?: { id?: string } } & Record<string, unknown>;
    const fileId = responseBody.file?.id ? String(responseBody.file.id) : null;
    const semanticIndex = fileId
      ? result.replay
        ? await getProjectFileSemanticStatus(user.id, id, fileId)
        : await refreshProjectFileSemanticIndexBestEffort(user.id, id, fileId)
      : null;
    return jsonResponse({ ...responseBody, semanticIndex }, {
      status: result.result.status,
      requestId,
      headers: result.replay ? { 'X-Idempotency-Replayed': 'true' } : undefined,
    });
  } catch (error) {
    const idempotencyMessage = mapIdempotencyError(error);
    if (idempotencyMessage) return jsonResponse({ error: idempotencyMessage }, { status: 409, requestId });
    if (error instanceof ProjectFileNameConflictError) return jsonResponse({ error: error.message }, { status: 409, requestId });
    const status = error instanceof Error && error.message === 'UNAUTHENTICATED' ? 401 : error instanceof Error && error.message === 'Project not found.' ? 404 : 400;
    return jsonResponse({ error: status === 401 ? 'Sign in required.' : error instanceof Error ? error.message : 'Could not save project file.' }, { status, requestId });
  }
}
