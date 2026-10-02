#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';

const baseUrl = String(process.argv[2] ?? process.env.NEXA_SMOKE_BASE_URL ?? '').replace(/\/$/, '');
const token = String(process.env.NEXA_DIAGNOSTICS_TOKEN ?? '');
if (!baseUrl || !/^https?:\/\//.test(baseUrl)) {
  console.error('Usage: NEXA_DIAGNOSTICS_TOKEN=... node scripts/smoke-capabilities.mjs https://your-nexa-host');
  process.exit(2);
}
if (token.length < 32) {
  console.error('NEXA_DIAGNOSTICS_TOKEN must contain the deployment diagnostics token (32+ characters).');
  process.exit(2);
}

const requested = String(process.env.NEXA_SMOKE_CHECKS ?? 'chat,embedding,richExtraction')
  .split(',').map((item) => item.trim()).filter(Boolean);
const body = { confirm: 'run-live-provider-smoke', checks: requested };

if (requested.includes('voice')) {
  const file = process.env.NEXA_SMOKE_VOICE_FILE;
  if (!file) {
    console.error('Voice smoke checks require NEXA_SMOKE_VOICE_FILE.');
    process.exit(2);
  }
  const mediaByExtension = new Map([
    ['.wav', 'audio/wav'], ['.mp3', 'audio/mpeg'], ['.webm', 'audio/webm'], ['.ogg', 'audio/ogg'], ['.m4a', 'audio/x-m4a'], ['.mp4', 'audio/mp4'], ['.flac', 'audio/flac'],
  ]);
  const bytes = await readFile(file);
  if (bytes.length > 512 * 1024) {
    console.error('Voice smoke fixture must be 512 KB or smaller.');
    process.exit(2);
  }
  const mediaType = process.env.NEXA_SMOKE_VOICE_MEDIA_TYPE || mediaByExtension.get(extname(file).toLowerCase());
  if (!mediaType) {
    console.error('Set NEXA_SMOKE_VOICE_MEDIA_TYPE for this voice fixture.');
    process.exit(2);
  }
  body.voice = { data: `data:${mediaType};base64,${bytes.toString('base64')}`, mediaType };
}

const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
const configResponse = await fetch(`${baseUrl}/api/health/capabilities`, { headers, cache: 'no-store' });
const config = await configResponse.json().catch(() => ({ error: 'invalid_json' }));
console.log(JSON.stringify({ configuration: config }, null, 2));
if (!configResponse.ok) process.exit(1);

const response = await fetch(`${baseUrl}/api/health/capabilities`, {
  method: 'POST', headers, body: JSON.stringify(body), cache: 'no-store',
});
const result = await response.json().catch(() => ({ error: 'invalid_json' }));
console.log(JSON.stringify({ smoke: result }, null, 2));
if (!response.ok) process.exit(1);
