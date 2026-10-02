import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

export function sha256Bytes(value) {
  return createHash('sha256').update(value).digest('hex');
}

export async function verifyMigrationManifest(dbDir) {
  const manifestPath = path.join(dbDir, 'migration-checksums.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (manifest.algorithm !== 'sha256' || !manifest.migrations || typeof manifest.migrations !== 'object') {
    throw new Error('Invalid migration checksum manifest.');
  }

  const files = (await readdir(dbDir))
    .filter((name) => /^\d{3}_[a-z0-9_-]+\.sql$/.test(name))
    .sort();
  const listed = Object.keys(manifest.migrations).sort();
  if (JSON.stringify(files) !== JSON.stringify(listed)) {
    throw new Error('Migration checksum manifest does not exactly match the migration file set.');
  }

  const hashes = new Map();
  for (const file of files) {
    const bytes = await readFile(path.join(dbDir, file));
    const actual = sha256Bytes(bytes);
    const expected = String(manifest.migrations[file] ?? '');
    if (!/^[a-f0-9]{64}$/.test(expected) || actual !== expected) {
      throw new Error(`Migration checksum mismatch for ${file}.`);
    }
    hashes.set(file, actual);
  }
  return { files, hashes, manifestPath };
}
