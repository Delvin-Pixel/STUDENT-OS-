#!/usr/bin/env node
import assert from 'node:assert/strict';
import pg from 'pg';
import { randomUUID } from 'node:crypto';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required for PostgreSQL semantic project-file tests.');

const pool = new pg.Pool({ connectionString, max: 1, connectionTimeoutMillis: 10_000 });
const client = await pool.connect();
const userId = randomUUID();
const projectId = randomUUID();
const otherProjectId = randomUUID();
const fileId = randomUUID();
const hash = 'c'.repeat(64);
const changedHash = 'd'.repeat(64);

try {
  await client.query('begin');
  await client.query(
    `insert into users (id, email, name, password_hash, plan)
     values ($1, $2, 'Semantic File Test', 'test-hash', 'premium')`,
    [userId, `semantic-files-${userId}@example.invalid`],
  );
  await client.query(
    `insert into projects (id, user_id, name, description)
     values ($1, $2, 'Semantic Project', 'Hybrid retrieval fixture'),
            ($3, $2, 'Other Project', 'Ownership fence fixture')`,
    [projectId, userId, otherProjectId],
  );
  await client.query(
    `insert into project_files (id, user_id, project_id, filename, media_type, content, size_bytes, sha256, source_kind, source_media_type, source_size_bytes, source_sha256, extraction_status)
     values ($1, $2, $3, 'knowledge.md', 'text/markdown', 'A solar battery stores sunlight for later use.', 45, $4, 'text', 'text/markdown', 45, $4, 'not_required')`,
    [fileId, userId, projectId, hash],
  );
  await client.query(
    `insert into project_file_embedding_states
       (file_id, user_id, project_id, content_sha256, model_id, status)
     values ($1, $2, $3, $4, 'openai/text-embedding-3-small', 'pending')`,
    [fileId, userId, projectId, hash],
  );

  const pending = await client.query(
    'select status, chunk_count from project_file_embedding_states where file_id = $1',
    [fileId],
  );
  assert.equal(pending.rows[0]?.status, 'pending');
  assert.equal(pending.rows[0]?.chunk_count, 0);

  let ownershipCode = null;
  await client.query('savepoint semantic_identity');
  try {
    await client.query(
      `update project_file_embedding_states set project_id = $1 where file_id = $2`,
      [otherProjectId, fileId],
    );
  } catch (error) {
    ownershipCode = error?.code ?? null;
    await client.query('rollback to savepoint semantic_identity');
  }
  assert.equal(ownershipCode, '23503');

  await client.query(
    `update project_file_embedding_states
     set status = 'ready', dimensions = 3, chunk_count = 1, failure_code = null
     where file_id = $1`,
    [fileId],
  );
  await client.query(
    `insert into project_file_embedding_chunks
       (file_id, user_id, project_id, content_sha256, model_id, dimensions, chunk_index, content_excerpt, embedding)
     values ($1, $2, $3, $4, 'openai/text-embedding-3-small', 3, 0, 'solar battery stores sunlight', array[1.0, 0.2, 0.1]::real[])`,
    [fileId, userId, projectId, hash],
  );

  const fresh = await client.query(
    `select c.file_id
     from project_file_embedding_chunks c
     join project_file_embedding_states s on s.file_id = c.file_id
     join project_files f on f.id = c.file_id
     where c.file_id = $1
       and s.status = 'ready'
       and s.content_sha256 = c.content_sha256
       and f.sha256 = c.content_sha256`,
    [fileId],
  );
  assert.equal(fresh.rows[0]?.file_id, fileId);

  await client.query(
    `update project_files
     set content = 'The source file changed.', size_bytes = 24, sha256 = $1, version = version + 1
     where id = $2`,
    [changedHash, fileId],
  );
  const stale = await client.query(
    `select count(*)::int as count
     from project_file_embedding_chunks c
     join project_file_embedding_states s on s.file_id = c.file_id
     join project_files f on f.id = c.file_id
     where c.file_id = $1
       and s.status = 'ready'
       and s.content_sha256 = c.content_sha256
       and f.sha256 = c.content_sha256`,
    [fileId],
  );
  assert.equal(stale.rows[0]?.count, 0, 'Stale semantic vectors must be fenced by the current file hash.');

  await client.query('delete from project_files where id = $1', [fileId]);
  const stateAfterDelete = await client.query('select count(*)::int as count from project_file_embedding_states where file_id = $1', [fileId]);
  const chunksAfterDelete = await client.query('select count(*)::int as count from project_file_embedding_chunks where file_id = $1', [fileId]);
  assert.equal(stateAfterDelete.rows[0]?.count, 0);
  assert.equal(chunksAfterDelete.rows[0]?.count, 0);

  await client.query('rollback');
  console.log('NEXA PostgreSQL semantic project-file integration tests passed.');
} finally {
  client.release();
  await pool.end();
}
