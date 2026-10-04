import { createNexaProviderAdapter } from '@/lib/nexa-provider-adapter';
import { enforceStudentOsBridgeAdmission, type StudentOsBridgeAdmissionResult } from '@/lib/student-os-bridge-admission';
import {
  claimStudentOsBridgeRequest,
  completeStudentOsBridgeRequest,
  failStudentOsBridgeRequest,
  hashStudentOsBridgeRequest,
  mapStudentOsBridgeIdempotencyError,
  type StudentOsBridgeRequestLease,
} from '@/lib/student-os-bridge-idempotency';
import { NEXA_PROVIDER_CONTRACT_VERSION, type NexaProvider, type NexaProviderRequest, type NexaProviderResult } from '@/lib/nexa-provider';
import { recordStudentOsBridgeEvent, type StudentOsBridgeObservation } from '@/lib/student-os-bridge-observability';
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


function academicContextHeaders(result: unknown): Record<string, string> {
  if (!result || typeof result !== 'object' || Array.isArray(result)) return {};
  const metadata = (result as { metadata?: unknown }).metadata;
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return {};
  const academicContext = (metadata as { academicContext?: unknown }).academicContext;
  if (!academicContext || typeof academicContext !== 'object' || Array.isArray(academicContext)) return {};
  const fingerprint = (academicContext as { fingerprint?: unknown }).fingerprint;
  if (typeof fingerprint !== 'string' || !/^[0-9a-f]{64}$/.test(fingerprint)) return {};
  return { 'X-NEXA-Academic-Context-SHA256': fingerprint };
}

