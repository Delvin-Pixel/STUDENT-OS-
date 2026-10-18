#!/usr/bin/env node
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import ts from 'typescript';

const read=(p)=>readFile(new URL(`../${p}`,import.meta.url),'utf8');
const [pkgText,coreSource,runtimeSource,healthSource,bridgeSource,routeSource,readme]=await Promise.all([
  read('package.json'),
  read('lib/supabase-data-api-remediation-core.ts'),
  read('lib/supabase-data-api-remediation-readiness.ts'),
  read('lib/health.ts'),
  read('lib/student-os-bridge-readiness.ts'),
  read('app/api/integrations/student-os/health/route.ts'),
  read('README.md'),
]);
const pkg=JSON.parse(pkgText);
assert.equal(pkg.name,'nexa-1-95');
assert.equal(pkg.version,'1.95.0');
assert.equal(pkg.scripts['test:data-api-remediation-readiness'],'node scripts/test-data-api-remediation-readiness.mjs');
assert.match(pkg.scripts.test,/test:data-api-remediation-readiness/);
assert.match(readme,/NEXA 1\.95\.0 — Data API Remediation Readiness Surface/);

assert.match(runtimeSource,/NEXA_DATA_API_REMEDIATION_READINESS_CACHE_MS = 60_000/);
assert.match(runtimeSource,/getNexaDataApiRemediationReadiness/);
assert.match(runtimeSource,/pg_default_acl/);
assert.match(runtimeSource,/pg_has_role\(current_user, owner\.rolname, 'MEMBER'\)/);
assert.match(runtimeSource,/classifyNexaDataApiRemediationPlan/);
assert.doesNotMatch(runtimeSource,/alter\s+default\s+privileges|\brevoke\s+|\bgrant\s+/i);
assert.doesNotMatch(runtimeSource,/api[_ -]?key|prompt|response_body/i);

for(const token of ['dataApiRemediationStatus','dataApiRemediationAction','dataApiRemediationSqlFeasibility']){
  assert.match(healthSource,new RegExp(token));
}
assert.match(bridgeSource,/dataApiRemediation:/);
assert.match(routeSource,/X-NEXA-Bridge-Data-API-Remediation-Status/);
assert.match(routeSource,/X-NEXA-Bridge-Data-API-Remediation-Action/);
assert.match(routeSource,/X-NEXA-Bridge-Data-API-Remediation-SQL-Feasibility/);
assert.doesNotMatch(healthSource,/riskyDefaultOwnerCount|alterableRiskyDefaultOwnerCount|protectedRiskyDefaultOwnerCount|owner_name|rolname/);
assert.doesNotMatch(bridgeSource,/riskyDefaultOwnerCount|alterableRiskyDefaultOwnerCount|protectedRiskyDefaultOwnerCount/);

const transpiled=ts.transpileModule(coreSource,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const core=await import(`data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`);

const blocked=core.classifyNexaDataApiRemediationPlan({
  platformStatus:'enabled',
  isolationStatus:'future-default-risk',
  riskyDefaultOwnerCount:1,
  alterableRiskyDefaultOwnerCount:0,
});
assert.equal(blocked.status,'owner-action-required');
assert.equal(blocked.recommendedAction,'disable-data-api-in-dashboard');
assert.equal(blocked.sqlRemediationFeasibility,'blocked-by-default-owner');
assert.equal(blocked.automaticRemediation,false);

const disabled=core.classifyNexaDataApiRemediationPlan({
  platformStatus:'disabled',
  isolationStatus:'future-default-risk',
  riskyDefaultOwnerCount:1,
  alterableRiskyDefaultOwnerCount:0,
});
assert.equal(disabled.status,'no-action');
assert.equal(disabled.recommendedAction,'none');
assert.equal(disabled.sqlRemediationFeasibility,'not-needed');

const unavailable=core.classifyNexaDataApiRemediationPlan({
  platformStatus:'unavailable',
  isolationStatus:'future-default-risk',
  riskyDefaultOwnerCount:1,
  alterableRiskyDefaultOwnerCount:0,
});
assert.equal(unavailable.status,'verification-required');
assert.equal(unavailable.recommendedAction,'verify-data-api-platform-state');

let migration048=true;
try{await access(new URL('../db/048_data_api_remediation_readiness.sql',import.meta.url));}catch{migration048=false;}
assert.equal(migration048,false);

console.log('NEXA Data API remediation readiness surface tests passed.');
