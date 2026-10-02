#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const memory = await readFile('lib/memory.ts', 'utf8');
const route = await readFile('app/api/memories/route.ts', 'utf8');

assert.match(memory, /select id, project_id from conversations where id = \$1 and user_id = \$2 limit 1/);
assert.match(memory, /params\.scope === 'project' && conversation\.rows\[0\]\.project_id !== params\.projectId/);
assert.match(memory, /Source conversation does not belong to that project\./);
assert.match(route, /Source conversation does not belong to that project\./);

console.log('NEXA memory provenance tests passed.');
