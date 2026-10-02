import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';

const source = readFileSync(new URL('../lib/tool-engine.ts', import.meta.url), 'utf8');

assert.match(source, /function hasWriteIntent/);
assert.match(source, /intentPatterns/);
assert.match(source, /create_artifact[\s\S]*intentPatterns/);
assert.match(source, /resume_checkpoint[\s\S]*requiresExplicitIntent: true/);
assert.match(source, /resume_checkpoint[\s\S]*risk: 'write'/);

const createBlock = source.match(/\{ name: 'create_artifact',[\s\S]*?\},\n  \{ name: 'list_artifacts'/)?.[0] ?? '';
assert.doesNotMatch(createBlock, /keywords: \[[^\]]*download[^\]]*\]/i, 'create_artifact must not use broad download keyword gating');
assert.match(createBlock, /\\b\(create\|make\|generate\)\\b/);

const resumeBlock = source.match(/\{ name: 'resume_checkpoint',[\s\S]*?\},\n  \{ name: 'search_project'/)?.[0] ?? '';
assert.match(resumeBlock, /\\bresume/);
assert.match(resumeBlock, /\\bcontinue/);

console.log('NEXA tool governance contract tests passed.');

assert.match(source, /TOOL_BUDGET_LIMITS[\s\S]*total: 12/);
assert.match(source, /TOOL_BUDGET_LIMITS[\s\S]*write: 4/);
assert.match(source, /TOOL_BUDGET_LIMITS[\s\S]*external: 3/);
assert.match(source, /descriptor\.risk === 'read' && count < 2/);
assert.match(source, /descriptor\.risk === 'write' && budget\.write >= TOOL_BUDGET_LIMITS\.write/);
assert.match(source, /Tool budget exhausted/);

const engine = readFileSync(new URL('../lib/tool-engine.ts', import.meta.url), 'utf8');
assert(engine.includes("if (count > 1 && descriptor.risk !== 'read')"), 'duplicate write/external retry guard missing');
assert(engine.includes("State-changing or external tools require a new, corrected request."), 'duplicate retry guidance missing');

assert.match(source, /hashInput/);
assert.match(source, /blockedReason/);
assert.match(source, /duplicate_retry/);
assert.match(source, /total_budget/);

assert.match(engine, /requestId\?: string \| null/);
assert.match(engine, /insert into tool_runs \(user_id, conversation_id, project_id, workflow_id, request_id, execution_attempt_id, tool_name/);
assert.match(engine, /function safeToolError\(\)/);
assert.doesNotMatch(engine, /error: error instanceof Error \? error\.message/);
assert.match(engine, /Internal details were withheld/);
