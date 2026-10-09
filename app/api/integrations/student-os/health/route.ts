import { authorizeStudentOsBridge, isConfiguredStudentOsBridgeSecret } from '@/lib/student-os-bridge-core';
import { getStudentOsBridgeOperationalReadiness } from '@/lib/student-os-bridge-readiness';
import { NEXA_PROVIDER_CONTRACT_VERSION } from '@/lib/nexa-provider';
import { NEXA_VERSION } from '@/lib/version';
import { getRequestId, jsonResponse } from '@/lib/http';

export const runtime = 'nodejs';

function headers(status?: 'ready' | 'degraded') {
  return {
    'Cache-Control': 'no-store',
    'X-NEXA-Version': NEXA_VERSION,
    'X-NEXA-Provider-Contract': NEXA_PROVIDER_CONTRACT_VERSION,
    ...(status ? { 'X-NEXA-Bridge-Status': status } : {}),
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
    headers: headers(readiness.status),
  });
}
