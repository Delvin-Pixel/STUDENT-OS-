#!/usr/bin/env node
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import ts from 'typescript';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [
  pkgText,
  coreSource,
  routeSource,
  readinessSource,
  healthRouteSource,
  smokeSource,
  envExample,
  readme,
] = await Promise.all([
  read('package.json'),
  read('lib/student-os-bridge-core.ts'),
  read('app/api/integrations/student-os/route.ts'),
  read('lib/student-os-bridge-readiness.ts'),
  read('app/api/integrations/student-os/health/route.ts'),
  read('scripts/smoke-student-os-bridge.mjs'),
  read('.env.local.example'),
  read('README.md'),
]);
const pkg = JSON.parse(pkgText);

assert.equal(pkg.name, 'nexa-1-74');
assert.equal(pkg.version, '1.74.0');
assert.equal(
  pkg.scripts['test:student-os-bridge-negotiation-policy'],
  'node scripts/test-student-os-bridge-negotiation-policy.mjs',
);
assert.match(pkg.scripts.test, /test:student-os-bridge-negotiation-policy/);
assert.match(readme, /NEXA 1\.74\.0 — Bridge Negotiation Policy & Legacy Sunset Readiness/);

assert.match(envExample, /NEXA_STUDENT_OS_BRIDGE_NEGOTIATION_REQUIRED=false/);
assert.match(coreSource, /parseStudentOsBridgeNegotiationRequired/);
assert.match(coreSource, /contract_header_required/);
assert.match(routeSource, /NEXA_STUDENT_OS_BRIDGE_NEGOTIATION_REQUIRED/);
assert.match(routeSource, /contract_negotiation_policy_invalid/);
assert.match(routeSource, /status: 503/);
assert.match(routeSource, /contract_header_required/);
assert.match(routeSource, /\? 428/);
assert.match(routeSource, /invalid_contract_header/);
assert.match(routeSource, /\? 400/);
assert.match(routeSource, /: 409/);
assert.match(routeSource, /X-NEXA-Bridge-Negotiation-Required/);

assert.match(readinessSource, /bridgeContractNegotiationRequired: boolean \| null/);
assert.match(readinessSource, /legacyBridgeContractDefaultAllowed: boolean/);
assert.match(readinessSource, /contractNegotiationPolicy: 'valid' \| 'invalid'/);
assert.match(readinessSource, /contract_negotiation_policy_invalid/);
assert.match(healthRouteSource, /X-NEXA-Bridge-Negotiation-Required/);
assert.match(healthRouteSource, /X-NEXA-Bridge-Legacy-Default-Allowed/);
assert.match(smokeSource, /bridgeContractNegotiationRequired/);
assert.match(smokeSource, /legacyBridgeContractDefaultAllowed/);

const transpiled = ts.transpileModule(coreSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const core = await import(`data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`);

assert.equal(core.parseStudentOsBridgeNegotiationRequired(undefined), false);
assert.equal(core.parseStudentOsBridgeNegotiationRequired(null), false);
assert.equal(core.parseStudentOsBridgeNegotiationRequired(''), false);
assert.equal(core.parseStudentOsBridgeNegotiationRequired('false'), false);
assert.equal(core.parseStudentOsBridgeNegotiationRequired(' FALSE '), false);
assert.equal(core.parseStudentOsBridgeNegotiationRequired('true'), true);
assert.equal(core.parseStudentOsBridgeNegotiationRequired(' TRUE '), true);
assert.throws(() => core.parseStudentOsBridgeNegotiationRequired('1'));
assert.throws(() => core.parseStudentOsBridgeNegotiationRequired('yes'));
assert.throws(() => core.parseStudentOsBridgeNegotiationRequired(true));

const legacy = core.negotiateStudentOsBridgeContract(null, false);
assert.equal(legacy.compatible, true);
assert.equal(legacy.version, '1.0');
assert.equal(legacy.source, 'legacy-default');

const requiredMissing = core.negotiateStudentOsBridgeContract(null, true);
assert.equal(requiredMissing.compatible, false);
assert.equal(requiredMissing.reason, 'contract_header_required');

const requiredBlank = core.negotiateStudentOsBridgeContract('   ', true);
assert.equal(requiredBlank.compatible, false);
assert.equal(requiredBlank.reason, 'contract_header_required');

const explicit = core.negotiateStudentOsBridgeContract('1.0', true);
assert.equal(explicit.compatible, true);
assert.equal(explicit.version, '1.0');
assert.equal(explicit.source, 'explicit');

const unsupported = core.negotiateStudentOsBridgeContract('2.0', true);
assert.equal(unsupported.compatible, false);
assert.equal(unsupported.reason, 'unsupported_contract');

let migration043Exists = true;
try {
  await access(new URL('../db/043_student_os_bridge_negotiation_policy.sql', import.meta.url));
} catch {
  migration043Exists = false;
}
assert.equal(
  migration043Exists,
  false,
  'Bridge negotiation policy must not introduce migration 043.',
);

console.log('NEXA Student OS bridge negotiation policy tests passed.');
