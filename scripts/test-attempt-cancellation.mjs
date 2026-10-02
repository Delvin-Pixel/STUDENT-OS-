#!/usr/bin/env node
import { readFile } from 'node:fs/promises';

const workflows = await readFile(new URL('../lib/workflows.ts', import.meta.url), 'utf8');
const route = await readFile(new URL('../app/api/workflows/[id]/route.ts', import.meta.url), 'utf8');
const panel = await readFile(new URL('../components/workflow-panel.tsx', import.meta.url), 'utf8');
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

if (pkg.version !== '1.58.0') throw new Error(`Expected 1.58.0, got ${pkg.version}`);
if (!pkg.scripts.test.includes('test:attempt-cancellation')) throw new Error('Aggregate test script is missing attempt cancellation coverage.');
if (!/cancelWorkflowAttempt/.test(workflows)) throw new Error('Attempt-addressed cancellation helper is missing.');
if (!/where id = \$1 and workflow_id = \$2 and user_id = \$3[\s\S]*for update/.test(workflows)) throw new Error('Attempt cancellation must lock the target attempt.');
if (!/attempt\.rows\[0\]\.status === 'cancelled'/.test(workflows)) throw new Error('Repeated cancellation is not idempotent.');
const eventPos = workflows.indexOf('recordExecutionAttemptEventWithSequence(client');
const updatePos = workflows.indexOf("set status = 'cancelled', terminal_reason");
if (eventPos < 0 || updatePos < 0 || eventPos > updatePos) throw new Error('Attempt cancellation must record the lifecycle event before terminalizing the attempt.');
if (!/attemptId/.test(route) || !/Invalid execution attempt id/.test(route)) throw new Error('Cancellation route is missing attempt targeting/validation.');
if (!/executionAttemptId/.test(route)) throw new Error('Workflow detail route does not expose the active execution attempt.');
if (!/executionAttemptId/.test(panel) || !/attemptId=/.test(panel)) throw new Error('Workflow UI does not target the exact execution attempt.');
console.log('NEXA attempt-addressed cancellation tests passed.');
