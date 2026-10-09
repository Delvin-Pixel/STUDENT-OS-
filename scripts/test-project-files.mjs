#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const migration = await readFile(new URL('../db/035_project_knowledge_files.sql', import.meta.url), 'utf8');
const library = await readFile(new URL('../lib/project-files.ts', import.meta.url), 'utf8');
const apiList = await readFile(new URL('../app/api/projects/[id]/files/route.ts', import.meta.url), 'utf8');
const apiItem = await readFile(new URL('../app/api/projects/[id]/files/[fileId]/route.ts', import.meta.url), 'utf8');
const projectIntel = await readFile(new URL('../lib/project-intelligence.ts', import.meta.url), 'utf8');
const projectTools = await readFile(new URL('../lib/project-file-tools.ts', import.meta.url), 'utf8');
const toolEngine = await readFile(new URL('../lib/tool-engine.ts', import.meta.url), 'utf8');
const panel = await readFile(new URL('../components/project-files-panel.tsx', import.meta.url), 'utf8');
const account = await readFile(new URL('../lib/account.ts', import.meta.url), 'utf8');

assert.equal(pkg.version, '1.69.0');
assert.match(migration, /create table if not exists project_files/);
assert.match(migration, /project_files_project_filename_unique_idx/);
assert.match(migration, /project_files_search_idx/);
assert.match(migration, /sha256 ~ '\^\[0-9a-f\]\{64\}\$'/);
assert.match(library, /getProjectFileContentLimit/);
assert.match(library, /createHash\('sha256'\)/);
assert.match(library, /select count\(\*\)::text as count from project_files/);
assert.match(library, /ProjectFileConflictError/);
assert.match(apiList, /withIdempotency/);
assert.match(apiList, /enforceUserMutationRateLimit/);
assert.match(apiItem, /expectedVersion/);
assert.match(projectIntel, /searchProjectFiles/);
assert.match(projectIntel, /source: 'file'/);
assert.match(projectTools, /list_project_files/);
assert.match(projectTools, /read_project_file/);
assert.match(toolEngine, /createProjectFileTools/);
assert.match(panel, /NEXA · PROJECT FILES/);
assert.match(panel, /500 KB or smaller/);
assert.match(account, /fetchCollection\(client, 'project_files'/);
console.log('NEXA persistent project file contract tests passed.');
