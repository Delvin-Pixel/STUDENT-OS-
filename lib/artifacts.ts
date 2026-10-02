import { query, withTransaction } from '@/lib/db';
import type { PoolClient } from 'pg';

export type ArtifactType = 'document' | 'report' | 'code' | 'data' | 'note';

export class ArtifactConflictError extends Error {
  constructor(public readonly currentVersion: number) {
    super('Artifact has changed since it was loaded.');
    this.name = 'ArtifactConflictError';
  }
}

export type Artifact = {
  id: string;
  project_id: string | null;
  conversation_id: string | null;
  title: string;
  filename: string;
  artifact_type: ArtifactType;
  mime_type: string;
  language: string | null;
  content: string;
  metadata: Record<string, unknown>;
  version: number;
  created_at: string;
  updated_at: string;
};

export function getArtifactLimit(plan: 'free' | 'premium') {
  return plan === 'premium' ? 200 : 30;
}

export function getArtifactContentLimit(plan: 'free' | 'premium') {
  return plan === 'premium' ? 500_000 : 120_000;
}

const MIME_BY_EXTENSION: Record<string, string> = {
  md: 'text/markdown',
  markdown: 'text/markdown',
  txt: 'text/plain',
  json: 'application/json',
  csv: 'text/csv',
  html: 'text/html',
  css: 'text/css',
  js: 'text/javascript',
  jsx: 'text/javascript',
  ts: 'text/typescript',
  tsx: 'text/typescript',
  py: 'text/x-python',
  sql: 'application/sql',
  xml: 'application/xml',
};

const TYPE_EXTENSIONS: Record<ArtifactType, string> = {
  document: 'md',
  report: 'md',
  code: 'txt',
  data: 'json',
  note: 'md',
};

function normalizeText(value: unknown, max: number) {
  return String(value ?? '').replace(/\r\n/g, '\n').trim().slice(0, max);
}

function sanitizeFilename(value: unknown, fallback: string) {
  const raw = String(value ?? '').trim().replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120);
  return raw || fallback;
}

function inferFilename(title: string, type: ArtifactType, language?: string | null) {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70) || 'nexa-artifact';
  const languageMap: Record<string, string> = { typescript: 'ts', ts: 'ts', tsx: 'tsx', javascript: 'js', js: 'js', jsx: 'jsx', python: 'py', py: 'py', sql: 'sql', css: 'css', html: 'html', json: 'json' };
  const normalizedLanguage = language?.toLowerCase().trim();
  const extension = type === 'code' && normalizedLanguage ? (languageMap[normalizedLanguage] ?? (normalizedLanguage.replace(/[^a-z0-9]/g, '').slice(0, 6) || 'txt')) : TYPE_EXTENSIONS[type];
  return `${slug}.${extension}`;
}

function inferMime(filename: string, explicit?: string) {
  if (explicit?.trim()) return explicit.trim();
  const extension = filename.split('.').pop()?.toLowerCase() ?? '';
  return MIME_BY_EXTENSION[extension] ?? 'text/plain';
}

async function assertProjectOwnership(client: PoolClient, userId: string, projectId: string | null) {
  if (!projectId) return;
  const result = await client.query('select id from projects where id = $1 and user_id = $2 limit 1', [projectId, userId]);
  if (!result.rows[0]) throw new Error('Project not found.');
}

async function assertConversationOwnership(client: PoolClient, userId: string, conversationId: string | null, projectId: string | null) {
  if (!conversationId) return;
  const result = await client.query<{ id: string; project_id: string | null }>(
    'select id, project_id from conversations where id = $1 and user_id = $2 limit 1',
    [conversationId, userId],
  );
  if (!result.rows[0]) throw new Error('Conversation not found.');
  if (projectId && result.rows[0].project_id !== projectId) throw new Error('Conversation does not belong to that project.');
}

export async function listArtifacts(userId: string, options: { projectId?: string | null; conversationId?: string | null; limit?: number } = {}) {
  const conditions = ['user_id = $1'];
  const values: unknown[] = [userId];

  if (options.projectId) {
    values.push(options.projectId);
    conditions.push(`project_id = $${values.length}`);
  }
  if (options.conversationId) {
    values.push(options.conversationId);
    conditions.push(`conversation_id = $${values.length}`);
  }

  const limit = Math.max(1, Math.min(100, options.limit ?? 50));
  const result = await query<Artifact>(
    `select id, project_id, conversation_id, title, filename, artifact_type, mime_type, language, content, metadata, version, created_at, updated_at
     from artifacts
     where ${conditions.join(' and ')}
     order by updated_at desc
     limit ${limit}`,
    values,
  );
  return result.rows;
}

export async function getArtifact(userId: string, id: string, projectId?: string | null) {
  const result = await query<Artifact>(
    `select id, project_id, conversation_id, title, filename, artifact_type, mime_type, language, content, metadata, version, created_at, updated_at
     from artifacts
     where id = $1 and user_id = $2
       and ($3::uuid is null or project_id is null or project_id = $3::uuid)
     limit 1`,
    [id, userId, projectId ?? null],
  );
  return result.rows[0] ?? null;
}

