import { STUDENT_OS_BRIDGE_CONTRACT_VERSION, STUDENT_OS_BRIDGE_SUPPORTED_CONTRACT_VERSIONS, authorizeStudentOsBridge, isConfiguredStudentOsBridgeSecret } from '@/lib/student-os-bridge-core';
import { getStudentOsBridgeOperationalReadiness } from '@/lib/student-os-bridge-readiness';
import { NEXA_PROVIDER_CONTRACT_VERSION } from '@/lib/nexa-provider';
import { NEXA_VERSION } from '@/lib/version';
import { getRequestId, jsonResponse } from '@/lib/http';

export const runtime = 'nodejs';

function headers(input?: Readonly<{
  status?: 'ready' | 'degraded';
  servingMode?: string;
  fallbackContract?: string | null;
  negotiationRequired?: boolean | null;
  legacyDefaultAllowed?: boolean;
}>) {
  return {
    'Cache-Control': 'no-store',
    'X-NEXA-Version': NEXA_VERSION,
    'X-NEXA-Provider-Contract': NEXA_PROVIDER_CONTRACT_VERSION,
    'X-NEXA-Bridge-Contract': STUDENT_OS_BRIDGE_CONTRACT_VERSION,
    'X-NEXA-Bridge-Supported-Contracts': STUDENT_OS_BRIDGE_SUPPORTED_CONTRACT_VERSIONS.join(', '),
    ...(input?.status ? { 'X-NEXA-Bridge-Status': input.status } : {}),
    ...(input?.servingMode ? { 'X-NEXA-Bridge-Serving-Mode': input.servingMode } : {}),
    ...(input?.fallbackContract
      ? { 'X-NEXA-Bridge-Fallback-Contract': input.fallbackContract }
      : {}),
    ...(typeof input?.negotiationRequired === 'boolean'
      ? { 'X-NEXA-Bridge-Negotiation-Required': String(input.negotiationRequired) }
      : {}),
    ...(typeof input?.legacyDefaultAllowed === 'boolean'
      ? { 'X-NEXA-Bridge-Legacy-Default-Allowed': String(input.legacyDefaultAllowed) }
      : {}),
  };
}

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  const configuredSecret = process.env.NEXA_STUDENT_OS_BRIDGE_SECRET ?? '';

  if (!isConfiguredStudentOsBridgeSecret(configuredSecret)) {
    return jsonResponse(
      { error: 'Not found.' },
      { status: 404, requestId, headers: headers() },
    );
  }

  if (!authorizeStudentOsBridge(request.headers.get('authorization'), configuredSecret)) {
    return jsonResponse(
      { error: 'Unauthorized.' },
      { status: 401, requestId, headers: headers() },
    );
  }

  const readiness = await getStudentOsBridgeOperationalReadiness();
  return jsonResponse(readiness, {
    status: readiness.status === 'ready' ? 200 : 503,
    requestId,
    headers: headers({
      status: readiness.status,
      servingMode: readiness.servingMode,
      fallbackContract: readiness.fallback?.contractVersion ?? null,
      negotiationRequired: readiness.bridgeContractNegotiationRequired,
      legacyDefaultAllowed: readiness.legacyBridgeContractDefaultAllowed,
    }),
  });
}
