export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch('https://vzjcvxxfytvoagyqrbhz.supabase.co/rest/v1/', {
      method: 'GET',
      redirect: 'manual',
      cache: 'no-store',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    return Response.json({
      reachable: true,
      httpStatus: response.status,
      enabledLike: [200, 400, 401, 403, 404, 405, 406].includes(response.status),
      latencyMs: Date.now() - started,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json({
      reachable: false,
      httpStatus: null,
      enabledLike: false,
      timeout: error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError'),
      latencyMs: Date.now() - started,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } finally {
    clearTimeout(timer);
  }
}
