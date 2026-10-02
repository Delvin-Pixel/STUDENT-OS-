import { buildAccountExport, AccountExportLimitError, AccountExportSizeError } from '@/lib/account';
import { requireUser } from '@/lib/auth';
import { getRequestId, jsonResponse } from '@/lib/http';
import { enforceUserMutationRateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  try {
    const user = await requireUser();
    const limited = await enforceUserMutationRateLimit(user.id, 'account-export', requestId, 3);
    if (limited) return limited;
    const payload = await buildAccountExport(user.id);
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="nexa-data-export-${new Date().toISOString().slice(0, 10)}.json"`,
        'Cache-Control': 'no-store',
        'X-Request-Id': requestId,
      },
    });
  } catch (error) {
    if (error instanceof AccountExportLimitError || error instanceof AccountExportSizeError) {
      return jsonResponse({ error: 'Your account export exceeds the supported one-click size limits. No partial export was returned.' }, { status: 413, requestId });
    }
    const status = error instanceof Error && error.message === 'UNAUTHENTICATED' ? 401 : 500;
    return jsonResponse({ error: status === 401 ? 'Sign in required.' : 'Could not prepare your data export.' }, { status, requestId });
  }
}
