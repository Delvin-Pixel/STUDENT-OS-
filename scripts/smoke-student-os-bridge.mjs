#!/usr/bin/env node
const baseUrl = String(process.argv[2] ?? process.env.NEXA_SMOKE_BASE_URL ?? '').replace(/\/$/, '');
const secret = String(process.env.NEXA_STUDENT_OS_BRIDGE_SECRET ?? '');

if (!baseUrl || !/^https?:\/\//.test(baseUrl)) {
  console.error('Usage: NEXA_STUDENT_OS_BRIDGE_SECRET=... node scripts/smoke-student-os-bridge.mjs https://your-nexa-host');
  process.exit(2);
}
if (secret.trim().length < 32) {
  console.error('NEXA_STUDENT_OS_BRIDGE_SECRET must contain the deployed bridge secret (32+ characters).');
  process.exit(2);
}

const response = await fetch(`${baseUrl}/api/integrations/student-os/health`, {
  headers: { Authorization: `Bearer ${secret.trim()}` },
  cache: 'no-store',
});

const body = await response.json().catch(() => ({ error: 'invalid_json' }));
const expectedCapabilities = ['chat', 'explain', 'tutor', 'generateMaterial', 'generateQuiz', 'coach'];

const commonValid =
  body?.service === 'nexa'
  && body?.integration === 'student-os'
  && body?.providerContractVersion === '1.0'
  && body?.bridgeContractVersion === '1.0'
  && body?.academicDecisionAuthority === 'student-os-learning-intelligence'
  && Array.isArray(body?.capabilities)
  && expectedCapabilities.every((capability, index) => body.capabilities[index] === capability)
  && response.headers.get('x-nexa-provider-contract') === '1.0'
  && response.headers.get('x-nexa-bridge-contract') === '1.0'
  && response.headers.get('x-nexa-version') === body.version
  && response.headers.get('x-nexa-bridge-status') === body.status
  && response.headers.get('x-nexa-bridge-serving-mode') === body.servingMode;

const fullReady =
  response.status === 200
  && body?.status === 'ready'
  && body?.servingMode === 'nexa'
  && body?.fallback === null
  && response.headers.get('x-nexa-bridge-fallback-contract') === null;

const fallbackReady =
  response.status === 503
  && body?.status === 'degraded'
  && body?.servingMode === 'student-os-deterministic'
  && body?.fallback?.contractVersion === '1.0'
  && body?.fallback?.mode === 'student-os-deterministic'
  && body?.fallback?.academicDecisionAuthority === 'student-os-learning-intelligence'
  && typeof body?.fallback?.reason === 'string'
  && typeof body?.fallback?.retryable === 'boolean'
  && response.headers.get('x-nexa-bridge-fallback-contract') === '1.0';

const valid = commonValid && (fullReady || fallbackReady);

console.log(JSON.stringify({
  endpoint: `${baseUrl}/api/integrations/student-os/health`,
  httpStatus: response.status,
  servingMode: body?.servingMode ?? 'unknown',
  readiness: body,
}, null, 2));

if (!valid) process.exit(1);
