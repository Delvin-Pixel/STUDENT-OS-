#!/usr/bin/env node
import assert from 'node:assert/strict';
import { rm, mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const temp = path.join(tmpdir(), `nexa-idempotency-${randomUUID()}`);
await mkdir(temp, { recursive: true });
try {
  const source = path.join(root, 'lib/idempotency-core.ts');
  const shim = path.join(temp, 'shim.d.ts');
  await writeFile(shim, "declare module 'node:crypto' { export function createHash(algorithm: string): { update(input: string): any; digest(encoding: string): string; }; }\n");
  const tsc = process.platform === 'win32' ? 'tsc.cmd' : 'tsc';
  execFileSync(tsc, [source, shim, '--target', 'ES2022', '--module', 'commonjs', '--outDir', temp, '--skipLibCheck'], { stdio: 'inherit' });
  const core = await import(`file://${path.join(temp, 'idempotency-core.js')}`);

  assert.equal(core.validateIdempotencyKey('abc12345'), 'abc12345');
  assert.equal(core.validateIdempotencyKey('too short'), null);
  assert.equal(core.validateIdempotencyKey('bad/key-123'), null);
  assert.equal(core.validateIdempotencyKey('ABC-1234_xyz:99'), 'ABC-1234_xyz:99');

  const left = core.hashRequestBody({ title: 'Hello', projectId: 'p1' });
  const right = core.hashRequestBody({ projectId: 'p1', title: 'Hello' });
  const different = core.hashRequestBody({ projectId: 'p1', title: 'Different' });
  assert.equal(left, right);
  assert.notEqual(left, different);

  console.log('NEXA idempotency contract tests passed.');
} finally {
  await rm(temp, { recursive: true, force: true });
}
