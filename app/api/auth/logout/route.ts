import { getCurrentUser, logoutUser } from '@/lib/auth';
import { getRequestId, jsonResponse } from '@/lib/http';
import { recordSecurityEvent } from '@/lib/audit';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  try {
    const user = await getCurrentUser();
    await logoutUser();
    await recordSecurityEvent({ action: 'logout', userId: user?.id ?? null, requestId });
    return jsonResponse({ ok: true }, { requestId });
  } catch {
    return jsonResponse({ error: 'Could not sign out.' }, { status: 500, requestId });
  }
}
