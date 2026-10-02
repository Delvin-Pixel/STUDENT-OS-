#!/usr/bin/env node
import assert from 'node:assert/strict';
import pg from 'pg';
import { randomUUID } from 'node:crypto';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required for PostgreSQL project-file tests.');

const pool = new pg.Pool({ connectionString, max: 1, connectionTimeoutMillis: 10_000 });
const client = await pool.connect();
const userId = randomUUID();
const projectId = randomUUID();
const fileId = randomUUID();
const content = 'NEXA project knowledge alpha beta gamma';
const hash = 'a'.repeat(64);

try {
  await client.query('begin');
  await client.query(
    `insert into users (id, email, name, password_hash, plan)
     values ($1, $2, 'Project File Test', 'test-hash', 'free')`,
    [userId, `project-files-${userId}@example.invalid`],
  );
  await client.query(
    `insert into projects (id, user_id, name, description)
     values ($1, $2, 'Project Files', 'PostgreSQL integration fixture')`,
    [projectId, userId],
  );
  await client.query(
    `insert into project_files (id, user_id, project_id, filename, media_type, content, size_bytes, sha256, source_kind, source_media_type, source_size_bytes, source_sha256, extraction_status)
     values ($1, $2, $3, 'notes.md', 'text/markdown', $4, $5, $6, 'text', 'text/markdown', $5, $6, 'not_required')`,
    [fileId, userId, projectId, content, Buffer.byteLength(content), hash],
  );

  const search = await client.query(
    `select id from project_files
     where project_id = $1
       and to_tsvector('simple', coalesce(filename, '') || ' ' || content) @@ websearch_to_tsquery('simple', 'alpha beta')`,
    [projectId],
  );
  assert.equal(search.rows[0]?.id, fileId);

  let duplicateCode = null;
  await client.query('savepoint duplicate_file');
  try {
    await client.query(
      `insert into project_files (user_id, project_id, filename, media_type, content, size_bytes, sha256, source_kind, source_media_type, source_size_bytes, source_sha256, extraction_status)
       values ($1, $2, 'NOTES.MD', 'text/markdown', 'duplicate', 9, $3, 'text', 'text/markdown', 9, $3, 'not_required')`,
      [userId, projectId, 'b'.repeat(64)],
    );
  } catch (error) {
    duplicateCode = error?.code ?? null;
    await client.query('rollback to savepoint duplicate_file');
  }
  if (duplicateCode === null) {
    throw new Error('Case-insensitive duplicate filename was not rejected.');
  }
  assert.equal(duplicateCode, '23505');

  await client.query('rollback');

  await client.query('begin');
  await client.query(
    `insert into users (id, email, name, password_hash, plan)
     values ($1, $2, 'Project File Cascade Test', 'test-hash', 'free')`,
    [userId, `project-files-cascade-${userId}@example.invalid`],
  );
  await client.query(
    `insert into projects (id, user_id, name, description)
     values ($1, $2, 'Project Files Cascade', '')`,
    [projectId, userId],
  );
  await client.query(
    `insert into project_files (id, user_id, project_id, filename, media_type, content, size_bytes, sha256, source_kind, source_media_type, source_size_bytes, source_sha256, extraction_status)
     values ($1, $2, $3, 'notes.md', 'text/markdown', $4, $5, $6, 'text', 'text/markdown', $5, $6, 'not_required')`,
    [fileId, userId, projectId, content, Buffer.byteLength(content), hash],
  );
  await client.query('delete from projects where id = $1', [projectId]);
  const afterDelete = await client.query('select count(*)::int as count from project_files where project_id = $1', [projectId]);
  assert.equal(afterDelete.rows[0]?.count, 0);
  await client.query('rollback');

  console.log('NEXA PostgreSQL project-file integration tests passed.');
} finally {
  client.release();
  await pool.end();
}
