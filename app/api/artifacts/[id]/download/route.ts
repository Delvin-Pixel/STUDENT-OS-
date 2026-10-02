import { requireUser } from '@/lib/auth';
import { getArtifact } from '@/lib/artifacts';

export const runtime = 'nodejs';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const artifact = await getArtifact(user.id, id);
    if (!artifact) return Response.json({ error: 'Artifact not found.' }, { status: 404 });

    return new Response(artifact.content, {
      headers: {
        'Content-Type': `${artifact.mime_type}; charset=utf-8`,
        'Content-Disposition': `attachment; filename="${artifact.filename.replace(/"/g, '')}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    const status = error instanceof Error && error.message === 'UNAUTHENTICATED' ? 401 : 500;
    return Response.json({ error: status === 401 ? 'Sign in required.' : 'Could not download artifact.' }, { status });
  }
}
