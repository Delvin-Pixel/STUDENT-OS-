import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const route = await readFile('app/api/conversations/[id]/route.ts', 'utf8');
assert.match(route, /withTransaction/);
assert.match(route, /for update/);
assert.match(route, /workflow_count/);
assert.match(route, /artifact_count/);
assert.match(route, /project_memory_count/);
assert.match(route, /project_locked/);
assert.match(route, /cannot be moved to another project/);
assert.match(route, /status: 409/);

console.log('NEXA conversation project integrity tests passed.');
