import { embed, embedMany, gateway } from 'ai';
import type { PoolClient } from 'pg';
import { query, withTransaction } from '@/lib/db';

const DEFAULT_EMBEDDING_MODEL = 'openai/text-embedding-3-small';
const DEFAULT_EMBEDDING_DIMENSIONS = 512;
const DEFAULT_EMBEDDING_TIMEOUT_MS = 12_000;
const DEFAULT_EMBEDDING_MAX_RETRIES = 1;
const DEFAULT_CHUNK_CHARS = 6_000;
const DEFAULT_MAX_CHUNKS = 8;
const SEMANTIC_SIMILARITY_FLOOR = 0.3;

export type ProjectFileSemanticStatus = {
  file_id: string;
  content_sha256: string;
  model_id: string;
  dimensions: number | null;
  status: 'pending' | 'ready' | 'failed';
  chunk_count: number;
  failure_code: string | null;
  updated_at: string;
};

export type SemanticProjectFileMatch = {
  id: string;
  filename: string;
  mediaType: string;
  excerpt: string;
  similarity: number;
  updatedAt: string;
};

function boundedInteger(name: string, fallback: number, min: number, max: number) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer from ${min} to ${max}.`);
  }
  return value;
}

function getEmbeddingModelId() {
  const model = (process.env.NEXA_EMBEDDING_MODEL ?? DEFAULT_EMBEDDING_MODEL).trim();
  if (!model || model.length > 200 || !/^[A-Za-z0-9._:/-]+$/.test(model)) {
    throw new Error('NEXA_EMBEDDING_MODEL must be a valid model identifier.');
  }
  return model;
}

export function getProjectSemanticConfig() {
  return {
    model: getEmbeddingModelId(),
    dimensions: boundedInteger('NEXA_EMBEDDING_DIMENSIONS', DEFAULT_EMBEDDING_DIMENSIONS, 128, 1536),
    timeoutMs: boundedInteger('NEXA_EMBEDDING_TIMEOUT_MS', DEFAULT_EMBEDDING_TIMEOUT_MS, 2_000, 60_000),
    maxRetries: boundedInteger('NEXA_EMBEDDING_MAX_RETRIES', DEFAULT_EMBEDDING_MAX_RETRIES, 0, 2),
    chunkChars: boundedInteger('NEXA_EMBEDDING_CHUNK_CHARS', DEFAULT_CHUNK_CHARS, 1_000, 12_000),
    maxChunks: boundedInteger('NEXA_EMBEDDING_MAX_CHUNKS', DEFAULT_MAX_CHUNKS, 1, 16),
  };
}

function safeEmbeddingModelId() {
  try { return getEmbeddingModelId(); } catch { return DEFAULT_EMBEDDING_MODEL; }
}

export function chunkProjectFileForEmbedding(content: string, chunkChars = DEFAULT_CHUNK_CHARS, maxChunks = DEFAULT_MAX_CHUNKS) {
  const cleaned = String(content ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!cleaned) return [];
  if (cleaned.length <= chunkChars) return [cleaned];

  const chunks: string[] = [];
  const naturalCount = Math.ceil(cleaned.length / chunkChars);
  if (naturalCount <= maxChunks) {
    for (let start = 0; start < cleaned.length; start += chunkChars) {
      chunks.push(cleaned.slice(start, start + chunkChars).trim());
    }
    return chunks.filter(Boolean);
  }

  const maxStart = Math.max(0, cleaned.length - chunkChars);
  for (let index = 0; index < maxChunks; index += 1) {
    const start = maxChunks === 1 ? 0 : Math.round((index * maxStart) / (maxChunks - 1));
    chunks.push(cleaned.slice(start, start + chunkChars).trim());
  }
  return chunks.filter(Boolean);
}

export function cosineSimilarity(left: number[], right: number[]) {
  if (!left.length || left.length !== right.length) return -1;
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (let index = 0; index < left.length; index += 1) {
    const a = Number(left[index]);
    const b = Number(right[index]);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return -1;
    dot += a * b;
    leftMagnitude += a * a;
    rightMagnitude += b * b;
  }
  if (leftMagnitude === 0 || rightMagnitude === 0) return -1;
  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}

function cleanExcerpt(value: string, max = 1_700) {
  const cleaned = value.replace(/\s+/g, ' ').trim();
  return cleaned.length <= max ? cleaned : `${cleaned.slice(0, max - 1)}…`;
}

export async function markProjectFileSemanticPending(client: PoolClient, input: { fileId: string; userId: string; projectId: string; contentSha256: string }) {
  await client.query(
    `insert into project_file_embedding_states (file_id, user_id, project_id, content_sha256, model_id, status, dimensions, chunk_count, failure_code, updated_at)
     values ($1, $2, $3, $4, $5, 'pending', null, 0, null, now())
     on conflict (file_id) do update
       set user_id = excluded.user_id,
           project_id = excluded.project_id,
           content_sha256 = excluded.content_sha256,
           model_id = excluded.model_id,
           status = 'pending',
           dimensions = null,
           chunk_count = 0,
           failure_code = null,
           updated_at = now()`,
    [input.fileId, input.userId, input.projectId, input.contentSha256, safeEmbeddingModelId()],
  );
  await client.query('delete from project_file_embedding_chunks where file_id = $1', [input.fileId]);
}

async function markProjectFileSemanticFailed(input: { fileId: string; userId: string; projectId: string; contentSha256: string; failureCode: string }) {
  await withTransaction(async (client) => {
    const file = await client.query<{ sha256: string }>(
      'select sha256 from project_files where id = $1 and user_id = $2 and project_id = $3 for update',
      [input.fileId, input.userId, input.projectId],
    );
    if (file.rows[0]?.sha256 !== input.contentSha256) return;
    await client.query('delete from project_file_embedding_chunks where file_id = $1', [input.fileId]);
    await client.query(
      `insert into project_file_embedding_states (file_id, user_id, project_id, content_sha256, model_id, status, dimensions, chunk_count, failure_code, updated_at)
       values ($1, $2, $3, $4, $5, 'failed', null, 0, $6, now())
       on conflict (file_id) do update
         set content_sha256 = excluded.content_sha256,
             model_id = excluded.model_id,
             status = 'failed',
             dimensions = null,
             chunk_count = 0,
             failure_code = excluded.failure_code,
             updated_at = now()`,
      [input.fileId, input.userId, input.projectId, input.contentSha256, safeEmbeddingModelId(), input.failureCode],
    );
  });
}

export async function getProjectFileSemanticStatus(userId: string, projectId: string, fileId: string) {
  const result = await query<ProjectFileSemanticStatus>(
    `select file_id, content_sha256, model_id, dimensions, status, chunk_count, failure_code, updated_at
     from project_file_embedding_states
     where file_id = $1 and user_id = $2 and project_id = $3
     limit 1`,
    [fileId, userId, projectId],
  );
  return result.rows[0] ?? null;
}

export async function refreshProjectFileSemanticIndex(userId: string, projectId: string, fileId: string) {
  const fileResult = await query<{ id: string; filename: string; content: string; sha256: string }>(
    `select id, filename, content, sha256
     from project_files
     where id = $1 and user_id = $2 and project_id = $3
     limit 1`,
    [fileId, userId, projectId],
  );
  const file = fileResult.rows[0];
  if (!file) throw new Error('Project file not found.');

  const config = getProjectSemanticConfig();
  await withTransaction(async (client) => {
    await markProjectFileSemanticPending(client, { fileId, userId, projectId, contentSha256: file.sha256 });
  });

  if (!process.env.AI_GATEWAY_API_KEY) {
    await markProjectFileSemanticFailed({ fileId, userId, projectId, contentSha256: file.sha256, failureCode: 'gateway_unconfigured' });
    return await getProjectFileSemanticStatus(userId, projectId, fileId);
  }

  try {
    const chunks = chunkProjectFileForEmbedding(file.content, config.chunkChars, config.maxChunks);
    if (!chunks.length) throw new Error('Project file has no embeddable content.');
    const result = await embedMany({
      model: gateway.embeddingModel(config.model),
      values: chunks,
      maxRetries: config.maxRetries,
      abortSignal: AbortSignal.timeout(config.timeoutMs),
      providerOptions: { openai: { dimensions: config.dimensions } },
    });
    if (result.embeddings.length !== chunks.length) throw new Error('Embedding response length mismatch.');
    const dimensions = result.embeddings[0]?.length ?? 0;
    if (!dimensions || result.embeddings.some((vector) => vector.length !== dimensions || vector.some((value) => !Number.isFinite(value)))) {
      throw new Error('Embedding response is invalid.');
    }

    const stored = await withTransaction(async (client) => {
      const locked = await client.query<{ sha256: string }>(
        'select sha256 from project_files where id = $1 and user_id = $2 and project_id = $3 for update',
        [fileId, userId, projectId],
      );
      if (locked.rows[0]?.sha256 !== file.sha256) return false;
      await client.query('delete from project_file_embedding_chunks where file_id = $1', [fileId]);
      for (let index = 0; index < chunks.length; index += 1) {
        await client.query(
          `insert into project_file_embedding_chunks
             (file_id, user_id, project_id, content_sha256, model_id, dimensions, chunk_index, content_excerpt, embedding)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [fileId, userId, projectId, file.sha256, config.model, dimensions, index, cleanExcerpt(chunks[index], 1_900), result.embeddings[index]],
        );
      }
      await client.query(
        `update project_file_embedding_states
         set content_sha256 = $1,
             model_id = $2,
             dimensions = $3,
             status = 'ready',
             chunk_count = $4,
             failure_code = null,
             updated_at = now()
         where file_id = $5 and user_id = $6 and project_id = $7`,
        [file.sha256, config.model, dimensions, chunks.length, fileId, userId, projectId],
      );
      return true;
    });
    if (!stored) return { status: 'stale' as const };
    return await getProjectFileSemanticStatus(userId, projectId, fileId);
  } catch {
    await markProjectFileSemanticFailed({ fileId, userId, projectId, contentSha256: file.sha256, failureCode: 'embedding_unavailable' });
    return await getProjectFileSemanticStatus(userId, projectId, fileId);
  }
}

