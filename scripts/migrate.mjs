#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { verifyMigrationManifest } from './migration-integrity.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dbDir = path.join(root, 'db');
const mode = process.argv.includes('--status') ? 'status' : 'migrate';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required.');
  process.exit(1);
}

const { files, hashes: migrationHashes } = await verifyMigrationManifest(dbDir);
const numbers = files.map((name) => Number(name.slice(0, 3)));
for (let i = 0; i < numbers.length; i += 1) {
  if (numbers[i] !== i + 1) {
    throw new Error(`Migration sequence must be contiguous; expected ${String(i + 1).padStart(3, '0')}.`);
  }
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 10_000 });
const client = await pool.connect();
const MIGRATION_LOCK = 817462190351n;
try {
  await client.query('select pg_advisory_lock($1::bigint)', [MIGRATION_LOCK]);
  await client.query(`
    create table if not exists schema_migrations (
      version text primary key,
      sha256 text,
      applied_at timestamptz not null default now()
    )
  `);
  await client.query('alter table schema_migrations add column if not exists sha256 text');

  const existing = await client.query('select version, sha256 from schema_migrations order by version');
  const applied = new Map(existing.rows.map((row) => [row.version, row.sha256]));
  for (const [version, storedHash] of applied) {
    const expectedHash = migrationHashes.get(version);
    if (!expectedHash) throw new Error(`Applied migration ${version} is not present in the release manifest.`);
    if (storedHash && storedHash !== expectedHash) {
      throw new Error(`Applied migration checksum drift detected for ${version}.`);
    }
    if (!storedHash) {
      await client.query('update schema_migrations set sha256 = $2 where version = $1 and sha256 is null', [version, expectedHash]);
      applied.set(version, expectedHash);
    }
  }

  if (mode === 'status') {
    for (const file of files) console.log(`${applied.has(file) ? 'applied' : 'pending'} ${file} ${migrationHashes.get(file)}`);
    process.exitCode = files.every((file) => applied.has(file)) ? 0 : 2;
  } else {
    for (const file of files) {
      if (applied.has(file)) {
        console.log(`skip ${file}`);
        continue;
      }
      const sql = await readFile(path.join(dbDir, file), 'utf8');
      await client.query('begin');
      try {
        await client.query(sql);
        await client.query('insert into schema_migrations(version, sha256) values ($1, $2)', [file, migrationHashes.get(file)]);
        await client.query('commit');
        console.log(`apply ${file}`);
      } catch (error) {
        await client.query('rollback');
        throw error;
      }
    }
  }
} finally {
  try { await client.query('select pg_advisory_unlock($1::bigint)', [MIGRATION_LOCK]); } catch {}
  client.release();
  await pool.end();
}
