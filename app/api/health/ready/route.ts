import { getReadiness } from '@/lib/health';
import { getRequestId, jsonResponse } from '@/lib/http';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const status = await getReadiness();
  return jsonResponse(status, {
    status: status.status === 'ok' ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
    requestId: getRequestId(request),
  });
}
