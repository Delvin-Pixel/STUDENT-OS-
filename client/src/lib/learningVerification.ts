import { getAssessmentIntelligence } from "./assessmentIntelligence";
import { getEvidenceTrust } from "./assessmentTrust";
import {
  getLearningPath,
  reassessTopicMastery,
  type LearningPath,
  type MasteryReassessment,
} from "./learningIntelligence";
import type { LearningEvidence, StudyState } from "./types";

export type VerificationOutcome =
  | "closed"
  | "improved"
  | "still_needs_work"
  | "regressed"
  | "insufficient_evidence"
  | "no_new_evidence";

export type VerificationEscalation =
  | "none"
  | "more_practice"
  | "prerequisite_review"
  | "method_change"
  | "varied_assessment"
  | "teacher_support";

export type LearningVerification = {
  topicId: string;
  outcome: VerificationOutcome;
  baseline: MasteryReassessment["previous"];
  current: MasteryReassessment["current"];
  evidenceIds: string[];
  trustedDirectEvidenceCount: number;
  freshDirectEvidenceCount: number;
  assessmentConfidence: number;
  improvementDelta: number;
  verificationPass: boolean;
  escalation: VerificationEscalation;
  reason: string;
  nextAction: "maintain" | "review" | "practice" | "learn";
};

