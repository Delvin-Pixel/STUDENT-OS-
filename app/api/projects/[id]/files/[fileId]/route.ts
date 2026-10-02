import { requireUser } from '@/lib/auth';
import { getRequestId, jsonResponse, mapBodyError, readJsonBody } from '@/lib/http';
import { enforceUserMutationRateLimit } from '@/lib/rate-limit';
import { deleteProjectFile, getProjectFile, ProjectFileConflictError, ProjectFileNameConflictError, updateProjectFile } from '@/lib/project-files';
import { refreshProjectFileSemanticIndexBestEffort } from '@/lib/project-semantic';

export const runtime = 'nodejs';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  try {
    const user = await requireUser();
    const { id, fileId } = await params;
    const file = await getProjectFile(user.id, id, fileId);
    if (!file) return Response.json({ error: 'Project file not found.' }, { status: 404 });
    return Response.json({ file });
  } catch (error) {
    const status = error instanceof Error && error.message === 'UNAUTHENTICATED' ? 401 : 500;
    return Response.json({ error: status === 401 ? 'Sign in required.' : 'Could not load project file.' }, { status });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  const requestId = getRequestId(request);
  try {
    const user = await requireUser();
    const { id, fileId } = await params;
    const limited = await enforceUserMutationRateLimit(user.id, 'project-file-updates', requestId, 60);
    if (limited) return limited;
    let body: Record<string, unknown>;
    try { body = await readJsonBody<Record<string, unknown>>(request, user.plan === 'premium' ? 650_000 : 180_000); }
    catch (error) { return jsonResponse({ error: mapBodyError(error) ?? 'Invalid request.' }, { status: 400, requestId }); }

    if (body.filename === undefined && body.mediaType === undefined && body.content === undefined) {
      return jsonResponse({ error: 'Nothing to update.' }, { status: 400, requestId });
    }
    const contentChanged = body.content !== undefined;
    const file = await updateProjectFile(user.id, user.plan, id, fileId, {
      filename: body.filename === undefined ? undefined : String(body.filename),
      mediaType: body.mediaType === undefined ? undefined : String(body.mediaType),
      content: body.content === undefined ? undefined : String(body.content),
      expectedVersion: body.expectedVersion === undefined ? undefined : Number(body.expectedVersion),
    });
    const semanticIndex = contentChanged ? await refreshProjectFileSemanticIndexBestEffort(user.id, id, fileId) : null;
    return jsonResponse({ file, semanticIndex }, { requestId });
  } catch (error) {
    if (error instanceof ProjectFileConflictError) return jsonResponse({ error: error.message, currentVersion: error.currentVersion }, { status: 409, requestId });
    if (error instanceof ProjectFileNameConflictError) return jsonResponse({ error: error.message }, { status: 409, requestId });
    const status = error instanceof Error && error.message === 'UNAUTHENTICATED' ? 401 : error instanceof Error && (error.message === 'Project file not found.' || error.message === 'Project not found.') ? 404 : 400;
    return jsonResponse({ error: status === 401 ? 'Sign in required.' : error instanceof Error ? error.message : 'Could not update project file.' }, { status, requestId });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  const requestId = getRequestId(request);
  try {
    const user = await requireUser();
    const { id, fileId } = await params;
    const limited = await enforceUserMutationRateLimit(user.id, 'project-file-deletes', requestId, 40);
    if (limited) return limited;
    await deleteProjectFile(user.id, id, fileId);
    return jsonResponse({ ok: true }, { requestId });
  } catch (error) {
    const status = error instanceof Error && error.message === 'UNAUTHENTICATED' ? 401 : error instanceof Error && error.message === 'Project file not found.' ? 404 : 500;
    return jsonResponse({ error: status === 401 ? 'Sign in required.' : status === 404 ? 'Project file not found.' : 'Could not delete project file.' }, { status, requestId });
  }
}
