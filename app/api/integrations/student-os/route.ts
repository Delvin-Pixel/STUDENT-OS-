import { createNexaProviderAdapter } from '@/lib/nexa-provider-adapter';
import { NEXA_PROVIDER_CONTRACT_VERSION, type NexaProvider, type NexaProviderRequest, type NexaProviderResult } from '@/lib/nexa-provider';
import {
  STUDENT_OS_BRIDGE_MAX_BODY_BYTES,
  authorizeStudentOsBridge,
  getStudentOsBridgeTimeoutMs,
  isConfiguredStudentOsBridgeSecret,
  normalizeStudentOsBridgeUserHeader,
  parseStudentOsBridgeEnvelope,
  type StudentOsBridgeCapability,
} from '@/lib/student-os-bridge-core';
import { getRequestId, jsonResponse, mapBodyError, readJsonBody } from '@/lib/http';
import { NEXA_VERSION } from '@/lib/version';

export const runtime = 'nodejs';

function noStoreHeaders(bridgeRequestId?: string) {
  return {
    'Cache-Control': 'no-store',
    'X-NEXA-Version': NEXA_VERSION,
    'X-NEXA-Provider-Contract': NEXA_PROVIDER_CONTRACT_VERSION,
    ...(bridgeRequestId ? { 'X-NEXA-Bridge-Request-Id': bridgeRequestId } : {}),
  };
}

async function executeCapability(
  provider: NexaProvider,
  capability: StudentOsBridgeCapability,
  request: NexaProviderRequest,
): Promise<NexaProviderResult> {
  switch (capability) {
    case 'chat':
      return provider.chat(request);
    case 'explain':
      return provider.explain(request);
    case 'tutor':
      return provider.tutor(request);
    case 'generateMaterial':
      return provider.generateMaterial(request);
    case 'generateQuiz':
      return provider.generateQuiz(request);
    case 'coach':
      return provider.coach(request);
  }
}

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  const configuredSecret = process.env.NEXA_STUDENT_OS_BRIDGE_SECRET ?? '';

  if (!isConfiguredStudentOsBridgeSecret(configuredSecret)) {
    return jsonResponse(
      { error: 'Student OS bridge is unavailable.' },
      { status: 503, requestId, headers: noStoreHeaders() },
    );
  }

  if (!authorizeStudentOsBridge(request.headers.get('authorization'), configuredSecret)) {
    return jsonResponse(
      { error: 'Unauthorized.' },
      { status: 401, requestId, headers: noStoreHeaders() },
    );
  }

  try {
    const body = await readJsonBody<unknown>(request, STUDENT_OS_BRIDGE_MAX_BODY_BYTES);
    const envelope = parseStudentOsBridgeEnvelope(body);
    const headerUserId = normalizeStudentOsBridgeUserHeader(
      request.headers.get('x-student-os-user-id'),
    );

    if (!envelope || !headerUserId || headerUserId !== envelope.request.userId) {
      return jsonResponse(
        { error: 'Invalid Student OS bridge request.' },
        { status: 400, requestId, headers: noStoreHeaders(envelope?.request.requestId) },
      );
    }

    const provider = createNexaProviderAdapter({
      userId: envelope.request.userId,
      timeoutMs: getStudentOsBridgeTimeoutMs(process.env.NEXA_STUDENT_OS_BRIDGE_TIMEOUT_MS),
    });
    const result = await executeCapability(
      provider,
      envelope.capability,
      envelope.request as NexaProviderRequest,
    );

    return jsonResponse(result, {
      status: 200,
      requestId,
      headers: noStoreHeaders(envelope.request.requestId),
    });
  } catch (error) {
    const bodyError = mapBodyError(error);
    if (bodyError) {
      return jsonResponse(
        { error: bodyError },
        { status: 400, requestId, headers: noStoreHeaders() },
      );
    }

    return jsonResponse(
      { error: 'Student OS bridge request could not be completed.' },
      { status: 500, requestId, headers: noStoreHeaders() },
    );
  }
}
