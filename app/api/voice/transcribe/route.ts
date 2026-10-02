import { requireUser } from '@/lib/auth';
import { getRequestId, jsonResponse, mapBodyError, readJsonBody } from '@/lib/http';
import { enforceUserMutationRateLimit } from '@/lib/rate-limit';
import { getVoiceUploadLimits, transcribeVoiceAudio, VoiceAudioError } from '@/lib/voice';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  try {
    const user = await requireUser();
    const limits = getVoiceUploadLimits(user.plan);
    const limited = await enforceUserMutationRateLimit(user.id, 'voice-transcribe', requestId, limits.requestsPerMinute);
    if (limited) return limited;

    let body: Record<string, unknown>;
    try {
      const maxJsonBytes = Math.ceil((limits.maxBytes * 4) / 3) + 32_768;
      body = await readJsonBody<Record<string, unknown>>(request, maxJsonBytes);
    } catch (error) {
      return jsonResponse({ error: mapBodyError(error) ?? 'Invalid voice request.' }, { status: 400, requestId });
    }

    const result = await transcribeVoiceAudio({
      data: String(body.data ?? ''),
      mediaType: String(body.mediaType ?? ''),
      durationMs: body.durationMs == null ? null : Number(body.durationMs),
      source: body.source === 'microphone' || body.source === 'imported' ? body.source : 'unknown',
    }, user.plan);

    return jsonResponse({
      voice: {
        transcript: result.transcript,
        durationMs: result.durationMs,
        language: result.language,
        source: result.source,
      },
    }, { status: 200, requestId });
  } catch (error) {
    if (error instanceof VoiceAudioError) {
      const status = error.code === 'VOICE_GATEWAY_UNCONFIGURED' || error.code === 'VOICE_TRANSCRIPTION_FAILED' ? 503 : 400;
      return jsonResponse({ error: error.message }, { status, requestId });
    }
    const status = error instanceof Error && error.message === 'UNAUTHENTICATED' ? 401 : 500;
    return jsonResponse({ error: status === 401 ? 'Sign in required.' : 'Could not transcribe voice input.' }, { status, requestId });
  }
}
