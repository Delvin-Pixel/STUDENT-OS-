#!/usr/bin/env node
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import ts from 'typescript';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [pkgText, coreSource, providerSource, adapterSource, routeSource, readinessSource, readme] = await Promise.all([
  read('package.json'),
  read('lib/nexa-provider-adapter-core.ts'),
  read('lib/nexa-provider.ts'),
  read('lib/nexa-provider-adapter.ts'),
  read('app/api/integrations/student-os/route.ts'),
  read('lib/student-os-bridge-readiness.ts'),
  read('README.md'),
]);
const pkg = JSON.parse(pkgText);

assert.equal(pkg.name, 'nexa-1-74');
assert.equal(pkg.version, '1.74.0');
assert.equal(pkg.scripts['test:academic-context-binding'], 'node scripts/test-academic-context-binding.mjs');
assert.match(pkg.scripts.test, /test:academic-context-binding/);
assert.match(readme, /NEXA 1\.64\.0 — Academic Context Snapshot Binding & Provenance/);

assert.match(providerSource, /NEXA_ACADEMIC_CONTEXT_BINDING_VERSION = 'sha256-v1'/);
assert.match(providerSource, /academicContext: NexaAcademicContextBinding \| null/);
assert.match(providerSource, /snapshotId: string \| null/);
assert.match(providerSource, /fingerprint: string/);
assert.match(adapterSource, /bindNexaAcademicContext\(normalized\.academicContext\)/);
assert.match(routeSource, /X-NEXA-Academic-Context-SHA256/);
assert.match(routeSource, /academicContextHeaders\(claim\.body\)/);
assert.match(routeSource, /academicContextHeaders\(result\)/);
assert.match(readinessSource, /academicContextBindingVersion: NEXA_ACADEMIC_CONTEXT_BINDING_VERSION/);

const transpiled = ts.transpileModule(coreSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const core = await import(`data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`);

const request = core.normalizeNexaProviderRequest({
  requestId: 'bind-1',
  userId: 'student-1',
  prompt: 'Explain the next step.',
  academicContext: {
    authority: 'student-os-learning-intelligence',
    snapshotId: 'snapshot-2026-10-04T09:49Z',
    evidence: ['Mastery: algebra foundations developing.', 'Priority: factorisation remediation.'],
    constraints: ['Do not advance readiness.', 'Keep the explanation prerequisite-aligned.'],
  },
});
assert.ok(request?.academicContext);
const binding = core.bindNexaAcademicContext(request.academicContext);
assert.equal(binding.bindingVersion, 'sha256-v1');
assert.equal(binding.snapshotId, 'snapshot-2026-10-04T09:49Z');
assert.match(binding.fingerprint, /^[0-9a-f]{64}$/);
assert.equal(binding.evidenceCount, 2);
assert.equal(binding.constraintCount, 2);

const same = core.normalizeNexaProviderRequest({
  requestId: 'bind-2',
  userId: 'student-1',
  prompt: 'Another prompt does not affect academic binding.',
  academicContext: {
    authority: 'student-os-learning-intelligence',
    snapshotId: '  snapshot-2026-10-04T09:49Z ',
    evidence: [' Mastery: algebra foundations developing. ', 'Priority: factorisation remediation.'],
    constraints: ['Do not advance readiness.', 'Keep the explanation prerequisite-aligned.'],
  },
});
assert.equal(core.bindNexaAcademicContext(same.academicContext).fingerprint, binding.fingerprint);

const changedEvidence = core.normalizeNexaProviderRequest({
  ...request,
  academicContext: {
    ...request.academicContext,
    evidence: ['Mastery: algebra foundations secure.'],
  },
});
assert.notEqual(core.bindNexaAcademicContext(changedEvidence.academicContext).fingerprint, binding.fingerprint);

const changedSnapshot = core.normalizeNexaProviderRequest({
  ...request,
  academicContext: {
    ...request.academicContext,
    snapshotId: 'snapshot-next',
  },
});
assert.notEqual(core.bindNexaAcademicContext(changedSnapshot.academicContext).fingerprint, binding.fingerprint);
assert.equal(core.bindNexaAcademicContext(null), null);

let migration042Exists = true;
try {
  await access(new URL('../db/042_academic_context_binding.sql', import.meta.url));
} catch {
  migration042Exists = false;
}
assert.equal(migration042Exists, false, 'Academic context binding must not introduce a database migration.');

console.log('NEXA academic context snapshot binding tests passed.');
