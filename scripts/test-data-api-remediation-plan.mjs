#!/usr/bin/env node
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import ts from 'typescript';
import {
  classifyRemediationPlan,
} from './plan-supabase-data-api-remediation.mjs';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [pkgText, coreSource, operatorSource, readme] = await Promise.all([
  read('package.json'),
  read('lib/supabase-data-api-remediation-core.ts'),
  read('scripts/plan-supabase-data-api-remediation.mjs'),
  read('README.md'),
]);
const pkg = JSON.parse(pkgText);

assert.equal(pkg.name, 'nexa-1-90');
assert.equal(pkg.version, '1.90.0');
assert.equal(
  pkg.scripts['ops:plan-data-api-remediation'],
  'node scripts/plan-supabase-data-api-remediation.mjs',
);
assert.equal(
  pkg.scripts['test:data-api-remediation-plan'],
  'node scripts/test-data-api-remediation-plan.mjs',
);
assert.match(pkg.scripts.test, /test:data-api-remediation-plan/);
assert.match(readme, /NEXA 1\.90\.0 — Supabase Data API Remediation Planning/);

for (const token of [
  'pg_default_acl',
  'aclexplode',
  "pg_has_role(current_user, owner.rolname, 'MEMBER')",
  "'anon'",
  "'authenticated'",
  "n.nspname = 'public'",
  "recommendedAction: 'disable-data-api-in-dashboard'",
  'automaticRemediation: false',
]) {
  assert.ok(operatorSource.includes(token), token);
}

assert.doesNotMatch(operatorSource, /alter\s+default\s+privileges/i);
assert.doesNotMatch(operatorSource, /\brevoke\s+/i);
assert.doesNotMatch(operatorSource, /\bgrant\s+/i);
assert.doesNotMatch(operatorSource, /service_role|api[_ -]?key|prompt|response_body/i);

const transpiled = ts.transpileModule(coreSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const core = await import(`data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`);

const cases = [
  {
    input: { isolationStatus: 'isolated', riskyDefaultOwnerCount: 0, alterableRiskyDefaultOwnerCount: 0 },
    status: 'no-action',
    action: 'none',
    sql: 'not-needed',
  },
  {
    input: { isolationStatus: 'future-default-risk', riskyDefaultOwnerCount: 1, alterableRiskyDefaultOwnerCount: 0 },
    status: 'owner-action-required',
    action: 'disable-data-api-in-dashboard',
    sql: 'blocked-by-default-owner',
  },
  {
    input: { isolationStatus: 'future-default-risk', riskyDefaultOwnerCount: 1, alterableRiskyDefaultOwnerCount: 1 },
    status: 'owner-action-required',
    action: 'disable-data-api-in-dashboard',
    sql: 'technically-possible-but-automatic-remediation-disabled',
  },
  {
    input: { isolationStatus: 'exposed', riskyDefaultOwnerCount: 2, alterableRiskyDefaultOwnerCount: 1 },
    status: 'security-review-required',
    action: 'review-current-data-api-exposure',
    sql: 'blocked-by-default-owner',
  },
];

for (const entry of cases) {
  const runtime = classifyRemediationPlan(entry.input);
  const typed = core.classifyNexaDataApiRemediationPlan(entry.input);
  assert.equal(runtime.status, entry.status);
  assert.equal(runtime.recommendedAction, entry.action);
  assert.equal(runtime.sqlRemediationFeasibility, entry.sql);
  assert.equal(runtime.automaticRemediation, false);
  assert.deepEqual(
    {
      status: typed.status,
      recommendedAction: typed.recommendedAction,
      sqlRemediationFeasibility: typed.sqlRemediationFeasibility,
      automaticRemediation: typed.automaticRemediation,
      evidence: {
        isolationStatus: entry.input.isolationStatus,
        riskyDefaultOwnerCount: typed.riskyDefaultOwnerCount,
        alterableRiskyDefaultOwnerCount: typed.alterableRiskyDefaultOwnerCount,
        protectedRiskyDefaultOwnerCount: typed.protectedRiskyDefaultOwnerCount,
      },
    },
    runtime,
  );
  assert.equal(Object.isFrozen(runtime), true);
  assert.equal(Object.isFrozen(runtime.evidence), true);
}

let migration047Exists = true;
try {
  await access(new URL('../db/047_data_api_remediation_plan.sql', import.meta.url));
} catch {
  migration047Exists = false;
}
assert.equal(
  migration047Exists,
  false,
  'Data API remediation planning must not introduce migration 047.',
);

console.log('NEXA Supabase Data API remediation planning tests passed.');