export async function createArtifact(params: {
  userId: string;
  plan: 'free' | 'premium';
  projectId?: string | null;
  conversationId?: string | null;
  title: string;
  filename?: string | null;
  type: ArtifactType;
  mimeType?: string | null;
  language?: string | null;
  content: string;
  metadata?: Record<string, unknown>;
  client?: PoolClient;
}) {
  const title = normalizeText(params.title, 120);
  const content = normalizeText(params.content, getArtifactContentLimit(params.plan));
  const type = params.type;
  if (!title) throw new Error('Artifact title is required.');
  if (!content) throw new Error('Artifact content is required.');
  if (!['document', 'report', 'code', 'data', 'note'].includes(type)) throw new Error('Unsupported artifact type.');

  const create = async (client: PoolClient) => {
    await client.query('select id from users where id = $1 for update', [params.userId]);
    const count = await client.query<{ count: string }>('select count(*)::text as count from artifacts where user_id = $1', [params.userId]);
    if (Number(count.rows[0]?.count ?? 0) >= getArtifactLimit(params.plan)) {
      throw new Error(`Your ${params.plan} artifact limit has been reached.`);
    }

    await assertProjectOwnership(client, params.userId, params.projectId ?? null);
    await assertConversationOwnership(client, params.userId, params.conversationId ?? null, params.projectId ?? null);

    const filename = sanitizeFilename(params.filename, inferFilename(title, type, params.language));
    const mimeType = inferMime(filename, params.mimeType ?? undefined);
    const metadata = params.metadata ?? {};

    const result = await client.query<Artifact>(
      `insert into artifacts (user_id, project_id, conversation_id, title, filename, artifact_type, mime_type, language, content, metadata)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
       returning id, project_id, conversation_id, title, filename, artifact_type, mime_type, language, content, metadata, version, created_at, updated_at`,
      [params.userId, params.projectId ?? null, params.conversationId ?? null, title, filename, type, mimeType, params.language?.trim().slice(0, 40) || null, content, JSON.stringify(metadata)],
    );
    return result.rows[0];
  };

  return params.client ? create(params.client) : withTransaction(create);
}

export async function updateArtifact(userId: string, plan: 'free' | 'premium', id: string, patch: { title?: string; filename?: string; content?: string; mimeType?: string; language?: string; metadata?: Record<string, unknown>; expectedVersion?: number }, projectId?: string | null) {
  return withTransaction(async (client) => {
    const currentResult = await client.query<Artifact>(
      `select id, project_id, conversation_id, title, filename, artifact_type, mime_type, language, content, metadata, version, created_at, updated_at
       from artifacts
       where id = $1 and user_id = $2
         and ($3::uuid is null or project_id is null or project_id = $3::uuid)
       for update`,
      [id, userId, projectId ?? null],
    );
    const current = currentResult.rows[0];
    if (!current) throw new Error('Artifact not found.');
    if (patch.expectedVersion !== undefined && patch.expectedVersion !== current.version) {
      throw new ArtifactConflictError(current.version);
    }

    const title = patch.title === undefined ? current.title : normalizeText(patch.title, 120);
    const content = patch.content === undefined ? current.content : normalizeText(patch.content, getArtifactContentLimit(plan));
    if (!title) throw new Error('Artifact title is required.');
    if (!content) throw new Error('Artifact content is required.');
    const filename = patch.filename === undefined ? current.filename : sanitizeFilename(patch.filename, current.filename);
    const mimeType = inferMime(filename, patch.mimeType ?? current.mime_type);
    const language = patch.language === undefined ? current.language : normalizeText(patch.language, 40);
    const metadata = patch.metadata === undefined ? current.metadata : patch.metadata;

    const result = await client.query<Artifact>(
      `update artifacts
       set title = $1, filename = $2, content = $3, mime_type = $4, language = $5, metadata = $6::jsonb, version = version + 1, updated_at = now()
       where id = $7 and user_id = $8 and version = $9
       returning id, project_id, conversation_id, title, filename, artifact_type, mime_type, language, content, metadata, version, created_at, updated_at`,
      [title, filename, content, mimeType, language || null, JSON.stringify(metadata), id, userId, current.version],
    );
    if (!result.rows[0]) {
      const latest = await client.query<{ version: number }>('select version from artifacts where id = $1 and user_id = $2 limit 1', [id, userId]);
      throw new ArtifactConflictError(Number(latest.rows[0]?.version ?? current.version));
    }
    return result.rows[0];
  });
}

export async function deleteArtifact(userId: string, id: string) {
  const result = await query('delete from artifacts where id = $1 and user_id = $2 returning id', [id, userId]);
  if (!result.rows[0]) throw new Error('Artifact not found.');
  return true;
}
