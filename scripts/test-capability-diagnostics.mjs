#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [pkgText, diagnostics, route, health, env, smokeScript, rich] = await Promise.all([
  read('package.json'),
  read('lib/capability-diagnostics.ts'),
  read('app/api/health/capabilities/route.ts'),
  read('lib/health.ts'),
  read('.env.local.example'),
  read('scripts/smoke-capabilities.mjs'),
  read('lib/project-rich-files.ts'),
]);
const pkg = JSON.parse(pkgText);
assert.equal(pkg.version, '1.57.0');
assert.match(diagnostics, /NEXA_DIAGNOSTICS_ENABLED/);
assert.match(diagnostics, /NEXA_DIAGNOSTICS_TOKEN/);
assert.match(diagnostics, /timingSafeEqual/);
assert.match(diagnostics, /MAX_DIAGNOSTIC_FIXTURE_BYTES = 512 \* 1024/);
assert.match(diagnostics, /probeChat/);
assert.match(diagnostics, /probeEmbedding/);
assert.match(diagnostics, /probeVoice/);
assert.match(diagnostics, /probeRichExtraction/);
assert.match(diagnostics, /fixture_required/);
assert.doesNotMatch(diagnostics, /transcript:\s*result\.transcript/);
assert.match(route, /authorizeCapabilityDiagnostics/);
assert.match(route, /readJsonBody<Record<string, unknown>>\(request, 1_500_000\)/);
assert.match(route, /run-live-provider-smoke/);
assert.match(route, /result\.status === 'ok' \? 200 : 503/);
assert.match(route, /Cache-Control': 'no-store/);
assert.doesNotMatch(health, /runCapabilitySmoke/);
assert.match(env, /NEXA_DIAGNOSTICS_ENABLED=false/);
assert.match(env, /NEXA_DIAGNOSTICS_TOKEN=/);
assert.match(smokeScript, /run-live-provider-smoke/);
assert.match(smokeScript, /NEXA_SMOKE_CHECKS/);
assert.match(smokeScript, /NEXA_SMOKE_VOICE_FILE/);
assert.match(smokeScript, /512 \* 1024/);
assert.match(rich, /export async function extractRichProjectKnowledge/);
assert.match(pkg.scripts['test'], /test:capability-diagnostics/);
assert.match(pkg.scripts['verify:ci'], /test:capability-diagnostics/);
console.log('NEXA capability diagnostics contract tests passed.');
