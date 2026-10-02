import { requireUser } from '@/lib/auth';
import { deleteMemory, updateMemory, type MemoryKind } from '@/lib/memory';
import { getRequestId, jsonResponse, mapBodyError, readJsonBody } from '@/lib/http';
import { enforceUserMutationRateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId(request);
  try {
    const user = await requireUser();
    const limited = await enforceUserMutationRateLimit(user.id, 'memory-updates', requestId, 60);
    if (limited) return limited;
    if (!user.memory_enabled) return Response.json({ error: 'Memory is turned off for this account.' }, { status: 403 });
    const { id } = await params;
    let body: Record<string, unknown>;
    try { body = await readJsonBody<Record<string, unknown>>(request, 32 * 1024); }
    catch (error) { return jsonResponse({ error: mapBodyError(error) ?? 'Invalid request.' }, { status: 400, requestId: getRequestId(request) }); }
    const expectedVersion = body?.expectedVersion === undefined ? undefined : Number(body.expectedVersion);
    if (expectedVersion !== undefined && !Number.isInteger(expectedVersion)) return jsonResponse({ error: 'expectedVersion must be an integer.' }, { status: 400, requestId });
    const memory = await updateMemory(user.id, id, {
      label: body?.label === undefined ? undefined : String(body.label),
      content: body?.content === undefined ? undefined : String(body.content),
      kind: body?.kind === undefined ? undefined : String(body.kind) as MemoryKind,
      importance: body?.importance === undefined ? undefined : Number(body.importance),
      expectedVersion,
    });
    return Response.json({ memory });
  } catch (error) {
    if (error instanceof Error && error.name === 'MemoryConflictError' && 'currentVersion' in error) {
      return jsonResponse({ error: error.message, currentVersion: Number(error.currentVersion) }, { status: 409, requestId });
    }
    const message = error instanceof Error ? error.message : '';
    const clientErrors = new Set(['Memory not found.', 'Memory content is required.', 'Unsupported memory kind.', 'Memory importance must be a number.']);
    const status = message === 'UNAUTHENTICATED' ? 401 : clientErrors.has(message) ? (message === 'Memory not found.' ? 404 : 400) : 500;
    return jsonResponse({ error: status === 500 ? 'Could not update memory.' : message }, { status, requestId });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId(request);
  try {
    const user = await requireUser();
    const limited = await enforceUserMutationRateLimit(user.id, 'memory-deletes', requestId, 30);
    if (limited) return limited;
    const { id } = await params;
    await deleteMemory(user.id, id);
    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const status = message === 'UNAUTHENTICATED' ? 401 : message === 'Memory not found.' ? 404 : 500;
    return jsonResponse({ error: status === 500 ? 'Could not delete memory.' : message }, { status, requestId });
  }
}
