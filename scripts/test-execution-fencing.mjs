#!/usr/bin/env node
import { readFile } from 'node:fs/promises';

const correlation = await readFile(new URL('../lib/execution-attempt-correlation.ts', import.meta.url), 'utf8');
const ai = await readFile(new URL('../lib/ai-runs.ts', import.meta.url), 'utf8');
const tools = await readFile(new URL('../lib/tool-engine.ts', import.meta.url), 'utf8');
const migration = await readFile(new URL('../db/031_execution_telemetry_fences.sql', import.meta.url), 'utf8');
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

if (pkg.version !== '1.67.0') throw new Error(`Expected 1.67.0, got ${pkg.version}`);
if (!pkg.scripts.test.includes('test:execution-fencing')) throw new Error('Aggregate test script is missing execution fencing coverage.');
if (!/row\.status !== 'running'/.test(correlation)) throw new Error('Terminal execution attempts are not fenced from telemetry correlation.');
if (!/for share/.test(correlation)) throw new Error('Correlation helper must retain a shared-row lock for exact identity reads.');
if (!/assertExecutionAttemptCorrelation\(client/.test(ai)) throw new Error('AI telemetry correlation guard is missing.');
if (!/assertExecutionAttemptCorrelation\(client/.test(tools)) throw new Error('Tool telemetry correlation guard is missing.');
if (!/create unique index if not exists workflow_execution_attempts_identity_idx/.test(migration)) throw new Error('Attempt identity unique index is missing.');
if (!/ai_runs_workflow_attempt_presence_ck/.test(migration) || !/tool_runs_workflow_attempt_presence_ck/.test(migration)) throw new Error('Workflow/attempt presence checks are missing.');
if (!/ai_runs_execution_attempt_identity_fk/.test(migration) || !/tool_runs_execution_attempt_identity_fk/.test(migration)) throw new Error('Exact execution-attempt foreign keys are missing.');
if (!/on delete set null \(execution_attempt_id, workflow_id\)/.test(migration)) throw new Error('Telemetry foreign keys must preserve historical rows when an execution attempt is deleted.');
if (!/not valid/.test(migration)) throw new Error('Historical compatibility guard is missing NOT VALID constraints.');

console.log('NEXA execution fencing tests passed.');