export async function refreshProjectFileSemanticIndexBestEffort(userId: string, projectId: string, fileId: string) {
  try {
    return await refreshProjectFileSemanticIndex(userId, projectId, fileId);
  } catch {
    return null;
  }
}

export async function searchSemanticProjectFiles(userId: string, projectId: string, queryText: string, limit = 6): Promise<SemanticProjectFileMatch[]> {
  const text = String(queryText ?? '').trim().replace(/\s+/g, ' ').slice(0, 500);
  if (!text || !process.env.AI_GATEWAY_API_KEY) return [];
  const config = getProjectSemanticConfig();

  try {
    const queryEmbedding = await embed({
      model: gateway.embeddingModel(config.model),
      value: text,
      maxRetries: config.maxRetries,
      abortSignal: AbortSignal.timeout(config.timeoutMs),
      providerOptions: { openai: { dimensions: config.dimensions } },
    });
    const vector = queryEmbedding.embedding;
    if (!vector.length || vector.some((value) => !Number.isFinite(value))) return [];

    const result = await query<{
      file_id: string;
      filename: string;
      media_type: string;
      updated_at: string;
      content_excerpt: string;
      dimensions: number;
      embedding: number[];
    }>(
      `select c.file_id,
              f.filename,
              f.media_type,
              f.updated_at,
              c.content_excerpt,
              c.dimensions,
              c.embedding
       from project_file_embedding_chunks c
       join project_file_embedding_states s
         on s.file_id = c.file_id
        and s.user_id = c.user_id
        and s.project_id = c.project_id
       join project_files f
         on f.id = c.file_id
        and f.user_id = c.user_id
        and f.project_id = c.project_id
       where c.user_id = $1
         and c.project_id = $2
         and c.model_id = $3
         and s.status = 'ready'
         and s.model_id = c.model_id
         and s.content_sha256 = c.content_sha256
         and f.sha256 = c.content_sha256`,
      [userId, projectId, config.model],
    );

    const best = new Map<string, SemanticProjectFileMatch>();
    for (const row of result.rows) {
      const candidate = Array.isArray(row.embedding) ? row.embedding.map(Number) : [];
      if (row.dimensions !== vector.length || candidate.length !== vector.length) continue;
      const similarity = cosineSimilarity(vector, candidate);
      if (similarity < SEMANTIC_SIMILARITY_FLOOR) continue;
      const current = best.get(row.file_id);
      if (!current || similarity > current.similarity) {
        best.set(row.file_id, {
          id: row.file_id,
          filename: row.filename,
          mediaType: row.media_type,
          excerpt: row.content_excerpt,
          similarity: Number(similarity.toFixed(6)),
          updatedAt: row.updated_at,
        });
      }
    }
    return [...best.values()].sort((a, b) => b.similarity - a.similarity || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, Math.max(1, Math.min(12, limit)));
  } catch {
    return [];
  }
}
