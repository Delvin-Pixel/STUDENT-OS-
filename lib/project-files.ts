import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import { query, withTransaction } from '@/lib/db';
import { markProjectFileSemanticPending } from '@/lib/project-semantic';

export const PROJECT_FILE_MEDIA_TYPES = [
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/json',
  'text/html',
  'text/css',
  'text/javascript',
  'text/typescript',
  'text/x-python',
  'application/sql',
  'application/xml',
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;

export type ProjectFileMediaType = (typeof PROJECT_FILE_MEDIA_TYPES)[number];

export const RICH_PROJECT_FILE_MEDIA_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
export type RichProjectFileMediaType = (typeof RICH_PROJECT_FILE_MEDIA_TYPES)[number];

export function isRichProjectFileMediaType(value: string): value is RichProjectFileMediaType {
  return RICH_PROJECT_FILE_MEDIA_TYPES.includes(value as RichProjectFileMediaType);
}

export type ProjectFile = {
  id: string;
  project_id: string;
  filename: string;
  media_type: ProjectFileMediaType;
  content: string;
  size_bytes: number;
  sha256: string;
  version: number;
  created_at: string;
  updated_at: string;
  source_kind: 'text' | 'rich';
  source_media_type: ProjectFileMediaType;
  source_size_bytes: number;
  source_sha256: string;
  extraction_status: 'not_required' | 'pending' | 'ready' | 'failed';
  extraction_model?: string | null;
  extraction_failure_code?: string | null;
  extraction_updated_at?: string | null;
  semantic_status?: 'pending' | 'ready' | 'failed' | null;
  semantic_model?: string | null;
  semantic_chunk_count?: number | null;
  semantic_failure_code?: string | null;
  semantic_updated_at?: string | null;
};

export class ProjectFileConflictError extends Error {
  constructor(public readonly currentVersion: number) {
    super('Project file has changed since it was loaded.');
    this.name = 'ProjectFileConflictError';
  }
}

export class ProjectFileNameConflictError extends Error {
  constructor() {
    super('A file with that name already exists in this project.');
    this.name = 'ProjectFileNameConflictError';
  }
}

const MIME_BY_EXTENSION: Record<string, ProjectFileMediaType> = {
  txt: 'text/plain',
  md: 'text/markdown',
  markdown: 'text/markdown',
  csv: 'text/csv',
  json: 'application/json',
  html: 'text/html',
  htm: 'text/html',
  css: 'text/css',
  js: 'text/javascript',
  jsx: 'text/javascript',
  ts: 'text/typescript',
  tsx: 'text/typescript',
  py: 'text/x-python',
  sql: 'application/sql',
  xml: 'application/xml',
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
};

export function getProjectFileLimit(plan: 'free' | 'premium') {
  return plan === 'premium' ? 100 : 20;
}

export function getProjectFileContentLimit(plan: 'free' | 'premium') {
  return plan === 'premium' ? 500_000 : 120_000;
}

export function sanitizeProjectFilename(value: unknown) {
  const normalized = String(value ?? '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
  if (!normalized || normalized === '.' || normalized === '..') throw new Error('A valid project filename is required.');
  return normalized;
}

export function inferProjectFileMediaType(filename: string, requested?: unknown): ProjectFileMediaType {
  const extension = filename.split('.').pop()?.toLowerCase() ?? '';
  const inferred = MIME_BY_EXTENSION[extension];
  const explicit = String(requested ?? '').trim().toLowerCase();
  if (explicit && PROJECT_FILE_MEDIA_TYPES.includes(explicit as ProjectFileMediaType)) {
    if (inferred && explicit !== inferred) throw new Error('File type does not match its filename extension.');
    return explicit as ProjectFileMediaType;
  }
  if (!inferred) throw new Error('Unsupported project file type. Use a supported text file, PDF, JPEG, PNG, WebP, or GIF.');
  return inferred;
}

function normalizeContent(value: unknown, plan: 'free' | 'premium') {
  const content = String(value ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const bytes = Buffer.byteLength(content, 'utf8');
  if (!content.trim()) throw new Error('Project file content is required.');
  if (bytes > getProjectFileContentLimit(plan)) throw new Error(`Project file exceeds the ${getProjectFileContentLimit(plan).toLocaleString()} byte limit for ${plan}.`);
  return { content, bytes };
}

export function sha256ProjectText(content: string) {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

async function assertProjectOwnership(client: PoolClient, userId: string, projectId: string) {
  const project = await client.query<{ id: string }>('select id from projects where id = $1 and user_id = $2 limit 1', [projectId, userId]);
  if (!project.rows[0]) throw new Error('Project not found.');
}

function mapUniqueError(error: unknown): never {
  if (typeof error === 'object' && error && 'code' in error && (error as { code?: string }).code === '23505') {
    throw new ProjectFileNameConflictError();
  }
  throw error;
}

export async function listProjectFiles(userId: string, projectId: string, limit = 100) {
  const result = await query<Omit<ProjectFile, 'content'>>(
    `select f.id, f.project_id, f.filename, f.media_type, f.size_bytes, f.sha256, f.version, f.created_at, f.updated_at,
            f.source_kind, f.source_media_type, f.source_size_bytes, f.source_sha256,
            f.extraction_status, f.extraction_model, f.extraction_failure_code, f.extraction_updated_at,
            s.status as semantic_status, s.model_id as semantic_model, s.chunk_count as semantic_chunk_count,
            s.failure_code as semantic_failure_code, s.updated_at as semantic_updated_at
     from project_files f
     left join project_file_embedding_states s on s.file_id = f.id and s.user_id = f.user_id and s.project_id = f.project_id
     where f.user_id = $1 and f.project_id = $2
     order by f.updated_at desc
     limit $3`,
    [userId, projectId, Math.max(1, Math.min(200, limit))],
  );
  return result.rows;
}

export async function getProjectFile(userId: string, projectId: string, fileId: string) {
  const result = await query<ProjectFile>(
    `select f.id, f.project_id, f.filename, f.media_type, f.content, f.size_bytes, f.sha256, f.version, f.created_at, f.updated_at,
            f.source_kind, f.source_media_type, f.source_size_bytes, f.source_sha256,
            f.extraction_status, f.extraction_model, f.extraction_failure_code, f.extraction_updated_at,
            s.status as semantic_status, s.model_id as semantic_model, s.chunk_count as semantic_chunk_count,
            s.failure_code as semantic_failure_code, s.updated_at as semantic_updated_at
     from project_files f
     left join project_file_embedding_states s on s.file_id = f.id and s.user_id = f.user_id and s.project_id = f.project_id
     where f.id = $1 and f.user_id = $2 and f.project_id = $3
     limit 1`,
    [fileId, userId, projectId],
  );
  return result.rows[0] ?? null;
}

export async function createProjectFile(params: {
  userId: string;
  plan: 'free' | 'premium';
  projectId: string;
  filename: string;
  mediaType?: string | null;
  content: string;
}) {
  const filename = sanitizeProjectFilename(params.filename);
  const mediaType = inferProjectFileMediaType(filename, params.mediaType);
  if (isRichProjectFileMediaType(mediaType)) {
    throw new Error('PDF and image project files must use the rich-file upload endpoint.');
  }
  const normalized = normalizeContent(params.content, params.plan);

  return withTransaction(async (client) => {
    await client.query('select id from users where id = $1 for update', [params.userId]);
    await assertProjectOwnership(client, params.userId, params.projectId);
    const count = await client.query<{ count: string }>(
      'select count(*)::text as count from project_files where user_id = $1 and project_id = $2',
      [params.userId, params.projectId],
    );
    if (Number(count.rows[0]?.count ?? 0) >= getProjectFileLimit(params.plan)) {
      throw new Error(`Your ${params.plan} project file limit has been reached.`);
    }

    try {
      const result = await client.query<ProjectFile>(
        `insert into project_files
           (user_id, project_id, filename, media_type, content, size_bytes, sha256,
            source_kind, source_media_type, source_size_bytes, source_sha256, extraction_status)
         values ($1, $2, $3, $4, $5, $6, $7, 'text', $4, $6, $7, 'not_required')
         returning id, project_id, filename, media_type, content, size_bytes, sha256, version, created_at, updated_at,
                   source_kind, source_media_type, source_size_bytes, source_sha256, extraction_status,
                   extraction_model, extraction_failure_code, extraction_updated_at`,
        [params.userId, params.projectId, filename, mediaType, normalized.content, normalized.bytes, sha256ProjectText(normalized.content)],
      );
      const file = result.rows[0];
      await markProjectFileSemanticPending(client, { fileId: file.id, userId: params.userId, projectId: params.projectId, contentSha256: file.sha256 });
      await client.query('update projects set updated_at = now() where id = $1 and user_id = $2', [params.projectId, params.userId]);
      return file;
    } catch (error) {
      mapUniqueError(error);
    }
  });
}

export async function updateProjectFile(
  userId: string,
  plan: 'free' | 'premium',
  projectId: string,
  fileId: string,
  patch: { filename?: string; mediaType?: string; content?: string; expectedVersion?: number },
) {
  return withTransaction(async (client) => {
    await assertProjectOwnership(client, userId, projectId);
    const currentResult = await client.query<ProjectFile>(
      `select id, project_id, filename, media_type, content, size_bytes, sha256, version, created_at, updated_at,
              source_kind, source_media_type, source_size_bytes, source_sha256, extraction_status,
              extraction_model, extraction_failure_code, extraction_updated_at
       from project_files
       where id = $1 and user_id = $2 and project_id = $3
       for update`,
      [fileId, userId, projectId],
    );
    const current = currentResult.rows[0];
    if (!current) throw new Error('Project file not found.');
    if (patch.expectedVersion !== undefined && patch.expectedVersion !== current.version) {
      throw new ProjectFileConflictError(current.version);
    }

    const filename = patch.filename === undefined ? current.filename : sanitizeProjectFilename(patch.filename);
    const mediaType = inferProjectFileMediaType(filename, patch.mediaType ?? (patch.filename === undefined ? current.media_type : undefined));
    if (current.source_kind === 'rich' && patch.content !== undefined) {
      throw new Error('Derived rich-file text is managed by extraction and cannot be edited directly.');
    }
    const normalized = patch.content === undefined
      ? { content: current.content, bytes: current.size_bytes }
      : normalizeContent(patch.content, plan);

    try {
      const result = await client.query<ProjectFile>(
        `update project_files
         set filename = $1,
             media_type = $2,
             content = $3,
             size_bytes = $4,
             sha256 = $5,
             source_media_type = case when source_kind = 'text' then $2 else source_media_type end,
             source_size_bytes = case when source_kind = 'text' then $4 else source_size_bytes end,
             source_sha256 = case when source_kind = 'text' then $5 else source_sha256 end,
             version = version + 1,
             updated_at = now()
         where id = $6 and user_id = $7 and project_id = $8 and version = $9
         returning id, project_id, filename, media_type, content, size_bytes, sha256, version, created_at, updated_at,
                   source_kind, source_media_type, source_size_bytes, source_sha256, extraction_status,
                   extraction_model, extraction_failure_code, extraction_updated_at`,
        [filename, mediaType, normalized.content, normalized.bytes, sha256ProjectText(normalized.content), fileId, userId, projectId, current.version],
      );
      if (!result.rows[0]) throw new ProjectFileConflictError(current.version);
      const file = result.rows[0];
      if (patch.content !== undefined) {
        await markProjectFileSemanticPending(client, { fileId: file.id, userId, projectId, contentSha256: file.sha256 });
      }
      await client.query('update projects set updated_at = now() where id = $1 and user_id = $2', [projectId, userId]);
      return file;
    } catch (error) {
      if (error instanceof ProjectFileConflictError) throw error;
      mapUniqueError(error);
    }
  });
}

export async function deleteProjectFile(userId: string, projectId: string, fileId: string) {
  return withTransaction(async (client) => {
    const deleted = await client.query<{ id: string }>(
      'delete from project_files where id = $1 and user_id = $2 and project_id = $3 returning id',
      [fileId, userId, projectId],
    );
    if (!deleted.rows[0]) throw new Error('Project file not found.');
    await client.query('update projects set updated_at = now() where id = $1 and user_id = $2', [projectId, userId]);
    return true;
  });
}
