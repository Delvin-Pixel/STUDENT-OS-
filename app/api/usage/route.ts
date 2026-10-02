import { requireUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { getDailyMessageLimit } from '@/lib/entitlements';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const user = await requireUser();
    const result = await query<{ message_count: number }>(
      `select message_count from usage_daily where user_id = $1 and usage_date = current_date limit 1`,
      [user.id],
    );
    const used = Number(result.rows[0]?.message_count ?? 0);
    const limit = getDailyMessageLimit(user.plan);
    return Response.json({ plan: user.plan, used, limit, remaining: Math.max(0, limit - used) });
  } catch (error) {
    const status = error instanceof Error && error.message === 'UNAUTHENTICATED' ? 401 : 500;
    return Response.json({ error: status === 401 ? 'Sign in required.' : 'Could not load usage.' }, { status });
  }
}
