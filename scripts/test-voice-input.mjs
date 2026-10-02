#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const voice = await readFile(new URL('../lib/voice.ts', import.meta.url), 'utf8');
const route = await readFile(new URL('../app/api/voice/transcribe/route.ts', import.meta.url), 'utf8');
const chat = await readFile(new URL('../components/nexa-chat.tsx', import.meta.url), 'utf8');
const multimodal = await readFile(new URL('../lib/multimodal.ts', import.meta.url), 'utf8');
const env = await readFile(new URL('../.env.local.example', import.meta.url), 'utf8');

assert.match(voice, /experimental_transcribe as transcribe/);
assert.match(voice, /gateway\.transcriptionModel\(config\.model\)/);
assert.match(voice, /NEXA_TRANSCRIPTION_MODEL/);
assert.match(voice, /AbortSignal\.timeout\(config\.timeoutMs\)/);
assert.match(voice, /VOICE_TOO_LARGE/);
assert.match(voice, /validateAudioSignature/);
assert.match(voice, /AI_GATEWAY_API_KEY/);
assert.match(route, /requireUser\(\)/);
assert.match(route, /readJsonBody/);
assert.match(route, /enforceUserMutationRateLimit/);
assert.match(route, /transcribeVoiceAudio/);
assert.match(chat, /navigator\.mediaDevices\.getUserMedia/);
assert.match(chat, /new MediaRecorder/);
assert.match(chat, /\/api\/voice\/transcribe/);
assert.match(chat, /voice: outgoingVoice/);
assert.match(chat, /voiceStreamRef\.current\?\.getTracks\(\)\.forEach/);
assert.match(multimodal, /!normalizedMessage\.includes\(normalizedTranscript\)/);
assert.match(env, /NEXA_TRANSCRIPTION_MODEL=/);
console.log('NEXA first-class voice input contract tests passed.');