function admissionLimitHeaders(
  admission: Extract<StudentOsBridgeAdmissionResult, { allowed: false }>,
) {
  return {
    'Retry-After': String(admission.result.retryAfterSeconds),
    'X-RateLimit-Limit': String(admission.result.limit),
    'X-RateLimit-Remaining': String(admission.result.remaining),
    'X-RateLimit-Reset': admission.result.resetAt.toISOString(),
    'X-NEXA-Bridge-Limit-Scope': admission.scope,
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
  const bridgeStartedAt = Date.now();
  let bridgeLease: StudentOsBridgeRequestLease | null = null;
  let bridgeObservationContext: Pick<
    StudentOsBridgeObservation,
    'externalUserId' | 'bridgeRequestId' | 'serverRequestId' | 'capability'
  > | null = null;
  const observeBridge = async (
    eventType: StudentOsBridgeObservation['eventType'],
    httpStatus?: number | null,
    detail?: Pick<StudentOsBridgeObservation, 'limitScope' | 'providerOk'>,
  ) => {
    if (!bridgeObservationContext) return;
    await recordStudentOsBridgeEvent({
      ...bridgeObservationContext,
      eventType,
      httpStatus: httpStatus ?? null,
      durationMs: Date.now() - bridgeStartedAt,
      limitScope: detail?.limitScope ?? null,
      providerOk: detail?.providerOk ?? null,
    });
  };
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

    bridgeObservationContext = {
      externalUserId: envelope.request.userId,
      bridgeRequestId: envelope.request.requestId,
      serverRequestId: requestId,
      capability: envelope.capability,
    };

    const admission = await enforceStudentOsBridgeAdmission(envelope.request.userId);
    if (!admission.allowed) {
      await observeBridge('rate_limited', 429, { limitScope: admission.scope, providerOk: null });
      return jsonResponse(
        { error: 'Student OS bridge request limit reached. Please retry later.' },
        {
          status: 429,
          requestId,
          headers: {
            ...noStoreHeaders(envelope.request.requestId),
            ...admissionLimitHeaders(admission),
          },
        },
      );
    }

    let claim;
    try {
      claim = await claimStudentOsBridgeRequest({
        externalUserId: envelope.request.userId,
        requestId: envelope.request.requestId,
        requestHash: hashStudentOsBridgeRequest(envelope),
        capability: envelope.capability,
        ownerRequestId: requestId,
      });
    } catch (error) {
      const mismatch = mapStudentOsBridgeIdempotencyError(error);
      if (mismatch) {
        await observeBridge('mismatch', 409);
        return jsonResponse(
          { error: mismatch },
          {
            status: 409,
            requestId,
            headers: {
              ...noStoreHeaders(envelope.request.requestId),
              'X-NEXA-Bridge-Idempotency-Status': 'mismatch',
            },
          },
        );
      }
      throw error;
    }

    if (claim.kind === 'in_progress') {
      await observeBridge('in_progress', 409);
      return jsonResponse(
        { error: 'This Student OS bridge request is already being processed.' },
        {
          status: 409,
          requestId,
          headers: {
            ...noStoreHeaders(envelope.request.requestId),
            'Retry-After': String(claim.retryAfterSeconds),
            'X-NEXA-Bridge-Idempotency-Status': 'in-progress',
          },
        },
      );
    }

    if (claim.kind === 'replay') {
      const replayProviderOk = claim.body && typeof claim.body === 'object' && 'ok' in claim.body
        && typeof (claim.body as { ok?: unknown }).ok === 'boolean'
        ? Boolean((claim.body as { ok: boolean }).ok)
        : null;
      await observeBridge('replayed', claim.status, { providerOk: replayProviderOk });
      return jsonResponse(claim.body, {
        status: claim.status,
        requestId,
        headers: {
          ...noStoreHeaders(envelope.request.requestId),
          'X-NEXA-Bridge-Idempotency-Status': claim.terminalStatus,
          'X-NEXA-Bridge-Idempotent-Replayed': 'true',
          ...academicContextHeaders(claim.body),
        },
      });
    }

    bridgeLease = claim.lease;
    await observeBridge(claim.recovered ? 'recovered' : 'claimed');

    const provider = createNexaProviderAdapter({
      userId: envelope.request.userId,
      timeoutMs: getStudentOsBridgeTimeoutMs(process.env.NEXA_STUDENT_OS_BRIDGE_TIMEOUT_MS),
    });
    const result = await executeCapability(
      provider,
      envelope.capability,
      envelope.request as NexaProviderRequest,
    );

    const completed = await completeStudentOsBridgeRequest(bridgeLease, 200, result);
    if (!completed) {
      await observeBridge('ownership_lost', 409, { providerOk: result.ok });
      return jsonResponse(
        { error: 'This Student OS bridge request changed execution owner. Retrying is safe.' },
        {
          status: 409,
          requestId,
          headers: {
            ...noStoreHeaders(envelope.request.requestId),
            'X-NEXA-Bridge-Idempotency-Status': 'ownership-lost',
          },
        },
      );
    }

    await observeBridge('completed', 200, { providerOk: result.ok });
    return jsonResponse(result, {
      status: 200,
      requestId,
      headers: {
        ...noStoreHeaders(envelope.request.requestId),
        'X-NEXA-Bridge-Idempotency-Status': claim.recovered ? 'recovered' : 'completed',
        ...academicContextHeaders(result),
      },
    });
  } catch (error) {
    const bodyError = mapBodyError(error);
    if (bodyError) {
      return jsonResponse(
        { error: bodyError },
        { status: 400, requestId, headers: noStoreHeaders() },
      );
    }

    const failure = { error: 'Student OS bridge request could not be completed.' };
    if (bridgeLease) {
      try {
        await failStudentOsBridgeRequest(bridgeLease, 500, failure);
      } catch {}
    }
    await observeBridge('failed', 500);
    return jsonResponse(
      failure,
      {
        status: 500,
        requestId,
        headers: {
          ...noStoreHeaders(bridgeLease?.requestId),
          ...(bridgeLease ? { 'X-NEXA-Bridge-Idempotency-Status': 'failed' } : {}),
        },
      },
    );
  }
}
