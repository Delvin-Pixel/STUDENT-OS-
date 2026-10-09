#!/usr/bin/env node
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import ts from 'typescript';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [
  pkgText,
  coreSource,
  readinessSource,
  healthSource,
  bridgeReadinessSource,
  bridgeHealthRouteSource,
  readme,
] = await Promise.all([
  read('package.json'),
  read('lib/ai-gateway-readiness-core.ts'),
  read('lib/ai-gateway-readiness.ts'),
  read('lib/health.ts'),
  read('lib/student-os-bridge-readiness.ts'),
  read('app/api/integrations/student-os/health/route.ts'),
  read('README.md'),
]);
const pkg = JSON.parse(pkgText);

assert.equal(pkg.name, 'nexa-1-66');
assert.equal(pkg.version, '1.66.0');
assert.equal(pkg.scripts['test:ai-gateway-readiness'], 'node scripts/test-ai-gateway-readiness.mjs');
assert.match(pkg.scripts.test, /test:ai-gateway-readiness/);
assert.match(readme, /NEXA 1\.65\.0 — AI Gateway Operational Readiness/);

assert.match(readinessSource, /\/v1\/credits/);
assert.match(readinessSource, /\/v1\/models/);
assert.match(readinessSource, /\/endpoints/);
assert.match(readinessSource, /GATEWAY_READINESS_CACHE_MS = 30_000/);
assert.match(readinessSource, /AbortSignal\.timeout/);
assert.doesNotMatch(readinessSource, /generateText|ToolLoopAgent|streamText|embed\(/);
assert.doesNotMatch(readinessSource, /total_used|totalUsed/);

assert.match(healthSource, /getNexaAiGatewayReadiness/);
assert.match(healthSource, /gateway\.status === 'operational'/);
assert.match(healthSource, /aiGatewayOperational: gateway\.status/);
assert.match(bridgeReadinessSource, /getStudentOsBridgeOperationalReadiness/);
assert.match(bridgeReadinessSource, /aiGatewayOperational/);
assert.match(bridgeHealthRouteSource, /await getStudentOsBridgeOperationalReadiness\(\)/);
assert.doesNotMatch(bridgeHealthRouteSource, /generateText|ToolLoopAgent|createNexaProviderAdapter/);

const transpiled = ts.transpileModule(coreSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const core = await import(`data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`);

const base = {
  keyConfigured: true,
  timedOut: false,
  creditsHttpStatus: 200,
  creditsBalance: '5.00',
  modelsHttpStatus: 200,
  modelPresent: true,
  endpointsHttpStatus: 200,
  endpointCount: 3,
};

assert.deepEqual(
  core.classifyNexaAiGatewaySnapshot({ ...base, keyConfigured: false }),
  { status: 'missing', reason: 'ai_gateway_missing', credits: 'unknown' },
);
assert.deepEqual(
  core.classifyNexaAiGatewaySnapshot({ ...base, timedOut: true }),
  { status: 'degraded', reason: 'ai_gateway_timeout', credits: 'unknown' },
);
assert.deepEqual(
  core.classifyNexaAiGatewaySnapshot({ ...base, creditsHttpStatus: 401 }),
  { status: 'degraded', reason: 'ai_gateway_authentication_failed', credits: 'unknown' },
);
assert.deepEqual(
  core.classifyNexaAiGatewaySnapshot({ ...base, creditsBalance: '0' }),
  { status: 'degraded', reason: 'ai_gateway_credits_exhausted', credits: 'exhausted' },
);
assert.deepEqual(
  core.classifyNexaAiGatewaySnapshot({ ...base, modelPresent: false }),
  { status: 'degraded', reason: 'ai_gateway_model_unavailable', credits: 'available' },
);
assert.deepEqual(
  core.classifyNexaAiGatewaySnapshot({ ...base, endpointCount: 0 }),
  { status: 'degraded', reason: 'ai_gateway_provider_unavailable', credits: 'available' },
);
assert.deepEqual(
  core.classifyNexaAiGatewaySnapshot(base),
  { status: 'operational', reason: null, credits: 'available' },
);

let migration042Exists = true;
try {
  await access(new URL('../db/042_ai_gateway_operational_readiness.sql', import.meta.url));
} catch {
  migration042Exists = false;
}
assert.equal(migration042Exists, false, 'AI Gateway operational readiness must not introduce a database migration.');

console.log('NEXA AI Gateway operational readiness tests passed.');
