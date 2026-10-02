#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outDir = path.resolve(process.env.NEXA_RELEASE_ARTIFACT_DIR || path.join(root, 'release-artifacts'));
const sha = async (file) => createHash('sha256').update(await readFile(file)).digest('hex');
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
await mkdir(outDir, { recursive: true });
const manifest = {
  product: 'NEXA',
  version: pkg.version,
  generatedAt: new Date().toISOString(),
  gitCommit: process.env.GITHUB_SHA || process.env.NEXA_GIT_COMMIT || null,
  workflowRunId: process.env.GITHUB_RUN_ID || null,
  node: process.version,
  npm: process.env.NPM_VERSION || null,
  files: {
    packageLockSha256: await sha(path.join(root, 'package-lock.json')),
    migrationManifestSha256: await sha(path.join(root, 'db', 'migration-checksums.json')),
  },
};
await writeFile(path.join(outDir, 'release-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify(manifest, null, 2));
