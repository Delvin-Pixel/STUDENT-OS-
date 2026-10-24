#!/usr/bin/env node
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import ts from 'typescript';
import {
  classifyRemediationPlan,
  probeDataApiPlatform,
} from './plan-supabase-data-api-remediation.mjs';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [pkgText, coreSource, effectiveCoreSource, operatorSource, readme] = await Promise.all([
  read('package.json'),
  read('lib/supabase-data-api-remediation-core.ts'),
  read('lib/supabase-data-api-effective-security-core.ts'),
  read('scripts/plan-supabase-data-api-remediation.mjs'),
  read('README.md'),
]);
const pkg = JSON.parse(pkgText);

assert.equal(pkg.name, 'nexa-1-96');
assert.equal(pkg.version, '1.96.0');
assert.equal(
  pkg.scripts['ops:plan-data-api-remediation'],
  'node scripts/plan-supabase-data-api-remediation.mjs',
);
assert.equal(
  pkg.scripts['test:data-api-remediation-plan'],
  'node scripts/test-data-api-remediation-plan.mjs',
);
assert.match(pkg.scripts.test, /test:data-api-remediation-plan/);
assert.match(readme, /NEXA 1\.94\.0 — Platform-Aware Data API Remediation Closure/);

for (const token of [
  'pg_default_acl',
  'aclexplode',
  "pg_has_role(current_user, owner.rolname, 'MEMBER')",
  "'anon'",
  "'authenticated'",
  "n.nspname = 'public'",
  "recommendedAction: 'disable-data-api-in-dashboard'",
  "'verify-data-api-platform-state'",
  'automaticRemediation: false',
  'probeDataApiPlatform',
  'PGRST205',
  'PGRST106',
]) {
  assert.ok(operatorSource.includes(token), token);
}

