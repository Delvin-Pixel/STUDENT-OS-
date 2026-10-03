#!/usr/bin/env node
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import ts from 'typescript';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [pkgText, coreSource, routeSource, envExample, readme] = await Promise.all([
  read('package.json'),
  read('lib/student-os-bridge-core.ts'),
  read('app/api/integrations/student-os/route.ts'),
  read('.env.local.example'),
  read('README.md'),
]);
const pkg = JSON.parse(pkgText);

assert.equal(pkg.name, 'nexa-1-60');
assert.equal(pkg.version, '1.60.0');
assert.equal(pkg.scripts['test:student-os-bridge'], 'node scripts/test-student-os-bridge.mjs');
assert.match(pkg.scripts.test, /test:student-os-bridge/);
assert.match(readme, /NEXA 1\.59\.0 — Student OS Bridge & Consumer Integration/);
assert.match(envExample, /NEXA_STUDENT_OS_BRIDGE_SECRET=/);
assert.match(envExample, /NEXA_STUDENT_OS_BRIDGE_TIMEOUT_MS=18000/);

assert.match(routeSource, /readJsonBody<unknown>\(request, STUDENT_OS_BRIDGE_MAX_BODY_BYTES\)/);
assert.match(routeSource, /authorizeStudentOsBridge/);
assert.match(routeSource, /x-student-os-user-id/);
assert.match(routeSource, /headerUserId !== envelope\.request\.userId/);
assert.match(routeSource, /createNexaProviderAdapter/);
assert.match(routeSource, /Cache-Control': 'no-store'/);
assert.doesNotMatch(routeSource, /createNexaAgent/);
assert.doesNotMatch(routeSource, /createToolEngine/);

const transpiled = ts.transpileModule(coreSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const core = await import(`data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`);

const secret = 'a'.repeat(32);
assert.equal(core.isConfiguredStudentOsBridgeSecret(secret), true);
assert.equal(core.isConfiguredStudentOsBridgeSecret('short'), false);
assert.equal(core.authorizeStudentOsBridge(`Bearer ${secret}`, secret), true);
assert.equal(core.authorizeStudentOsBridge('Bearer wrong', secret), false);
assert.equal(core.authorizeStudentOsBridge(null, secret), false);
assert.equal(core.normalizeStudentOsBridgeUserHeader(' student-1 '), 'student-1');
assert.equal(core.getStudentOsBridgeTimeoutMs(undefined), 18_000);
assert.equal(core.getStudentOsBridgeTimeoutMs('5000'), 5_000);
assert.throws(() => core.getStudentOsBridgeTimeoutMs('999999'));

const envelope = core.parseStudentOsBridgeEnvelope({
  capability: 'tutor',
  request: {
    requestId: ' req-1 ',
    userId: ' student-1 ',
    prompt: ' Explain factorisation. ',
    locale: 'en-GH',
    academicContext: {
      authority: 'student-os-learning-intelligence',
      evidence: ['Readiness remains below the Student OS threshold.'],
    },
  },
});
assert.ok(envelope);
assert.equal(envelope.capability, 'tutor');
assert.equal(envelope.request.requestId, 'req-1');
assert.equal(envelope.request.userId, 'student-1');
assert.equal(envelope.request.prompt, 'Explain factorisation.');
assert.equal(core.parseStudentOsBridgeEnvelope({ capability: 'deleteEverything', request: envelope.request }), null);
assert.equal(core.parseStudentOsBridgeEnvelope({ capability: 'chat', request: { ...envelope.request, userId: '' } }), null);

let migration040Exists = true;
try {
  await access(new URL('../db/040_student_os_bridge.sql', import.meta.url));
} catch {
  migration040Exists = false;
}
assert.equal(migration040Exists, false, 'The Student OS bridge release must not introduce a database migration.');

console.log('NEXA Student OS private bridge contract tests passed.');
