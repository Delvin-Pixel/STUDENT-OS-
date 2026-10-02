#!/usr/bin/env node
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const workflow = await readFile(path.join(root, '.github/workflows/verify.yml'), 'utf8');

assert.equal(pkg.name, 'nexa-1-57');
assert.equal(pkg.version, '1.57.0');
assert.match(workflow, /branches: \[nexa-main\]/);
assert.doesNotMatch(workflow, /branches: \[main\]/);
assert.match(workflow, /actions\/checkout@v7/);
assert.match(workflow, /actions\/setup-node@v7/);
assert.match(workflow, /nexa-1\.56\.0-verified/);
assert.match(workflow, /nexa-1\.56\.0-verification-evidence/);
assert.match(workflow, /--exclude='\.\/\.git'/);
assert.doesNotMatch(workflow, /\.nexa-verify/);
assert.doesNotMatch(workflow, /Reconstruct exact NEXA|Reconstruct and apply NEXA/);

let payloadDirExists = true;
try {
  await access(path.join(root, '.nexa-verify'), constants.F_OK);
} catch {
  payloadDirExists = false;
}
assert.equal(payloadDirExists, false, 'Canonical source must not contain .nexa-verify payload scaffolding.');

for (const required of ['app', 'lib', 'db', 'components', 'scripts', 'package.json', 'package-lock.json']) {
  await access(path.join(root, required), constants.F_OK);
}

console.log('NEXA canonical source contract tests passed.');
