#!/usr/bin/env node
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [pkgText, vercelText, versionSource, readme] = await Promise.all([
  read('package.json'),
  read('vercel.json'),
  read('lib/version.ts'),
  read('README.md'),
]);

const pkg = JSON.parse(pkgText);
const vercel = JSON.parse(vercelText);

assert.equal(pkg.name, 'nexa-1-73');
assert.equal(pkg.version, '1.73.0');
assert.match(versionSource, /NEXA_VERSION = '1\.73\.0'/);
assert.equal(pkg.scripts['test:vercel-deployment-isolation'], 'node scripts/test-vercel-deployment-isolation.mjs');
assert.match(pkg.scripts.test, /test:vercel-deployment-isolation/);
assert.match(readme, /NEXA 1\.66\.0 — Branch-Local Vercel Deployment Isolation/);
assert.match(readme, /NEXA 1\.70\.0 — Student OS Preflight Failover Readiness/);

assert.equal(vercel.$schema, 'https://openapi.vercel.sh/vercel.json');
assert.equal(vercel.framework, 'nextjs');
assert.equal(vercel.installCommand, 'npm ci');
assert.equal(vercel.buildCommand, 'npm run build');
assert.equal(vercel.outputDirectory, '.next');
assert.notEqual(vercel.outputDirectory, 'dist/public');
assert.doesNotMatch(vercelText, /pnpm|docusaurus|build\//i);

assert.deepEqual(vercel.git?.deploymentEnabled, {
  'nexa-main': true,
  'nexa-*': false,
  'stage/nexa-*': false,
});
assert.equal(vercel.git.deploymentEnabled['nexa-main'], true);
assert.equal(vercel.git.deploymentEnabled['nexa-*'], false);
assert.equal(vercel.git.deploymentEnabled['stage/nexa-*'], false);

let migration043Exists = true;
try {
  await access(new URL('../db/043_vercel_deployment_isolation.sql', import.meta.url));
} catch {
  migration043Exists = false;
}
assert.equal(migration043Exists, false, 'Vercel deployment isolation must not introduce a database migration.');

console.log('NEXA branch-local Vercel deployment isolation tests passed.');
