#!/usr/bin/env node
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { sha256Bytes, verifyMigrationManifest } from './migration-integrity.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dbDir = path.join(root, 'db');
const { files, hashes } = await verifyMigrationManifest(dbDir);
assert.equal(files.length, 42);
assert.equal(files[0], '001_initial.sql');
assert.equal(files.at(-1), '042_student_os_bridge_operational_observability.sql');
const first = await readFile(path.join(dbDir, files[0]));
assert.equal(hashes.get(files[0]), sha256Bytes(first));
assert.notEqual(sha256Bytes(Buffer.concat([first, Buffer.from('\n-- tamper') ])), hashes.get(files[0]));
console.log(`Migration integrity manifest verified (${files.length} immutable migrations).`);
