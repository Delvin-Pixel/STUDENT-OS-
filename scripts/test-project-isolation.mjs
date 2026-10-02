import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';

const artifacts = readFileSync(new URL('../lib/artifacts.ts', import.meta.url), 'utf8');
const artifactTools = readFileSync(new URL('../lib/artifact-tools.ts', import.meta.url), 'utf8');
const memory = readFileSync(new URL('../lib/memory.ts', import.meta.url), 'utf8');
const memoryTools = readFileSync(new URL('../lib/memory-tools.ts', import.meta.url), 'utf8');

assert.match(artifacts, /getArtifact\(userId: string, id: string, projectId\?: string \| null\)/);
assert.match(artifacts, /\$3::uuid is null or project_id is null or project_id = \$3::uuid/);
assert.match(artifacts, /updateArtifact\(userId: string, plan: 'free' \| 'premium', id: string, patch:/);
assert.match(artifacts, /for update`/);
assert.match(artifactTools, /projectOnly = Boolean\(context\?\.projectId\) \? true/);
assert.match(artifactTools, /getArtifact\(user\.id, String\(value\.artifactId \?\? ''\), context\?\.projectId\)/);
assert.match(artifactTools, /\}, context\?\.projectId\);/);
const workflowTools = readFileSync(new URL('../lib/workflow-tools.ts', import.meta.url), 'utf8');
const engine = readFileSync(new URL('../lib/tool-engine.ts', import.meta.url), 'utf8');
assert.match(workflowTools, /createWorkflowTools\(user: \{ id: string \}, workflowId\?: string \| null, projectId\?: string \| null\)/);
assert.match(workflowTools, /getArtifact\(user\.id, String\(value\.artifactId\), projectId\)/);
assert.match(engine, /createWorkflowTools\(user, context\.workflowId, context\.projectId\)/);
assert.match(memory, /deleteMemory\(userId: string, id: string, projectId\?: string \| null\)/);
assert.match(memory, /scope = 'saved' or project_id = \$3::uuid/);
assert.match(memoryTools, /deleteMemory\(user\.id, String\(value\.memoryId \?\? ''\), projectId\)/);

console.log('NEXA project isolation tests passed.');

assert.match(readFileSync(new URL('../lib/workflows.ts', import.meta.url), 'utf8'), /getWorkflow\(userId: string, id: string, projectId\?: string \| null\)/);
assert.match(readFileSync(new URL('../lib/workflows.ts', import.meta.url), 'utf8'), /project_id is not distinct from \$3::uuid/);
assert.match(workflowTools, /getWorkflow\(user\.id, workflowId, projectId\)/);


const checkpoints = readFileSync(new URL('../lib/agent-checkpoints.ts', import.meta.url), 'utf8');
assert.match(checkpoints, /join workflows w on w\.id = c\.workflow_id/);
assert.match(checkpoints, /w\.user_id = \$2/);
assert.match(workflowTools, /getNextCheckpoint\(user\.id, workflowId\)/);
assert.match(workflowTools, /const activeWorkflow = await getWorkflow\(user\.id, workflowId, projectId\);/);
assert.equal((workflowTools.match(/const activeWorkflow = await getWorkflow\(user\.id, workflowId, projectId\);/g) || []).length, 2);
