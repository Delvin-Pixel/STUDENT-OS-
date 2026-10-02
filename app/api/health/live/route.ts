import { getRequestId, jsonResponse } from '@/lib/http';
import { NEXA_VERSION } from '@/lib/version';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  return jsonResponse(
    { status: 'ok', service: 'nexa', version: NEXA_VERSION },
    { status: 200, headers: { 'Cache-Control': 'no-store' }, requestId: getRequestId(request) },
  );
}
