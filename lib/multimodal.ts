import type { ModelMessage } from 'ai';

export type MultimodalKind = 'image' | 'pdf' | 'text' | 'audio' | 'unknown';

export type IncomingAttachment = {
  filename: string;
  mediaType: string;
  data: string;
  size: number;
};

export type NormalizedAttachment = IncomingAttachment & {
  kind: MultimodalKind;
  byteSize: number;
};

export type VoiceInput = {
  transcript?: string | null;
  durationMs?: number | null;
  source?: 'microphone' | 'imported' | 'unknown';
};

export const MAX_ATTACHMENT_BYTES = 3 * 1024 * 1024;
export const MAX_ATTACHMENT_COUNT = 4;
export const MAX_TEXT_LENGTH = 16_000;
export const MAX_EXTRACTED_TEXT_CHARS = 200_000;

const ALLOWED_MEDIA_TYPES = new Set([
  'application/pdf',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/json',
  'text/html',
  'text/xml',
  'application/xml',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const TEXT_MEDIA_TYPES = new Set([
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/json',
  'text/html',
  'text/xml',
  'application/xml',
]);

const AUDIO_MEDIA_TYPES = new Set([
  'audio/mpeg',
  'audio/mp4',
  'audio/wav',
  'audio/webm',
  'audio/ogg',
]);

function decodeDataUrl(dataUrl: string, mediaType: string) {
  const prefix = `data:${mediaType};base64,`;
  if (!dataUrl.startsWith(prefix)) throw new Error(`Invalid data URL for ${mediaType}.`);
  const base64 = dataUrl.slice(prefix.length);
  if (!base64 || /[^A-Za-z0-9+/=\r\n]/.test(base64)) throw new Error('Attachment data is not valid base64.');
  return Buffer.from(base64, 'base64');
}

function hasSignature(bytes: Buffer, expected: number[]) {
  if (bytes.length < expected.length) return false;
  return expected.every((value, index) => bytes[index] === value);
}

function validateSignature(mediaType: string, bytes: Buffer) {
  if (mediaType === 'application/pdf') return hasSignature(bytes, [0x25, 0x50, 0x44, 0x46]);
  if (mediaType === 'image/png') return hasSignature(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (mediaType === 'image/jpeg') return hasSignature(bytes, [0xff, 0xd8, 0xff]);
  if (mediaType === 'image/gif') {
    const header = bytes.subarray(0, 6).toString('ascii');
    return header === 'GIF87a' || header === 'GIF89a';
  }
  if (mediaType === 'image/webp') {
    return bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP';
  }
  return true;
}

export function classifyMediaType(mediaType: string): MultimodalKind {
  if (mediaType.startsWith('image/')) return 'image';
  if (mediaType === 'application/pdf') return 'pdf';
  if (TEXT_MEDIA_TYPES.has(mediaType)) return 'text';
  if (AUDIO_MEDIA_TYPES.has(mediaType) || mediaType.startsWith('audio/')) return 'audio';
  return 'unknown';
}

export function normalizeAttachments(raw: unknown[]): NormalizedAttachment[] {
  if (raw.length > MAX_ATTACHMENT_COUNT) {
    throw new Error(`Attach up to ${MAX_ATTACHMENT_COUNT} files per message.`);
  }

  return raw.map((value, index) => {
    if (!value || typeof value !== 'object') throw new Error(`Attachment ${index + 1} is invalid.`);
    const item = value as Record<string, unknown>;
    const filename = String(item.filename ?? 'attachment').trim().slice(0, 160);
    const mediaType = String(item.mediaType ?? '').toLowerCase();
    const data = String(item.data ?? '');
    const declaredSize = Number(item.size ?? 0);

    if (!filename || !ALLOWED_MEDIA_TYPES.has(mediaType)) {
      throw new Error(`${filename || `Attachment ${index + 1}`} is unsupported.`);
    }
    if (!data.startsWith(`data:${mediaType};base64,`)) throw new Error(`${filename} has invalid attachment encoding.`);
    if (!Number.isFinite(declaredSize) || declaredSize < 0 || declaredSize > MAX_ATTACHMENT_BYTES) {
      throw new Error(`${filename} exceeds the 3 MB attachment limit.`);
    }

    const bytes = decodeDataUrl(data, mediaType);
    if (bytes.length === 0 || bytes.length > MAX_ATTACHMENT_BYTES) throw new Error(`${filename} exceeds the 3 MB attachment limit.`);

    // Reject obvious MIME spoofing for binary formats while keeping text formats permissive.
    if (!TEXT_MEDIA_TYPES.has(mediaType) && !validateSignature(mediaType, bytes)) {
      throw new Error(`${filename} does not match its declared file type.`);
    }

    const sizeDelta = Math.abs(bytes.length - declaredSize);
    const allowedDelta = Math.max(2_048, Math.ceil(bytes.length * 0.05));
    if (declaredSize > 0 && sizeDelta > allowedDelta) {
      throw new Error(`${filename} has inconsistent size metadata.`);
    }

    return {
      filename,
      mediaType,
      data,
      size: declaredSize || bytes.length,
      kind: classifyMediaType(mediaType),
      byteSize: bytes.length,
    } satisfies NormalizedAttachment;
  });
}

export function extractTextFromAttachment(attachment: NormalizedAttachment) {
  if (attachment.kind !== 'text') return null;
  const bytes = decodeDataUrl(attachment.data, attachment.mediaType);
  return bytes.toString('utf8').replace(/\u0000/g, '').slice(0, MAX_EXTRACTED_TEXT_CHARS);
}

export function buildModelMessages(messages: Array<{ role: 'user' | 'assistant'; content: string }>, attachments: NormalizedAttachment[], voice?: VoiceInput | null): ModelMessage[] {
  return messages.map((message, index) => {
    const isLatestUser = message.role === 'user' && index === messages.length - 1;
    if (!isLatestUser) return { role: message.role, content: message.content.slice(0, MAX_TEXT_LENGTH) };
    if (!attachments.length && !voice?.transcript?.trim()) return { role: 'user', content: message.content.slice(0, MAX_TEXT_LENGTH) };

    const content: Array<
      | { type: 'text'; text: string }
      | { type: 'file'; data: string; mediaType: string; filename: string }
    > = [{ type: 'text', text: message.content.slice(0, MAX_TEXT_LENGTH) }];

    const voiceTranscript = voice?.transcript?.trim().slice(0, MAX_TEXT_LENGTH) ?? '';
    const normalizedMessage = message.content.trim().replace(/\s+/g, ' ').toLowerCase();
    const normalizedTranscript = voiceTranscript.replace(/\s+/g, ' ').toLowerCase();
    if (voiceTranscript && !normalizedMessage.includes(normalizedTranscript)) {
      content.push({ type: 'text', text: `\n\n--- Voice transcript ---\n${voiceTranscript}\n--- End voice transcript ---` });
    }

    for (const attachment of attachments) {
      const extractedText = extractTextFromAttachment(attachment);
      if (extractedText !== null) {
        content.push({
          type: 'text',
          text: `\n\n--- Attached ${attachment.kind}: ${attachment.filename} ---\n${extractedText}\n--- End attached ${attachment.kind} ---`,
        });
      } else {
        content.push({
          type: 'file',
          data: attachment.data,
          mediaType: attachment.mediaType,
          filename: attachment.filename,
        });
      }
    }

    return { role: 'user', content };
  });
}

export function buildAttachmentManifest(attachments: NormalizedAttachment[], voice?: VoiceInput | null) {
  return {
    attachments: attachments.map((attachment) => ({
      filename: attachment.filename,
      mediaType: attachment.mediaType,
      size: attachment.size,
      byteSize: attachment.byteSize,
      kind: attachment.kind,
    })),
    voice: voice?.transcript?.trim()
      ? {
          transcriptPresent: true,
          durationMs: Number.isFinite(Number(voice.durationMs)) ? Number(voice.durationMs) : null,
          source: voice.source ?? 'unknown',
        }
      : null,
  };
}

export function validateVoiceInput(input: unknown): VoiceInput | null {
  if (!input || typeof input !== 'object') return null;
  const value = input as Record<string, unknown>;
  const transcript = String(value.transcript ?? '').trim().slice(0, MAX_TEXT_LENGTH);
  if (!transcript) return null;
  const durationMs = value.durationMs == null ? null : Number(value.durationMs);
  if (durationMs !== null && (!Number.isFinite(durationMs) || durationMs < 0 || durationMs > 15 * 60 * 1000)) {
    throw new Error('Voice duration is invalid.');
  }
  const rawSource = String(value.source ?? 'unknown');
  const source = rawSource === 'microphone' || rawSource === 'imported' ? rawSource : 'unknown';
  return { transcript, durationMs, source };
}
