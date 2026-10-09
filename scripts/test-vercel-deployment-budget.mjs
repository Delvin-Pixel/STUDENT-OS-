#!/usr/bin/env node
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [pkgText, vercelText, readme] = await Promise.all([
  read('package.json'),
  read('vercel.json'),
  read('README.md'),
]);
const pkg = JSON.parse(pkgText);
const vercel = JSON.parse(vercelText);

assert.equal(pkg.name, 'nexa-1-70');
assert.equal(pkg.version, '1.70.0');
assert.equal(
  pkg.scripts['test:vercel-deployment-budget'],
  'node scripts/test-vercel-deployment-budget.mjs',
);
assert.match(pkg.scripts.test, /test:vercel-deployment-budget/);
assert.match(readme, /NEXA 1\.70\.0 — Preview Deployment Budget Guard/);

assert.equal(vercel.framework, 'nextjs');
assert.equal(vercel.installCommand, 'npm ci');
assert.equal(vercel.buildCommand, 'npm run build');
assert.equal(vercel.outputDirectory, '.next');

assert.deepEqual(vercel.git?.deploymentEnabled, {
  'stage/*': false,
  'diag/*': false,
  'nexa-*': false,
  'nexa-main': true,
});

assert.equal(vercel.git.deploymentEnabled['nexa-main'], true);
assert.equal(vercel.git.deploymentEnabled['nexa-*'], false);
assert.equal(vercel.git.deploymentEnabled['stage/*'], false);
assert.equal(vercel.git.deploymentEnabled['diag/*'], false);

let migration043Exists = true;
try {
  await access(new URL('../db/043_vercel_deployment_budget_guard.sql', import.meta.url));
} catch {
  migration043Exists = false;
}
assert.equal(
  migration043Exists,
  false,
  'Preview deployment budget guarding must not introduce a database migration.',
);

console.log('NEXA Vercel deployment budget guard tests passed.');
