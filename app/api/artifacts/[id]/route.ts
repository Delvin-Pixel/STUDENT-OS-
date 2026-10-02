import { requireUser } from '@/lib/auth';
import { deleteArtifact, getArtifact, updateArtifact } from '@/lib/artifacts';
import { getRequestId, jsonResponse, mapBodyError, readJsonBody } from '@/lib/http';
import { enforceUserMutationRateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const artifact = await getArtifact(user.id, id);
    if (!artifact) return Response.json({ error: 'Artifact not found.' }, { status: 404 });
    return Response.json({ artifact });
  } catch (error) {
    const status = error instanceof Error && error.message === 'UNAUTHENTICATED' ? 401 : 500;
    return Response.json({ error: status === 401 ? 'Sign in required.' : 'Could not load artifact.' }, { status });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId(request);
  try {
    const user = await requireUser();
    const limited = await enforceUserMutationRateLimit(user.id, 'artifact-updates', requestId, 40);
    if (limited) return limited;
    const { id } = await params;
    let body: Record<string, unknown>;
    try { body = await readJsonBody<Record<string, unknown>>(request, 2 * 1024 * 1024); }
    catch (error) { return jsonResponse({ error: mapBodyError(error) ?? 'Invalid request.' }, { status: 400, requestId: getRequestId(request) }); }
    const expectedVersion = body?.expectedVersion === undefined ? undefined : Number(body.expectedVersion);
    if (expectedVersion !== undefined && !Number.isInteger(expectedVersion)) return jsonResponse({ error: 'expectedVersion must be an integer.' }, { status: 400, requestId });
    const artifact = await updateArtifact(user.id, user.plan, id, {
      title: body?.title === undefined ? undefined : String(body.title),
      filename: body?.filename === undefined ? undefined : String(body.filename),
      content: body?.content === undefined ? undefined : String(body.content),
      mimeType: body?.mimeType === undefined ? undefined : String(body.mimeType),
      language: body?.language === undefined ? undefined : String(body.language),
      metadata: body?.metadata === undefined ? undefined : (body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata) ? body.metadata as Record<string, unknown> : {}),
      expectedVersion,
    });
    return Response.json({ artifact });
  } catch (error) {
    if (error instanceof Error && error.name === 'ArtifactConflictError' && 'currentVersion' in error) {
      return jsonResponse({ error: error.message, currentVersion: Number(error.currentVersion) }, { status: 409, requestId });
    }
    const message = error instanceof Error ? error.message : '';
    const clientErrors = new Set(['Artifact not found.', 'Artifact title is required.', 'Artifact content is required.']);
    const status = message === 'UNAUTHENTICATED' ? 401 : clientErrors.has(message) ? (message === 'Artifact not found.' ? 404 : 400) : 500;
    return jsonResponse({ error: status === 500 ? 'Could not update artifact.' : message }, { status, requestId });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId(request);
  try {
    const user = await requireUser();
    const limited = await enforceUserMutationRateLimit(user.id, 'artifact-deletes', requestId, 30);
    if (limited) return limited;
    const { id } = await params;
    await deleteArtifact(user.id, id);
    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const status = message === 'UNAUTHENTICATED' ? 401 : message === 'Artifact not found.' ? 404 : 500;
    return jsonResponse({ error: status === 500 ? 'Could not delete artifact.' : message }, { status, requestId });
  }
}