export type LearningVerificationResult = {
  topicId: string;
  targetTopic: string;
  stepsCompleted: number;
  stepsTotal: number;
  pathClosed: boolean;
  verification: LearningVerification;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function isDirect(evidence: LearningEvidence) {
  return (
    (evidence.kind === "quiz" || evidence.kind === "practice") &&
    typeof evidence.score === "number"
  );
}

function distinctFreshDirectEvidence(evidence: LearningEvidence[]) {
  const seen = new Set<string>();
  return evidence.filter(entry => {
    if (!isDirect(entry)) return false;
    const key = entry.sourceId
      ? `${entry.kind}:${entry.sourceId}`
      : `${entry.kind}:${entry.recordedAt}:${entry.score}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function escalationFor(
  outcome: VerificationOutcome,
  current: LearningVerification["current"],
  state: StudyState,
  topicId: string
): VerificationEscalation {
  if (outcome === "closed") return "none";
  if (current.confidence < 50) return "varied_assessment";
  const gaps =
    state.topics.find(topic => topic.id === topicId)?.prerequisiteTopicIds ??
    [];
  if (gaps.length > 0 && current.readiness < 55) return "prerequisite_review";
  const intelligence = getAssessmentIntelligence(state, topicId);
  if (intelligence.primarySignal?.severity === "high") return "method_change";
  if (outcome === "regressed") return "more_practice";
  if (outcome === "still_needs_work") return "more_practice";
  return "varied_assessment";
}

/**
 * B43 verifies whether a remediation intervention changed the canonical
 * learning state. It is read-only: caller state is never mutated.
 * A study block alone never passes verification; trusted fresh direct evidence
 * is required to close a learning gap.
 */
export function verifyLearningIntervention(
  state: StudyState,
  topicId: string,
  newEvidence: LearningEvidence[] = [],
  today = new Date().toISOString().slice(0, 10)
): LearningVerification | null {
  const reassessment = reassessTopicMastery(state, topicId, newEvidence, today);
  if (!reassessment) return null;

  if (reassessment.outcome === "no_new_evidence") {
    return {
      topicId,
      outcome: "no_new_evidence",
      baseline: reassessment.previous,
      current: reassessment.current,
      evidenceIds: [],
      trustedDirectEvidenceCount: 0,
      freshDirectEvidenceCount: 0,
      assessmentConfidence: 0,
      improvementDelta: 0,
      verificationPass: false,
      escalation: "varied_assessment",
      reason:
        "The remediation may have been completed, but no new assessment evidence was supplied, so the learning change cannot be verified.",
      nextAction: reassessment.nextAction,
    };
  }

  const accepted = newEvidence.filter(entry => entry.topicId === topicId);
  const direct = distinctFreshDirectEvidence(accepted);
  const trusted = direct.filter(
    entry =>
      getEvidenceTrust(entry, state.learningEvidence, today).label !==
      "rejected"
  );
  const assessmentConfidence =
    direct.length === 0
      ? 0
      : clamp(Math.round((trusted.length / direct.length) * 100));
  const improvementDelta = reassessment.readinessDelta;
  const verificationPass =
    trusted.some(entry => (entry.score ?? 0) >= 70) &&
    reassessment.current.readiness >= 70 &&
    reassessment.current.confidence >= 50;

  let outcome: VerificationOutcome =
    reassessment.outcome === "confirmed"
      ? "still_needs_work"
      : reassessment.outcome;
  if (reassessment.readinessDelta < -5) outcome = "regressed";
  else if (verificationPass)
    outcome = reassessment.previous.readiness >= 70 ? "closed" : "improved";
  else if (direct.length === 0) outcome = "insufficient_evidence";
  else if (reassessment.readinessDelta <= 0) outcome = "still_needs_work";

  const escalation = escalationFor(
    outcome,
    reassessment.current,
    state,
    topicId
  );
  const reason =
    outcome === "closed"
      ? "Fresh trusted assessment evidence meets the readiness threshold, so the remediation gap can be considered closed."
      : outcome === "improved"
        ? "Fresh evidence improved the learning signal, but the topic is not yet consistently strong enough to close the intervention."
        : outcome === "regressed"
          ? "Fresh evidence is weaker than the previous baseline; recover with targeted practice before expanding the workload."
          : outcome === "insufficient_evidence"
            ? "The intervention cannot be judged from study time alone; collect varied direct assessment evidence."
            : "The new evidence did not establish reliable readiness yet; continue targeted remediation and reassess with fresh questions.";

  return {
    topicId,
    outcome,
    baseline: reassessment.previous,
    current: reassessment.current,
    evidenceIds: trusted.map(entry => entry.id),
    trustedDirectEvidenceCount: trusted.length,
    freshDirectEvidenceCount: direct.length,
    assessmentConfidence,
    improvementDelta,
    verificationPass,
    escalation,
    reason,
    nextAction: outcome === "closed" ? "maintain" : reassessment.nextAction,
  };
}

/** Verifies the target of a B37 learning path after fresh intervention evidence. */
export function verifyLearningPathIntervention(
  state: StudyState,
  path: LearningPath,
  newEvidence: LearningEvidence[] = [],
  today = new Date().toISOString().slice(0, 10)
): LearningVerificationResult | null {
  const verification = verifyLearningIntervention(
    state,
    path.topicId,
    newEvidence,
    today
  );
  if (!verification) return null;

  const pathState: StudyState = newEvidence.length
    ? {
        ...state,
        learningEvidence: [
          ...state.learningEvidence,
          ...newEvidence.filter(entry =>
            path.steps.some(step => step.topicId === entry.topicId)
          ),
        ],
      }
    : state;
  const refreshedPath = getLearningPath(pathState, path.topicId, today) ?? path;
  const stepsCompleted = refreshedPath.steps.filter(step => {
    const reassessed = reassessTopicMastery(pathState, step.topicId, [], today);
    const signal = reassessed?.current;
    return step.kind === "verification"
      ? Boolean(signal?.latestDirectScore !== undefined)
      : Boolean(signal && signal.readiness >= 70 && signal.confidence >= 50);
  }).length;
  const pathClosed =
    verification.verificationPass &&
    verification.outcome !== "regressed" &&
    refreshedPath.status === "ready";

  return {
    topicId: path.topicId,
    targetTopic: path.targetTopic,
    stepsCompleted,
    stepsTotal: refreshedPath.steps.length,
    pathClosed,
    verification,
  };
}
