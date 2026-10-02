#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const files = {
  artifacts: await readFile('lib/artifacts.ts', 'utf8'),
  memory: await readFile('lib/memory.ts', 'utf8'),
  artifactsRoute: await readFile('app/api/artifacts/route.ts', 'utf8'),
  memoryRoute: await readFile('app/api/memories/route.ts', 'utf8'),
  artifactsUpdateRoute: await readFile('app/api/artifacts/[id]/route.ts', 'utf8'),
  memoryUpdateRoute: await readFile('app/api/memories/[id]/route.ts', 'utf8'),
  migration: await readFile('db/014_state_consistency.sql', 'utf8'),
  checkpoints: await readFile('lib/agent-checkpoints.ts', 'utf8'),
};

assert.match(files.artifacts, /select id from users where id = \$1 for update/);
assert.match(files.artifacts, /ArtifactConflictError/);
assert.match(files.artifacts, /expectedVersion/);
assert.match(files.memory, /sourceConversationId/);
assert.match(files.memory, /select id, project_id from conversations where id = \$1 and user_id = \$2/);
assert.match(files.memory, /version = version \+ 1/);
assert.match(files.artifactsRoute, /artifacts:create/);
assert.match(files.memoryRoute, /memories:create/);
assert.match(files.artifactsUpdateRoute, /ArtifactConflictError/);
assert.match(files.artifactsUpdateRoute, /expectedVersion/);
assert.match(files.memoryUpdateRoute, /MemoryConflictError/);
assert.match(files.memoryUpdateRoute, /expectedVersion/);
assert.match(files.migration, /add column if not exists version integer not null default 1/);


assert.match(files.checkpoints, /join workflows w on w\.id = c\.workflow_id[\s\S]*where c\.id = \$1 and w\.user_id = \$2/);

console.log('NEXA consistency contract tests passed.');
