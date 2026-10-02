#!/usr/bin/env node
import assert from 'node:assert/strict';
import { rm, mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const temp = path.join(tmpdir(), `nexa-workflow-${randomUUID()}`);
await mkdir(temp, { recursive: true });
try {
  const source = path.join(root, 'lib/workflow-planner.ts');
  const tsc = process.platform === 'win32' ? 'tsc.cmd' : 'tsc';
  execFileSync(tsc, [source, '--target', 'ES2022', '--module', 'commonjs', '--outDir', temp, '--skipLibCheck'], { stdio: 'inherit' });
  const planner = await import(`file://${path.join(temp, 'workflow-planner.js')}`);

  assert.equal(planner.detectWorkflowType('Research the latest React release'), 'research');
  assert.equal(planner.detectWorkflowType('Build a student dashboard'), 'build');
  assert.equal(planner.detectWorkflowType('Create a report file'), 'create');
  assert.equal(planner.detectWorkflowType('Analyze these metrics'), 'analyze');
  assert.equal(planner.detectWorkflowType('Plan my study week'), 'plan');
  assert.equal(planner.detectWorkflowType('hello there'), 'general');
  assert.equal(planner.shouldCreateWorkflow('Research current admission requirements'), true);
  assert.equal(planner.shouldCreateWorkflow('hello there'), false);

  const plan = planner.buildWorkflowPlan('Research the latest NEXA security patterns');
  assert.equal(plan.type, 'research');
  assert.deepEqual(plan.plan.map((step) => step.order), [1, 2, 3, 4, 5]);
  assert.equal(plan.plan[1].kind, 'research');
  assert.equal(plan.plan.at(-1).kind, 'deliver');

  console.log('NEXA workflow planner tests passed.');
} finally {
  await rm(temp, { recursive: true, force: true });
}
