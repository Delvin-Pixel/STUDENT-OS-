import { authorizeCapabilityDiagnostics, getCapabilityConfiguration, runCapabilitySmoke } from '@/lib/capability-diagnostics';
import { getRequestId, jsonResponse, mapBodyError, readJsonBody } from '@/lib/http';

export const runtime = 'nodejs';

function authorize(request: Request, requestId: string) {
  const status = authorizeCapabilityDiagnostics(request);
  if (status === 'disabled') return jsonResponse({ error: 'Not found.' }, { status: 404, requestId, headers: { 'Cache-Control': 'no-store' } });
  if (status === 'unauthorized') return jsonResponse({ error: 'Unauthorized.' }, { status: 401, requestId, headers: { 'Cache-Control': 'no-store' } });
  return null;
}

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  const denied = authorize(request, requestId);
  if (denied) return denied;
  return jsonResponse(getCapabilityConfiguration(), { status: 200, requestId, headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  const denied = authorize(request, requestId);
  if (denied) return denied;

  let body: Record<string, unknown>;
  try {
    body = await readJsonBody<Record<string, unknown>>(request, 1_500_000);
  } catch (error) {
    return jsonResponse({ error: mapBodyError(error) ?? 'Invalid diagnostics request.' }, { status: 400, requestId, headers: { 'Cache-Control': 'no-store' } });
  }

  if (body.confirm !== 'run-live-provider-smoke') {
    return jsonResponse({ error: 'Live diagnostics confirmation required.' }, { status: 400, requestId, headers: { 'Cache-Control': 'no-store' } });
  }

  try {
    const result = await runCapabilitySmoke(body);
    return jsonResponse(result, {
      status: result.status === 'ok' ? 200 : 503,
      requestId,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    const status = error instanceof Error && error.message === 'INVALID_CAPABILITY_CHECK' ? 400 : 500;
    return jsonResponse({ error: status === 400 ? 'Invalid capability check.' : 'Capability diagnostics failed.' }, {
      status,
      requestId,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}
