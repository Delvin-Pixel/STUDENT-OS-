#!/usr/bin/env node
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import ts from 'typescript';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [pkgText, coreSource, adapterSource, contractSource, readme] = await Promise.all([
  read('package.json'),
  read('lib/nexa-provider-adapter-core.ts'),
  read('lib/nexa-provider-adapter.ts'),
  read('lib/nexa-provider.ts'),
  read('README.md'),
]);
const pkg = JSON.parse(pkgText);

assert.equal(pkg.name, 'nexa-1-70');
assert.equal(pkg.version, '1.70.0');
assert.match(adapterSource, /ToolLoopAgent/);
assert.match(adapterSource, /agent\.generate\(/);
assert.match(adapterSource, /stopWhen: isStepCount\(1\)/);
assert.match(adapterSource, /normalized\.userId !== boundUserId/);
assert.match(adapterSource, /Promise\.race/);
assert.match(adapterSource, /controller\.abort\('NEXA_PROVIDER_TIMEOUT'\)/);
assert.match(adapterSource, /createNexaProviderMetadata/);
assert.match(adapterSource, /bindNexaAcademicContext\(normalized\.academicContext\)/);
assert.match(adapterSource, /createNexaProviderFailure/);
const typedCapabilityWrappers = adapterSource.match(/request: NexaProviderRequest/g) ?? [];
assert.ok(typedCapabilityWrappers.length >= 6, 'All provider capability wrappers must retain explicit request typing.'); // typed capability wrappers
assert.doesNotMatch(adapterSource, /createToolEngine/);
assert.doesNotMatch(adapterSource, /createNexaAgent/);
assert.match(contractSource, /mayOverrideAcademicDecisions: false/);
assert.match(contractSource, /studentOsCoreRequiresNexa: false/);
assert.match(readme, /NEXA 1\.58\.0 — Student OS Provider Runtime Adapter/);
assert.match(pkg.scripts['test'], /test:nexa-provider-adapter/);
assert.equal(pkg.scripts['test:nexa-provider-adapter'], 'node scripts/test-nexa-provider-adapter.mjs');

const transpiled = ts.transpileModule(coreSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const core = await import(`data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`);

const valid = core.normalizeNexaProviderRequest({
  requestId: ' req-1 ',
  userId: ' student-1 ',
  prompt: ' Explain quadratic factorisation. ',
  locale: 'en-GH',
  academicContext: {
    authority: 'student-os-learning-intelligence',
    snapshotId: 'snap-7',
    evidence: ['Mastery: foundation algebra still developing.'],
    constraints: ['Do not advance the learner beyond the host-selected prerequisite.'],
  },
});
assert.ok(valid);
assert.equal(valid.requestId, 'req-1');
assert.equal(valid.userId, 'student-1');
assert.equal(valid.prompt, 'Explain quadratic factorisation.');
assert.equal(valid.academicContext.authority, 'student-os-learning-intelligence');

const prompt = core.buildNexaProviderPrompt('tutor', valid);
assert.match(prompt, /Student OS deterministic learningIntelligence remains authoritative/);
assert.match(prompt, /E1: Mastery: foundation algebra still developing\./);
assert.match(prompt, /C1: Do not advance the learner beyond the host-selected prerequisite\./);
assert.match(prompt, /User request:\nExplain quadratic factorisation\./);

assert.equal(core.normalizeNexaProviderRequest({ ...valid, userId: '' }), null);
assert.equal(core.normalizeNexaProviderRequest({
  ...valid,
  academicContext: { ...valid.academicContext, authority: 'nexa' },
}), null);
assert.equal(core.normalizeNexaProviderRequest({
  ...valid,
  prompt: 'x'.repeat(core.NEXA_PROVIDER_ADAPTER_LIMITS.promptChars + 1),
}), null);

assert.deepEqual(
  core.classifyNexaProviderError({ status: 429 }),
  { code: 'rate_limited', retryable: true },
);
assert.deepEqual(
  core.classifyNexaProviderError(new Error('request timed out')),
  { code: 'timeout', retryable: true },
);
assert.deepEqual(
  core.classifyNexaProviderError({ statusCode: 503 }),
  { code: 'unavailable', retryable: false },
);
assert.deepEqual(
  core.classifyNexaProviderError(new Error('unexpected provider failure')),
  { code: 'error', retryable: false },
);

let migration040Exists = true;
try {
  await access(new URL('../db/040_nexa_provider_adapter.sql', import.meta.url));
} catch {
  migration040Exists = false;
}
assert.equal(migration040Exists, false, 'The provider adapter release must not introduce a database migration.');

console.log('NEXA Student OS provider adapter integration harness passed.');
