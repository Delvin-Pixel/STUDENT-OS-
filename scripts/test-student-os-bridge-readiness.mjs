#!/usr/bin/env node
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import ts from 'typescript';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [pkgText, coreSource, readinessSource, routeSource, bridgeRouteSource, smokeSource, readme] = await Promise.all([
  read('package.json'),
  read('lib/student-os-bridge-core.ts'),
  read('lib/student-os-bridge-readiness.ts'),
  read('app/api/integrations/student-os/health/route.ts'),
  read('app/api/integrations/student-os/route.ts'),
  read('scripts/smoke-student-os-bridge.mjs'),
  read('README.md'),
]);
const pkg = JSON.parse(pkgText);

assert.equal(pkg.name, 'nexa-1-62');
assert.equal(pkg.version, '1.62.0');
assert.equal(pkg.scripts['test:student-os-bridge-readiness'], 'node scripts/test-student-os-bridge-readiness.mjs');
assert.equal(pkg.scripts['ops:smoke-student-os-bridge'], 'node scripts/smoke-student-os-bridge.mjs');
assert.match(pkg.scripts.test, /test:student-os-bridge-readiness/);
assert.match(readme, /NEXA 1\.60\.0 — Bridge Reliability & Operational Readiness/);

assert.match(coreSource, /STUDENT_OS_BRIDGE_REQUEST_ID_PATTERN/);
assert.match(coreSource, /normalizeStudentOsBridgeRequestId/);
assert.match(bridgeRouteSource, /X-NEXA-Bridge-Request-Id/);
assert.match(bridgeRouteSource, /X-NEXA-Version/);
assert.match(routeSource, /authorizeStudentOsBridge/);
assert.match(routeSource, /getStudentOsBridgeReadiness/);
assert.match(routeSource, /status: readiness\.status === 'ready' \? 200 : 503/);
assert.match(routeSource, /'Cache-Control': 'no-store'/);
assert.match(smokeSource, /api\/integrations\/student-os\/health/);
assert.doesNotMatch(routeSource, /generateText|ToolLoopAgent|createNexaProviderAdapter/);
assert.doesNotMatch(smokeSource, /\/api\/integrations\/student-os['"]/);

const transpiled = ts.transpileModule(coreSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const core = await import(`data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`);

assert.equal(core.normalizeStudentOsBridgeRequestId('abc-123:trace.7'), 'abc-123:trace.7');
assert.equal(core.normalizeStudentOsBridgeRequestId('550e8400-e29b-41d4-a716-446655440000'), '550e8400-e29b-41d4-a716-446655440000');
assert.equal(core.normalizeStudentOsBridgeRequestId(' bad id '), null);
assert.equal(core.normalizeStudentOsBridgeRequestId('bad\r\nid'), null);
assert.equal(core.normalizeStudentOsBridgeRequestId('x'.repeat(129)), null);

assert.match(readinessSource, /bridge_secret_missing/);
assert.match(readinessSource, /ai_gateway_missing/);
assert.match(readinessSource, /runtime_configuration_invalid/);
assert.match(readinessSource, /academicDecisionAuthority: NEXA_STUDENT_OS_ACADEMIC_AUTHORITY/);
assert.doesNotMatch(readinessSource, /NEXA_STUDENT_OS_BRIDGE_SECRET[^\n]*:/);

let migration040Exists = true;
try {
  await access(new URL('../db/040_student_os_bridge_readiness.sql', import.meta.url));
} catch {
  migration040Exists = false;
}
assert.equal(migration040Exists, false, 'Bridge readiness must not introduce a database migration.');

console.log('NEXA Student OS bridge readiness tests passed.');
