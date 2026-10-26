#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { queryDataApiRemediationPlan } from './plan-supabase-data-api-remediation.mjs';

export function classifyClosure(plan) {
  if (plan.status === 'no-action') {
    return Object.freeze({
      status: 'closed',
      reason: 'no-remediation-required',
      securityBoundaryClosed: true,
      requiresVerification: false,
    });
  }

  if (plan.status === 'owner-action-required') {
    return Object.freeze({
      status: 'open',
      reason: 'owner-action-pending',
      securityBoundaryClosed: false,
      requiresVerification: true,
    });
  }

  if (plan.status === 'security-review-required') {
    return Object.freeze({
      status: 'open',
      reason: 'security-review-pending',
      securityBoundaryClosed: false,
      requiresVerification: true,
    });
  }

  const reason = plan.recommendedAction === 'verify-data-api-platform-state'
    ? 'platform-verification-pending'
    : plan.recommendedAction === 'verify-data-api-isolation-attestation'
      ? 'isolation-verification-pending'
      : 'remediation-verification-pending';

  return Object.freeze({
    status: 'verification-required',
    reason,
    securityBoundaryClosed: false,
    requiresVerification: true,
  });
}

export async function verifyDataApiRemediationClosure(options = {}) {
  const started = Date.now();
  const plan = await queryDataApiRemediationPlan(options);
  const closure = classifyClosure(plan);

  return Object.freeze({
    ...closure,
    checkedAt: new Date().toISOString(),
    latencyMs: Date.now() - started,
  });
}

async function main() {
  const result = await verifyDataApiRemediationClosure();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);

  if (result.status === 'closed') process.exit(0);
  if (result.status === 'verification-required') process.exit(2);
  process.exit(3);
}

const invokedAsScript = process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedAsScript) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : 'Data API remediation closure verification failed.');
    process.exit(1);
  });
}
