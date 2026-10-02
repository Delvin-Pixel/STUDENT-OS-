#!/usr/bin/env node
import assert from 'node:assert/strict';
import pg from 'pg';
import { createHash, randomUUID } from 'node:crypto';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required for PostgreSQL rich project-file tests.');

const pool = new pg.Pool({ connectionString, max: 1, connectionTimeoutMillis: 10_000 });
const client = await pool.connect();
const userId = randomUUID();
const projectId = randomUUID();
const otherProjectId = randomUUID();
const fileId = randomUUID();
const bytes = Buffer.from('%PDF-1.7\nNEXA rich project fixture\n', 'utf8');
const sourceHash = createHash('sha256').update(bytes).digest('hex');
const placeholder = 'Rich project source: fixture.pdf\nMedia type: application/pdf\nSearchable extraction is pending.';
const contentHash = createHash('sha256').update(placeholder).digest('hex');

try {
  await client.query('begin');
  await client.query(
    `insert into users (id, email, name, password_hash, plan)
     values ($1, $2, 'Rich File Test', 'test-hash', 'premium')`,
    [userId, `rich-files-${userId}@example.invalid`],
  );
  await client.query(
    `insert into projects (id, user_id, name, description)
     values ($1, $2, 'Rich Project', 'Rich project-file fixture'),
            ($3, $2, 'Other Rich Project', 'Ownership fence fixture')`,
    [projectId, userId, otherProjectId],
  );
  await client.query(
    `insert into project_files
       (id, user_id, project_id, filename, media_type, content, size_bytes, sha256,
        source_kind, source_media_type, source_size_bytes, source_sha256, extraction_status)
     values ($1, $2, $3, 'fixture.pdf', 'application/pdf', $4, $5, $6,
             'rich', 'application/pdf', $7, $8, 'pending')`,
    [fileId, userId, projectId, placeholder, Buffer.byteLength(placeholder), contentHash, bytes.length, sourceHash],
  );
  await client.query(
    `insert into project_file_blobs (file_id, user_id, project_id, media_type, byte_size, sha256, data)
     values ($1, $2, $3, 'application/pdf', $4, $5, $6)`,
    [fileId, userId, projectId, bytes.length, sourceHash, bytes],
  );

  const stored = await client.query(
    `select f.source_kind, f.source_sha256, f.extraction_status, b.byte_size, octet_length(b.data) as actual_bytes
     from project_files f join project_file_blobs b on b.file_id = f.id
     where f.id = $1`,
    [fileId],
  );
  assert.equal(stored.rows[0]?.source_kind, 'rich');
  assert.equal(stored.rows[0]?.source_sha256, sourceHash);
  assert.equal(stored.rows[0]?.extraction_status, 'pending');
  assert.equal(Number(stored.rows[0]?.byte_size), bytes.length);
  assert.equal(Number(stored.rows[0]?.actual_bytes), bytes.length);

  let ownershipCode = null;
  await client.query('savepoint rich_identity');
  try {
    await client.query('update project_file_blobs set project_id = $1 where file_id = $2', [otherProjectId, fileId]);
  } catch (error) {
    ownershipCode = error?.code ?? null;
    await client.query('rollback to savepoint rich_identity');
  }
  assert.equal(ownershipCode, '23503', 'Rich-file blob ownership must be fenced by the composite file identity.');

  let sizeCode = null;
  await client.query('savepoint rich_size');
  try {
    const secondId = randomUUID();
    await client.query(
      `insert into project_files
         (id, user_id, project_id, filename, media_type, content, size_bytes, sha256,
          source_kind, source_media_type, source_size_bytes, source_sha256, extraction_status)
       values ($1, $2, $3, 'bad.pdf', 'application/pdf', 'pending', 7, $4,
               'rich', 'application/pdf', $5, $6, 'pending')`,
      [secondId, userId, projectId, 'e'.repeat(64), bytes.length + 1, sourceHash],
    );
    await client.query(
      `insert into project_file_blobs (file_id, user_id, project_id, media_type, byte_size, sha256, data)
       values ($1, $2, $3, 'application/pdf', $4, $5, $6)`,
      [secondId, userId, projectId, bytes.length + 1, sourceHash, bytes],
    );
  } catch (error) {
    sizeCode = error?.code ?? null;
    await client.query('rollback to savepoint rich_size');
  }
  assert.equal(sizeCode, '23514', 'Stored blob byte length must match declared size.');

  await client.query('delete from projects where id = $1', [projectId]);
  const filesAfter = await client.query('select count(*)::int as count from project_files where project_id = $1', [projectId]);
  const blobsAfter = await client.query('select count(*)::int as count from project_file_blobs where project_id = $1', [projectId]);
  assert.equal(filesAfter.rows[0]?.count, 0);
  assert.equal(blobsAfter.rows[0]?.count, 0);

  await client.query('rollback');
  console.log('NEXA PostgreSQL rich project-file integration tests passed.');
} finally {
  client.release();
  await pool.end();
}
