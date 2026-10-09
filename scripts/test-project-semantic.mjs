#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const migration = await readFile(new URL('../db/036_project_file_semantic_embeddings.sql', import.meta.url), 'utf8');
const semantic = await readFile(new URL('../lib/project-semantic.ts', import.meta.url), 'utf8');
const files = await readFile(new URL('../lib/project-files.ts', import.meta.url), 'utf8');
const intelligence = await readFile(new URL('../lib/project-intelligence.ts', import.meta.url), 'utf8');
const intelligenceTools = await readFile(new URL('../lib/project-intelligence-tools.ts', import.meta.url), 'utf8');
const createRoute = await readFile(new URL('../app/api/projects/[id]/files/route.ts', import.meta.url), 'utf8');
const updateRoute = await readFile(new URL('../app/api/projects/[id]/files/[fileId]/route.ts', import.meta.url), 'utf8');
const reindexRoute = await readFile(new URL('../app/api/projects/[id]/files/[fileId]/semantic-index/route.ts', import.meta.url), 'utf8');
const panel = await readFile(new URL('../components/project-files-panel.tsx', import.meta.url), 'utf8');
const account = await readFile(new URL('../lib/account.ts', import.meta.url), 'utf8');
const env = await readFile(new URL('../.env.local.example', import.meta.url), 'utf8');

assert.equal(pkg.version, '1.68.0');
assert.match(pkg.scripts['verify:ci'], /test:postgres-project-semantic/);
assert.match(pkg.scripts.test, /test:project-semantic/);

assert.match(migration, /create table if not exists project_file_embedding_states/);
assert.match(migration, /create table if not exists project_file_embedding_chunks/);
assert.match(migration, /foreign key \(file_id, user_id, project_id\)/);
assert.match(migration, /cardinality\(embedding\) = dimensions/);
assert.match(migration, /select id, user_id, project_id, sha256, 'unindexed', 'pending'/);

assert.match(semantic, /DEFAULT_EMBEDDING_MODEL = 'openai\/text-embedding-3-small'/);
assert.match(semantic, /gateway\.embeddingModel\(config\.model\)/);
assert.match(semantic, /embedMany\(/);
assert.match(semantic, /embed\(/);
assert.match(semantic, /providerOptions: \{ openai: \{ dimensions: config\.dimensions \} \}/);
assert.match(semantic, /AbortSignal\.timeout\(config\.timeoutMs\)/);
assert.match(semantic, /SEMANTIC_SIMILARITY_FLOOR/);
assert.match(semantic, /cosineSimilarity/);
assert.match(semantic, /f\.sha256 = c\.content_sha256/);
assert.match(semantic, /gateway_unconfigured/);
assert.match(semantic, /embedding_unavailable/);
assert.match(semantic, /return \[\];/);

assert.match(files, /markProjectFileSemanticPending/);
assert.match(files, /patch\.content !== undefined/);
assert.match(createRoute, /refreshProjectFileSemanticIndexBestEffort/);
assert.match(createRoute, /result\.replay/);
assert.match(updateRoute, /contentChanged/);
assert.match(reindexRoute, /refreshProjectFileSemanticIndex/);
assert.match(reindexRoute, /project-file-semantic-index/);

assert.match(intelligence, /searchSemanticProjectFiles/);
assert.match(intelligence, /mergeProjectFileResults/);
assert.match(intelligence, /retrieval: 'hybrid'/);
assert.match(intelligenceTools, /retrieval: item\.retrieval/);
assert.match(panel, /Reindex/);
assert.match(panel, /semantic_status/);

assert.match(account, /EXPORT_SCHEMA_VERSION = '1\.23'/);
assert.match(account, /project_file_embedding_states/);
assert.match(account, /project_file_embedding_chunks/);
assert.match(env, /NEXA_EMBEDDING_MODEL/);
assert.match(env, /NEXA_EMBEDDING_DIMENSIONS=512/);

console.log('NEXA hybrid semantic project retrieval contract tests passed.');
