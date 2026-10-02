import type { TransitionAcademicPreparation } from "./transitionAcademicPreparation";
import type { TransitionAdaptiveExecutionPlan } from "./transitionAdaptiveExecution";
import type { TransitionLearningPlan } from "./transitionLearningPlan";
import type { StudyState } from "./types";

export type TransitionLoopStatus =
  | "ready"
  | "needs_preparation"
  | "needs_recheck"
  | "needs_evidence"
  | "complete";

export type TransitionLoopAction =
  | "continue_learning"
  | "complete_recheck"
  | "collect_evidence"
  | "maintain_foundation"
  | "review_transition_options";

export interface TransitionLoopDecision {
  status: TransitionLoopStatus;
  action: TransitionLoopAction;
  title: string;
  reason: string;
  sourceRefs: string[];
  affectedSubjects: string[];
  affectedTopicIds: string[];
  completionSignal: number;
}

export interface TransitionClosedLoopResult {
  status: TransitionLoopStatus;
  cycle: number;
  decision: TransitionLoopDecision;
  nextExecutionStepId?: string;
  remainingPreparation: number;
  remainingRechecks: number;
  evidenceGaps: string[];
  notes: string[];
}

function normalize(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ");
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

/**
 * Closes the transition -> learning -> execution -> evidence loop without mutating state.
 * Execution alone never closes a transition gap: a fresh foundation recheck or explicit
 * learner evidence is required before the loop can report completion.
 *
 * `scopeSubjects` lets the caller keep completion tied to the transition requirements.
 * Without a transition-linked subject scope, unrelated strong foundation checks must not
 * be used to claim that transition preparation is complete.
 */
export function getTransitionClosedLoop(
  state: StudyState,
  preparation: TransitionAcademicPreparation[],
  plan: TransitionLearningPlan,
  execution: TransitionAdaptiveExecutionPlan,
  cycle = 1,
  scopeSubjects: string[] = []
): TransitionClosedLoopResult {
  const checks = state.foundationChecks ?? [];
  const activePreparation = preparation.filter(
    item =>
      item.kind === "foundation_remediation" ||
      item.kind === "foundation_recheck"
  );
  const affectedSubjects = unique([
    ...scopeSubjects,
    ...preparation.map(item => item.subject),
    ...plan.steps.map(step => step.subject),
  ]);
  const subjectKeys = new Set(affectedSubjects.map(normalize).filter(Boolean));
  const scopedChecks = subjectKeys.size
    ? checks.filter(check => subjectKeys.has(normalize(check.subject)))
    : [];
  const affectedTopicIds = unique([
    ...preparation.map(item => item.topicId ?? ""),
    ...plan.steps.map(step => step.topicId),
    ...scopedChecks.flatMap(check => [
      ...(check.remediationTopicIds ?? []),
      ...(check.focusTopicIds ?? []),
    ]),
  ]);

  const remainingPreparation = scopedChecks.filter(
    check => check.attentionStatus === "needs_remediation"
  ).length;
  const remainingRechecks = scopedChecks.filter(
    check =>
      check.attentionStatus === "ready_to_recheck" || check.status === "due"
  ).length;

  const evidenceGaps = scopedChecks
    .filter(
      check =>
        check.attentionStatus === "needs_remediation" ||
        check.attentionStatus === "ready_to_recheck" ||
        check.status === "due"
    )
    .map(
      check =>
        `${check.subject}: ${check.lastOutcomeSummary ?? "fresh foundation evidence is still needed"}`
    );

  const nextStep = execution.steps[0];

  if (!subjectKeys.size && !plan.steps.length) {
    return {
      status: "needs_evidence",
      cycle,
      decision: {
        status: "needs_evidence",
        action: "collect_evidence",
        title: "Connect transition requirements to academic evidence",
        reason:
          "There is no transition-linked subject or topic scope yet, so Student OS cannot safely use unrelated foundation checks to close this preparation loop.",
        sourceRefs: [],
        affectedSubjects: [],
        affectedTopicIds: [],
        completionSignal: 0,
      },
      remainingPreparation: 0,
      remainingRechecks: 0,
      evidenceGaps: [
        "No transition-linked subject or topic evidence is available yet.",
      ],
      notes: [
        "Student OS will not invent readiness from unrelated academic evidence.",
      ],
    };
  }

  if (remainingPreparation > 0) {
    return {
      status: "needs_preparation",
      cycle,
      decision: {
        status: "needs_preparation",
        action: "continue_learning",
        title:
          "Continue foundation repair before relying on this transition signal",
        reason:
          "One or more transition-linked foundation checks still report an active remediation need. Keep the preparation loop focused on those weaknesses.",
        sourceRefs: unique(activePreparation.map(item => item.sourceRef)),
        affectedSubjects,
        affectedTopicIds,
        completionSignal: 0,
      },
      nextExecutionStepId: nextStep?.id,
      remainingPreparation,
      remainingRechecks,
      evidenceGaps,
      notes: [
        "Completed study time is execution evidence, not proof that the foundation gap is closed.",
      ],
    };
  }

  if (remainingRechecks > 0) {
    const recheckRefs = unique(
      activePreparation
        .filter(item => item.kind === "foundation_recheck")
        .map(item => item.sourceRef)
    );
    return {
      status: "needs_recheck",
      cycle,
      decision: {
        status: "needs_recheck",
        action: "complete_recheck",
        title: "Freshly recheck the transition-linked foundation",
        reason:
          "At least one relevant foundation signal is due or ready for verification. A fresh check should decide the next loop state.",
        sourceRefs: recheckRefs.length
          ? recheckRefs
          : unique(
              scopedChecks.map(
                check => `transition-prep:foundation:${check.id}`
              )
            ),
        affectedSubjects,
        affectedTopicIds,
        completionSignal: 70,
      },
      nextExecutionStepId:
        execution.steps.find(step => step.action === "verify")?.id ??
        nextStep?.id,
      remainingPreparation,
      remainingRechecks,
      evidenceGaps,
      notes: [
        "A recheck must use fresh assessment evidence; repeating the same study activity does not close the loop.",
      ],
    };
  }

  const allScopedChecksStrong =
    scopedChecks.length > 0 &&
    scopedChecks.every(
      check =>
        check.status === "completed" &&
        check.attentionStatus === "none" &&
        (check.lastScore ?? 0) >= 85
    );
  if (allScopedChecksStrong) {
    return {
      status: "complete",
      cycle,
      decision: {
        status: "complete",
        action: "maintain_foundation",
        title: "Transition preparation signal is currently satisfied",
        reason:
          "All transition-linked foundation checks are complete, have no active attention state, and meet the existing strong-foundation threshold. Keep them on a later maintenance cycle rather than declaring admission or eligibility.",
        sourceRefs: unique(
          scopedChecks.map(check => `transition-prep:foundation:${check.id}`)
        ),
        affectedSubjects,
        affectedTopicIds,
        completionSignal: 100,
      },
      remainingPreparation: 0,
      remainingRechecks: 0,
      evidenceGaps: [],
      notes: [
        "This closes the academic-preparation loop only; it does not guarantee admission, placement, or eligibility.",
      ],
    };
  }

  const hasTopicEvidence =
    affectedTopicIds.length > 0 &&
    state.learningEvidence.some(evidence =>
      affectedTopicIds.includes(evidence.topicId)
    );
  if (!hasTopicEvidence && plan.steps.length === 0) {
    return {
      status: "needs_evidence",
      cycle,
      decision: {
        status: "needs_evidence",
        action: "collect_evidence",
        title: "Collect a topic-level learning signal",
        reason:
          "Transition preparation has no active remediation warning, but there is not enough transition-linked topic evidence to make a confident next decision.",
        sourceRefs: [],
        affectedSubjects,
        affectedTopicIds,
        completionSignal: 50,
      },
      remainingPreparation,
      remainingRechecks,
      evidenceGaps: [
        "Topic-level evidence is missing for the transition-linked preparation.",
      ],
      notes: [
        "Student OS keeps uncertainty visible instead of converting missing evidence into a readiness claim.",
      ],
    };
  }

  return {
    status: "ready",
    cycle,
    decision: {
      status: "ready",
      action: "review_transition_options",
      title: "Review the transition options with the latest evidence",
      reason:
        "The current transition-linked foundation signals do not require immediate remediation. Re-evaluate the decision using the newest academic evidence and current requirements.",
      sourceRefs: unique(preparation.map(item => item.sourceRef)),
      affectedSubjects,
      affectedTopicIds,
      completionSignal: 85,
    },
    nextExecutionStepId: nextStep?.id,
    remainingPreparation,
    remainingRechecks,
    evidenceGaps,
    notes: [
      "Transition readiness remains a decision-support signal and must not be presented as an admission guarantee.",
    ],
  };
}
