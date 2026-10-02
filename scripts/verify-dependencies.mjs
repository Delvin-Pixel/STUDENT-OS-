#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const all = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };

for (const [name, expected] of Object.entries(all)) {
  assert.match(expected, /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/, `${name} must be pinned to an exact version`);
  const installedPath = path.join(root, 'node_modules', ...name.split('/'), 'package.json');
  let installed;
  try {
    installed = JSON.parse(await readFile(installedPath, 'utf8'));
  } catch {
    throw new Error(`Missing installed dependency: ${name}@${expected}`);
  }
  assert.equal(installed.version, expected, `${name} installed version differs from package.json`);
}

const major = Number(process.versions.node.split('.')[0]);
assert.ok(major >= 22, `Node 22+ is required; found ${process.versions.node}`);
console.log(`NEXA dependency verification passed (${Object.keys(all).length} direct packages; Node ${process.versions.node}).`);
