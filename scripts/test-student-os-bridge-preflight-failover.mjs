#!/usr/bin/env node
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [pkgText, readinessSource, healthRouteSource, smokeSource, fallbackSource, readme] = await Promise.all([
  read('package.json'),
  read('lib/student-os-bridge-readiness.ts'),
  read('app/api/integrations/student-os/health/route.ts'),
  read('scripts/smoke-student-os-bridge.mjs'),
  read('lib/student-os-bridge-fallback-core.ts'),
  read('README.md'),
]);
const pkg = JSON.parse(pkgText);

assert.equal(pkg.name, 'nexa-1-74');
assert.equal(pkg.version, '1.74.0');
assert.equal(
  pkg.scripts['test:student-os-bridge-preflight-failover'],
  'node scripts/test-student-os-bridge-preflight-failover.mjs',
);
assert.match(pkg.scripts.test, /test:student-os-bridge-preflight-failover/);
assert.match(readme, /NEXA 1\.70\.0 — Student OS Preflight Failover Readiness/);

assert.match(readinessSource, /StudentOsBridgeServingMode/);
assert.match(readinessSource, /servingMode/);
assert.match(readinessSource, /fallback: StudentOsBridgeFallbackDirective \| null/);
assert.match(readinessSource, /classifyStudentOsBridgeOperationalAdmission/);
assert.match(readinessSource, /createStudentOsBridgeFallbackDirective/);
assert.match(readinessSource, /STUDENT_OS_BRIDGE_FALLBACK_MODE/);
assert.match(readinessSource, /base\.status === 'ready' && operationalAdmission\.allowed/);
assert.match(readinessSource, /base\.configuration\.bridgeSecret === 'configured'/);
assert.doesNotMatch(readinessSource, /generateText|ToolLoopAgent|streamText|embed\(/);

assert.match(healthRouteSource, /X-NEXA-Bridge-Serving-Mode/);
assert.match(healthRouteSource, /X-NEXA-Bridge-Fallback-Contract/);
assert.match(healthRouteSource, /status: readiness\.status === 'ready' \? 200 : 503/);
assert.match(healthRouteSource, /fallbackContract: readiness\.fallback\?\.contractVersion \?\? null/);
assert.doesNotMatch(healthRouteSource, /createNexaProviderAdapter|ToolLoopAgent|generateText/);

assert.match(smokeSource, /const fullReady/);
assert.match(smokeSource, /const fallbackReady/);
assert.match(smokeSource, /response\.status === 503/);
assert.match(smokeSource, /body\?\.servingMode === 'student-os-deterministic'/);
assert.match(smokeSource, /body\?\.fallback\?\.contractVersion === '1\.0'/);
assert.match(smokeSource, /const valid = commonValid && \(fullReady \|\| fallbackReady\)/);
assert.match(smokeSource, /api\/integrations\/student-os\/health/);
assert.doesNotMatch(smokeSource, /fetch\([^\n]*api\/integrations\/student-os['"]/);

assert.match(fallbackSource, /STUDENT_OS_BRIDGE_FALLBACK_CONTRACT_VERSION = '1\.0'/);
assert.match(fallbackSource, /STUDENT_OS_BRIDGE_FALLBACK_MODE = 'student-os-deterministic'/);
assert.match(fallbackSource, /STUDENT_OS_BRIDGE_FALLBACK_AUTHORITY = 'student-os-learning-intelligence'/);

let migration043Exists = true;
try {
  await access(new URL('../db/043_student_os_bridge_preflight_failover.sql', import.meta.url));
} catch {
  migration043Exists = false;
}
assert.equal(
  migration043Exists,
  false,
  'Student OS preflight failover readiness must not introduce migration 043.',
);

console.log('NEXA Student OS preflight failover readiness tests passed.');
