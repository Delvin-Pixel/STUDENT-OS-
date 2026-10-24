#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read=(p)=>readFile(new URL(`../${p}`,import.meta.url),'utf8');
const [pkgText,coreSource,healthSource,bridgeSource,routeSource,readme]=await Promise.all([
  read('package.json'),
  read('lib/supabase-data-api-remediation-handoff-core.ts'),
  read('lib/health.ts'),
  read('lib/student-os-bridge-readiness.ts'),
  read('app/api/integrations/student-os/health/route.ts'),
  read('README.md'),
]);
const pkg=JSON.parse(pkgText);
assert.equal(pkg.name,'nexa-1-96');
assert.equal(pkg.version,'1.96.0');
assert.equal(pkg.scripts['test:data-api-remediation-handoff'],'node scripts/test-data-api-remediation-handoff.mjs');
assert.match(pkg.scripts.test,/test:data-api-remediation-handoff/);
assert.match(readme,/NEXA 1\.96\.0 — Data API Remediation Handoff/);

for(const token of [
  'project-owner','operator','security-review','supabase-dashboard','runtime-diagnostics',
  'disable-data-api','verify-data-api-platform','verify-data-api-isolation',
  'verify-data-api-remediation','review-current-data-api-exposure',
  'recheck-platform-and-isolation','recheck-effective-security','recheck-remediation-readiness',
]) assert.match(coreSource,new RegExp(token));
assert.match(coreSource,/automaticRemediation: false/);
assert.doesNotMatch(coreSource,/ALTER DEFAULT PRIVILEGES|\bREVOKE\b|\bGRANT\b/i);
assert.doesNotMatch(coreSource,/api[_ -]?key|credential|prompt|response_body/i);

for(const token of [
  'dataApiRemediationHandoffOwner','dataApiRemediationHandoffSurface',
  'dataApiRemediationHandoffNextStep','dataApiRemediationHandoffVerification',
  'dataApiRemediationHandoffRequiresHumanAction','dataApiRemediationHandoffRequiresWorkBrowser',
]) assert.match(healthSource,new RegExp(token));
assert.match(bridgeSource,/dataApiRemediationHandoff:/);
for(const header of [
  'X-NEXA-Bridge-Data-API-Remediation-Handoff-Owner',
  'X-NEXA-Bridge-Data-API-Remediation-Handoff-Surface',
  'X-NEXA-Bridge-Data-API-Remediation-Handoff-Next-Step',
  'X-NEXA-Bridge-Data-API-Remediation-Handoff-Verification',
  'X-NEXA-Bridge-Data-API-Remediation-Handoff-Requires-Human',
  'X-NEXA-Bridge-Data-API-Remediation-Handoff-Requires-Work-Browser',
]) assert.match(routeSource,new RegExp(header));

for(const source of [healthSource,bridgeSource,routeSource]){
  assert.doesNotMatch(source,/riskyDefaultOwnerCount|alterableRiskyDefaultOwnerCount|protectedRiskyDefaultOwnerCount|owner_name|rolname/);
}

console.log('NEXA Data API remediation handoff contract tests passed.');
