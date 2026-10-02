import type { PoolClient } from 'pg';

export const MAX_EXTERNAL_MESSAGE_SOURCES = 8;

export type ExternalSourceSnapshot = {
  provider: 'tako';
  url: string;
  title: string;
  excerpt: string;
  sourceUpdatedAt: string | null;
};

const URL_KEYS = ['url', 'href', 'link', 'sourceUrl', 'source_url'];
const TITLE_KEYS = ['title', 'name', 'headline', 'siteName', 'site_name'];
const EXCERPT_KEYS = ['snippet', 'description', 'summary', 'text', 'content'];
const DATE_KEYS = ['publishedAt', 'published_at', 'updatedAt', 'updated_at', 'date', 'published'];

function bounded(value: unknown, max: number) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function firstString(record: Record<string, unknown>, keys: string[], max: number) {
  for (const key of keys) {
    const value = bounded(record[key], max);
    if (value) return value;
  }
  return '';
}

export function normalizeExternalSourceUrl(value: unknown) {
  const raw = bounded(value, 2048);
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    parsed.username = '';
    parsed.password = '';
    parsed.hash = '';
    return parsed.toString().slice(0, 2048);
  } catch {
    return null;
  }
}

function safeIsoDate(value: unknown) {
  const raw = bounded(value, 120);
  if (!raw) return null;
  const timestamp = Date.parse(raw);
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp).toISOString();
}

function candidateFromRecord(provider: ExternalSourceSnapshot['provider'], record: Record<string, unknown>) {
  let url: string | null = null;
  for (const key of URL_KEYS) {
    url = normalizeExternalSourceUrl(record[key]);
    if (url) break;
  }
  if (!url) return null;

  const parsed = new URL(url);
  const title = firstString(record, TITLE_KEYS, 300) || parsed.hostname;
  const excerpt = firstString(record, EXCERPT_KEYS, 600) || `Web source from ${parsed.hostname}.`;
  let sourceUpdatedAt: string | null = null;
  for (const key of DATE_KEYS) {
    sourceUpdatedAt = safeIsoDate(record[key]);
    if (sourceUpdatedAt) break;
  }
  return { provider, url, title, excerpt, sourceUpdatedAt } satisfies ExternalSourceSnapshot;
}

export function collectExternalSourceSnapshots(provider: ExternalSourceSnapshot['provider'], value: unknown) {
  const output: ExternalSourceSnapshot[] = [];
  const seenUrls = new Set<string>();
  const seenObjects = new Set<object>();
  let visited = 0;

  const visit = (node: unknown, depth: number) => {
    if (output.length >= MAX_EXTERNAL_MESSAGE_SOURCES || depth > 5 || visited >= 240) return;
    if (!node || typeof node !== 'object') return;
    if (seenObjects.has(node as object)) return;
    seenObjects.add(node as object);
    visited += 1;

    if (Array.isArray(node)) {
      for (const item of node) visit(item, depth + 1);
      return;
    }

    const record = node as Record<string, unknown>;
    const candidate = candidateFromRecord(provider, record);
    if (candidate && !seenUrls.has(candidate.url)) {
      seenUrls.add(candidate.url);
      output.push(candidate);
      if (output.length >= MAX_EXTERNAL_MESSAGE_SOURCES) return;
    }
    for (const child of Object.values(record)) visit(child, depth + 1);
  };

  visit(value, 0);
  return output;
}

export function mergeExternalSourceSnapshots(target: ExternalSourceSnapshot[], incoming: ExternalSourceSnapshot[]) {
  const seen = new Set(target.map((source) => source.url));
  for (const source of incoming) {
    if (target.length >= MAX_EXTERNAL_MESSAGE_SOURCES) break;
    if (seen.has(source.url)) continue;
    seen.add(source.url);
    target.push(source);
  }
  return target;
}

export async function persistExternalMessageSources(
  client: PoolClient,
  params: {
    messageId: string;
    conversationId: string;
    userId: string;
    sources: ExternalSourceSnapshot[];
  },
) {
  const sources = params.sources.slice(0, MAX_EXTERNAL_MESSAGE_SOURCES);
  for (let index = 0; index < sources.length; index += 1) {
    const source = sources[index];
    await client.query(
      `insert into assistant_message_external_sources
         (message_id, conversation_id, user_id, source_order, source_label, provider, source_url, title, excerpt, source_updated_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::timestamptz)
       on conflict (message_id, source_url) do nothing`,
      [
        params.messageId,
        params.conversationId,
        params.userId,
        index + 1,
        `W${index + 1}`,
        source.provider,
        source.url,
        bounded(source.title, 300) || 'Web source',
        bounded(source.excerpt, 1200) || 'External web evidence.',
        source.sourceUpdatedAt,
      ],
    );
  }
}
