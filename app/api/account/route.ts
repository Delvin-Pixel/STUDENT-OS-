import { cookies } from 'next/headers';
import { deleteAccount, AccountCredentialError } from '@/lib/account';
import { requireUser } from '@/lib/auth';
import { enforceUserMutationRateLimit } from '@/lib/rate-limit';
import { getRequestId, jsonResponse, mapBodyError, readJsonBody } from '@/lib/http';

export const runtime = 'nodejs';

export async function DELETE(request: Request) {
  const requestId = getRequestId(request);
  try {
    const user = await requireUser();
    const limited = await enforceUserMutationRateLimit(user.id, 'account-delete', requestId, 3);
    if (limited) return limited;

    let body: Record<string, unknown>;
    try { body = await readJsonBody<Record<string, unknown>>(request, 16 * 1024); }
    catch (error) { return jsonResponse({ error: mapBodyError(error) ?? 'Invalid request.' }, { status: 400, requestId }); }

    const email = String(body?.email ?? '').trim().toLowerCase();
    const password = String(body?.password ?? '');
    const confirmation = String(body?.confirmation ?? '');
    if (email !== user.email.toLowerCase()) return jsonResponse({ error: 'Enter the email address on this account.' }, { status: 400, requestId });
    if (confirmation !== 'DELETE MY ACCOUNT') return jsonResponse({ error: 'Type DELETE MY ACCOUNT exactly to confirm account deletion.' }, { status: 400, requestId });
    if (!password) return jsonResponse({ error: 'Your current password is required.' }, { status: 400, requestId });

    await deleteAccount({ userId: user.id, email, password, requestId });
    const store = await cookies();
    store.delete('nexa_session');
    return jsonResponse({ deleted: true }, { requestId });
  } catch (error) {
    if (error instanceof AccountCredentialError) return jsonResponse({ error: 'The account confirmation details are incorrect.' }, { status: 403, requestId });
    const status = error instanceof Error && error.message === 'UNAUTHENTICATED' ? 401 : 500;
    return jsonResponse({ error: status === 401 ? 'Sign in required.' : 'Could not delete the account.' }, { status, requestId });
  }
}
