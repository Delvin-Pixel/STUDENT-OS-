import { requireUser } from '@/lib/auth';
import { getRichProjectFileSource } from '@/lib/project-rich-files';

export const runtime = 'nodejs';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  try {
    const user = await requireUser();
    const { id, fileId } = await params;
    const source = await getRichProjectFileSource(user.id, id, fileId);
    if (!source) return Response.json({ error: 'Rich project file not found.' }, { status: 404 });
    return new Response(new Uint8Array(source.data), {
      status: 200,
      headers: {
        'Content-Type': source.media_type,
        'Content-Length': String(source.byte_size),
        'Content-Disposition': `attachment; filename="${source.filename}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    const status = error instanceof Error && error.message === 'UNAUTHENTICATED' ? 401 : 500;
    return Response.json({ error: status === 401 ? 'Sign in required.' : 'Could not load rich project file source.' }, { status });
  }
}