assert.match(operatorSource, /__nexa_data_api_platform_probe_nonexistent__/);
assert.match(operatorSource, /limit', '0'/);
assert.match(operatorSource, /MAX_PROBE_BODY_BYTES = 2_048/);
assert.match(operatorSource, /NEXA_SUPABASE_PUBLISHABLE_KEY/);
assert.doesNotMatch(operatorSource, /alter\s+default\s+privileges/i);
assert.doesNotMatch(operatorSource, /\brevoke\s+/i);
assert.doesNotMatch(operatorSource, /\bgrant\s+/i);
assert.doesNotMatch(operatorSource, /service_role|prompt|response_body/i);
assert.doesNotMatch(operatorSource, /console\.(log|error).*publishableKey/i);

const effectiveTranspiled = ts.transpileModule(effectiveCoreSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const effectiveUrl = `data:text/javascript;base64,${Buffer.from(effectiveTranspiled).toString('base64')}`;

const isolatedCoreSource = coreSource
  .replace(
    "'@/lib/supabase-data-api-effective-security-core'",
    JSON.stringify(effectiveUrl),
  )
  .replace(
    /import type \{ NexaDataApiIsolationStatus \} from '@\/lib\/supabase-data-api-isolation-core';\n/,
    '',
  )
  .replace(
    /import type \{ NexaDataApiPlatformStatus \} from '@\/lib\/supabase-data-api-platform-core';\n/,
    '',
  );

const transpiled = ts.transpileModule(isolatedCoreSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const core = await import(
  `data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`
);

const cases = [
  {
    input: {
      platformStatus: 'enabled',
      isolationStatus: 'isolated',
      riskyDefaultOwnerCount: 0,
      alterableRiskyDefaultOwnerCount: 0,
    },
    status: 'no-action',
    action: 'none',
    sql: 'not-needed',
    effectiveStatus: 'secure',
    effectiveReason: null,
  },
  {
    input: {
      platformStatus: 'enabled',
      isolationStatus: 'future-default-risk',
      riskyDefaultOwnerCount: 1,
      alterableRiskyDefaultOwnerCount: 0,
    },
    status: 'owner-action-required',
    action: 'disable-data-api-in-dashboard',
    sql: 'blocked-by-default-owner',
    effectiveStatus: 'insecure',
    effectiveReason: 'data_api_future_default_risk',
  },
  {
    input: {
      platformStatus: 'disabled',
      isolationStatus: 'future-default-risk',
      riskyDefaultOwnerCount: 1,
      alterableRiskyDefaultOwnerCount: 0,
    },
    status: 'no-action',
    action: 'none',
    sql: 'not-needed',
    effectiveStatus: 'secure',
    effectiveReason: null,
  },
  {
    input: {
      platformStatus: 'disabled',
      isolationStatus: 'exposed',
      riskyDefaultOwnerCount: 2,
      alterableRiskyDefaultOwnerCount: 0,
    },
    status: 'no-action',
    action: 'none',
    sql: 'not-needed',
    effectiveStatus: 'secure',
    effectiveReason: null,
  },
  {
    input: {
      platformStatus: 'enabled',
      isolationStatus: 'exposed',
      riskyDefaultOwnerCount: 2,
      alterableRiskyDefaultOwnerCount: 1,
    },
    status: 'security-review-required',
    action: 'review-current-data-api-exposure',
    sql: 'blocked-by-default-owner',
    effectiveStatus: 'insecure',
    effectiveReason: 'data_api_current_exposure',
  },
  {
    input: {
      platformStatus: 'unavailable',
      isolationStatus: 'isolated',
      riskyDefaultOwnerCount: 0,
      alterableRiskyDefaultOwnerCount: 0,
    },
    status: 'verification-required',
    action: 'verify-data-api-platform-state',
    sql: 'not-evaluated',
    effectiveStatus: 'unavailable',
    effectiveReason: 'data_api_platform_unavailable',
  },
  {
    input: {
      platformStatus: 'enabled',
      isolationStatus: 'unavailable',
      riskyDefaultOwnerCount: 0,
      alterableRiskyDefaultOwnerCount: 0,
    },
    status: 'verification-required',
    action: 'verify-data-api-isolation-attestation',
    sql: 'not-evaluated',
    effectiveStatus: 'unavailable',
    effectiveReason: 'data_api_isolation_unavailable',
  },
];

for (const entry of cases) {
  const runtime = classifyRemediationPlan(entry.input);
  const typed = core.classifyNexaDataApiRemediationPlan(entry.input);

  assert.equal(runtime.status, entry.status);
  assert.equal(runtime.recommendedAction, entry.action);
  assert.equal(runtime.sqlRemediationFeasibility, entry.sql);
  assert.equal(runtime.automaticRemediation, false);
  assert.equal(runtime.evidence.platformStatus, entry.input.platformStatus);
  assert.equal(runtime.evidence.isolationStatus, entry.input.isolationStatus);
  assert.equal(runtime.evidence.effectiveSecurityStatus, entry.effectiveStatus);
  assert.equal(runtime.evidence.effectiveSecurityReason, entry.effectiveReason);

  assert.deepEqual(
    {
      status: typed.status,
      recommendedAction: typed.recommendedAction,
      sqlRemediationFeasibility: typed.sqlRemediationFeasibility,
      automaticRemediation: typed.automaticRemediation,
      currentExposure: typed.currentExposure,
      futureDefaultRisk: typed.futureDefaultRisk,
      evidence: {
        platformStatus: typed.platformStatus,
        isolationStatus: typed.isolationStatus,
        effectiveSecurityStatus: typed.effectiveSecurityStatus,
        effectiveSecurityReason: typed.effectiveSecurityReason,
        riskyDefaultOwnerCount: typed.riskyDefaultOwnerCount,
        alterableRiskyDefaultOwnerCount: typed.alterableRiskyDefaultOwnerCount,
        protectedRiskyDefaultOwnerCount: typed.protectedRiskyDefaultOwnerCount,
      },
    },
    runtime,
  );
  assert.equal(Object.isFrozen(runtime), true);
  assert.equal(Object.isFrozen(runtime.evidence), true);
  assert.equal(Object.isFrozen(typed), true);
}

const validUrl = 'https://abcdefghijklmnopqrst.supabase.co';

const enabled = await probeDataApiPlatform({
  supabaseUrl: validUrl,
  publishableKey: 'sb_publishable_test',
  fetchImpl: async () => new Response(
    JSON.stringify({ code: 'PGRST205', message: 'bounded-test' }),
    { status: 404, headers: { 'content-type': 'application/json' } },
  ),
});
assert.deepEqual(enabled, { status: 'enabled', reason: null });

const disabled = await probeDataApiPlatform({
  supabaseUrl: validUrl,
  publishableKey: 'sb_publishable_test',
  fetchImpl: async () => new Response(
    JSON.stringify({ code: 'PGRST106' }),
    { status: 404, headers: { 'content-type': 'application/json' } },
  ),
});
assert.deepEqual(disabled, { status: 'disabled', reason: null });

const rejected = await probeDataApiPlatform({
  supabaseUrl: validUrl,
  publishableKey: 'sb_publishable_test',
  fetchImpl: async () => new Response('{}', { status: 401 }),
});
assert.deepEqual(rejected, { status: 'unavailable', reason: 'credential_rejected' });

const unexpected = await probeDataApiPlatform({
  supabaseUrl: validUrl,
  publishableKey: 'sb_publishable_test',
  fetchImpl: async () => new Response('{}', { status: 403 }),
});
assert.deepEqual(unexpected, { status: 'unavailable', reason: 'unexpected_status' });

const missing = await probeDataApiPlatform({
  supabaseUrl: '',
  publishableKey: '',
  fetchImpl: async () => {
    throw new Error('fetch should not run without configuration');
  },
});
assert.deepEqual(missing, { status: 'unavailable', reason: 'configuration_missing' });

let migration048Exists = true;
try {
  await access(new URL('../db/048_data_api_platform_aware_remediation.sql', import.meta.url));
} catch {
  migration048Exists = false;
}
assert.equal(
  migration048Exists,
  false,
  'Platform-aware Data API remediation planning must not introduce migration 048.',
);

console.log('NEXA platform-aware Supabase Data API remediation planning tests passed.');
