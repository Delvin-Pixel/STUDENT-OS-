#!/usr/bin/env node
import { readFile } from 'node:fs/promises';

const correlation = await readFile(new URL('../lib/execution-attempt-correlation.ts', import.meta.url), 'utf8');
const ai = await readFile(new URL('../lib/ai-runs.ts', import.meta.url), 'utf8');
const tools = await readFile(new URL('../lib/tool-engine.ts', import.meta.url), 'utf8');
const fences = await readFile(new URL('../db/031_execution_telemetry_fences.sql', import.meta.url), 'utf8');
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

if (pkg.version !== '1.71.0') throw new Error(`Expected 1.71.0, got ${pkg.version}`);
if (!pkg.scripts.test.includes('test:workflow-telemetry-correlation')) throw new Error('Aggregate test script is missing workflow telemetry correlation coverage.');
if (!/if \(!input\.executionAttemptId\) \{[\s\S]*input\.workflowId !== null && input\.workflowId !== undefined[\s\S]*throw new ExecutionAttemptCorrelationError\(\)/.test(correlation)) throw new Error('Workflow telemetry without an execution attempt is not rejected.');
if (!/assertExecutionAttemptCorrelation\(client/.test(ai)) throw new Error('AI telemetry is not guarded by execution-attempt correlation.');
if (!/assertExecutionAttemptCorrelation\(client/.test(tools)) throw new Error('Tool telemetry is not guarded by execution-attempt correlation.');
if (!/execution_attempt_id/.test(ai) || !/execution_attempt_id/.test(tools)) throw new Error('AI/tool telemetry does not persist execution_attempt_id.');
if (!/alter table tool_runs[\s\S]*add column if not exists workflow_id uuid references workflows/.test(fences)) throw new Error('Tool telemetry schema is missing workflow_id correlation.');
if (!/insert into tool_runs \(user_id, conversation_id, project_id, workflow_id, request_id, execution_attempt_id/.test(tools)) throw new Error('Tool telemetry does not persist workflow_id with execution_attempt_id.');
console.log('NEXA workflow telemetry correlation enforcement tests passed.');
