import type {
  AssessmentRemediationPlan,
  RemediationNode,
} from "./misconceptionRemediation";
import type { StudySession, StudyState } from "./types";

export type RemediationExecutionStatus =
  "ready" | "in_progress" | "completed" | "needs_reassessment" | "blocked";

export type RemediationExecutionStep = {
  id: string;
  topicId: string;
  topic: string;
  action: RemediationNode["action"];
  route: RemediationNode["route"];
  plannedMinutes: number;
  status: "pending" | "active" | "completed";
  reason: string;
};

export type RemediationExecutionPlan = {
  id: string;
  sourceTopicId: string;
  status: RemediationExecutionStatus;
  createdAt: string;
  steps: RemediationExecutionStep[];
  nextStepId?: string;
  summary: string;
};

const MIN_BLOCK = 10;
const MAX_BLOCK = 45;

const clampMinutes = (value: number) =>
  Math.max(MIN_BLOCK, Math.min(MAX_BLOCK, Math.round(value)));

function stepStatusForSession(
  step: RemediationExecutionStep,
  sessions: StudySession[]
) {
  const related = sessions.filter(
    session =>
      session.topicId === step.topicId &&
      ["in_progress", "completed", "paused"].includes(session.status)
  );
  if (related.some(session => session.status === "completed"))
    return "completed" as const;
  if (
    related.some(session => ["in_progress", "paused"].includes(session.status))
  )
    return "active" as const;
  return "pending" as const;
}

/**
 * B42 converts the B41 remediation graph into a learner-executable,
 * side-effect-free plan. It does not create sessions or alter evidence.
 */
export function createRemediationExecutionPlan(
  state: StudyState,
  remediation: AssessmentRemediationPlan,
  now = new Date().toISOString()
): RemediationExecutionPlan {
  const steps = remediation.nodes.map((node, index) => ({
    id: `${remediation.topicId}:remediation:${index + 1}`,
    topicId: node.topicId,
    topic: node.topic,
    action: node.action,
    route: node.route,
    plannedMinutes: clampMinutes(node.duration),
    status: "pending" as const,
    reason: node.reason,
  }));

  const syncedSteps = steps.map(step => ({
    ...step,
    status: stepStatusForSession(step, state.sessions),
  }));
  const next = syncedSteps.find(step => step.status !== "completed");

  return {
    id: `${remediation.topicId}:remediation:${now.slice(0, 10)}`,
    sourceTopicId: remediation.topicId,
    status:
      syncedSteps.length === 0
        ? "blocked"
        : syncedSteps.every(step => step.status === "completed")
          ? "needs_reassessment"
          : syncedSteps.some(step => step.status === "active")
            ? "in_progress"
            : "ready",
    createdAt: now,
    steps: syncedSteps,
    nextStepId: next?.id,
    summary: syncedSteps.every(step => step.status === "completed")
      ? "Remediation work is complete; collect fresh evidence before declaring the gap closed."
      : next
        ? `Next: ${next.action} ${next.topic} for ${next.plannedMinutes} minutes.`
        : "No executable remediation step is available.",
  };
}

/**
 * Produces the smallest safe execution block for the next remediation step.
 * The caller must still obtain learner confirmation before starting work.
 */
export function getNextRemediationBlock(
  plan: RemediationExecutionPlan,
  availableMinutes: number
) {
  const step = plan.steps.find(
    candidate =>
      candidate.id === plan.nextStepId && candidate.status !== "completed"
  );
  if (!step || availableMinutes < MIN_BLOCK) return null;

  const minutes = Math.min(
    step.plannedMinutes,
    Math.max(MIN_BLOCK, Math.round(availableMinutes))
  );
  return {
    stepId: step.id,
    topicId: step.topicId,
    topic: step.topic,
    action: step.action,
    route: step.route,
    minutes,
    requiresFreshEvidence: step.action === "verify",
    summary: `${step.action} ${step.topic} for ${minutes} minutes, then record the outcome.`,
  };
}

/**
 * Reconciles execution outcomes without fabricating learning evidence.
 * Completion means the block was completed, not that mastery was proven.
 */
export function reconcileRemediationExecution(
  state: StudyState,
  plan: RemediationExecutionPlan
): RemediationExecutionPlan {
  const steps = plan.steps.map(step => ({
    ...step,
    status: stepStatusForSession(step, state.sessions),
  }));
  const allComplete =
    steps.length > 0 && steps.every(step => step.status === "completed");
  const active = steps.some(step => step.status === "active");
  const next = steps.find(step => step.status !== "completed");

  return {
    ...plan,
    steps,
    status: allComplete
      ? "needs_reassessment"
      : active
        ? "in_progress"
        : "ready",
    nextStepId: next?.id,
    summary: allComplete
      ? "Remediation steps are complete. Fresh assessment evidence is required for reassessment."
      : next
        ? `Continue with ${next.action} ${next.topic}.`
        : "No remediation step is currently executable.",
  };
}
