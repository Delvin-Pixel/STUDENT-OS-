#!/usr/bin/env node
import assert from 'node:assert/strict';
import { rm, mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const temp = path.join(tmpdir(), `nexa-http-${randomUUID()}`);
await mkdir(temp, { recursive: true });
try {
  const source = path.join(root, 'lib/http.ts');
  const shim = path.join(temp, 'shim.d.ts');
  await writeFile(shim, "declare module 'node:crypto' { export function randomUUID(): string; }\n");
  const tsc = process.platform === 'win32' ? 'tsc.cmd' : 'tsc';
  execFileSync(tsc, [source, shim, '--target', 'ES2022', '--module', 'commonjs', '--outDir', temp, '--skipLibCheck', '--esModuleInterop'], { stdio: 'inherit' });
  const http = await import(`file://${path.join(temp, 'http.js')}`);
  const parse = http.readJsonBody;

  const spoofable = new Request('http://nexa.test', { headers: { 'x-request-id': 'attacker-chosen-id' } });
  const generatedA = http.getRequestId(spoofable);
  const generatedB = http.getRequestId(spoofable);
  assert.equal(generatedA, generatedB, 'request ID must remain stable within one Request');
  assert.notEqual(generatedA, 'attacker-chosen-id', 'client-supplied request IDs must not control server correlation');
  assert.match(generatedA, /^[0-9a-f-]{36}$/i);

  const valid = new Request('http://nexa.test', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ok: true }) });
  assert.deepEqual(await parse(valid, 1024), { ok: true });

  const oversizedChunked = new Request('http://nexa.test', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('{"x":"12345"}')); controller.close(); } }),
    duplex: 'half',
  });
  await assert.rejects(() => parse(oversizedChunked, 8), (error) => error?.code === 'REQUEST_BODY_TOO_LARGE');

  const oversizedDeclared = new Request('http://nexa.test', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'content-length': '2048' },
    body: '{}',
  });
  await assert.rejects(() => parse(oversizedDeclared, 1024), (error) => error?.code === 'REQUEST_BODY_TOO_LARGE');

  const invalid = new Request('http://nexa.test', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{bad' });
  await assert.rejects(() => parse(invalid, 1024), (error) => error?.code === 'INVALID_JSON');

  const wrongType = new Request('http://nexa.test', { method: 'POST', headers: { 'content-type': 'text/plain' }, body: '{}' });
  await assert.rejects(() => parse(wrongType, 1024), (error) => error?.code === 'INVALID_CONTENT_TYPE');

  console.log('NEXA HTTP core tests passed.');
} finally {
  await rm(temp, { recursive: true, force: true });
}
