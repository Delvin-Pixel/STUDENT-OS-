import {
  getAssessmentIntelligence,
  type AssessmentConceptSignal,
} from "./assessmentIntelligence";
import {
  getKnowledgeGaps,
  getLearningPath,
  type KnowledgeGap,
} from "./learningIntelligence";
import type { StudyState } from "./types";

export type RemediationReason =
  | "concept_signal"
  | "prerequisite_gap"
  | "insufficient_evidence"
  | "ready_to_verify"
  | "no_signal";

export type RemediationNode = {
  topicId: string;
  topic: string;
  kind: "concept" | "prerequisite" | "target" | "verification";
  action: "learn" | "review" | "practice" | "verify";
  route: "/study" | "/study-materials" | "/quizzes";
  duration: number;
  reason: string;
};

export type AssessmentRemediationPlan = {
  topicId: string;
  status: "targeted" | "prerequisite_first" | "needs_diagnosis" | "verify";
  reason: RemediationReason;
  conceptSignal?: AssessmentConceptSignal;
  knowledgeGap?: KnowledgeGap;
  nodes: RemediationNode[];
  summary: string;
};

function signalToNode(
  signal: AssessmentConceptSignal,
  topicId: string
): RemediationNode {
  return {
    topicId,
    topic: signal.label,
    kind: "concept",
    action:
      signal.recommendedAction === "recheck"
        ? "verify"
        : signal.recommendedAction,
    route: signal.recommendedAction === "review" ? "/study" : "/quizzes",
    duration: signal.recommendedAction === "review" ? 15 : 20,
    reason: signal.reason,
  };
}

/**
 * B41 turns assessment signals into an explainable remediation graph.
 * It never claims that an answer pattern proves a psychological misconception;
 * it only routes likely weak concepts through canonical prerequisite links.
 */
export function getAssessmentRemediationPlan(
  state: StudyState,
  topicId: string,
  today = new Date().toISOString().slice(0, 10)
): AssessmentRemediationPlan | null {
  const intelligence = getAssessmentIntelligence(state, topicId);
  const primary = intelligence.primarySignal;
  const path = getLearningPath(state, topicId, today);
  const gaps = getKnowledgeGaps(state, topicId, today);

  if (primary?.misses && primary.severity === "high") {
    const prerequisiteGap = gaps.find(gap => gap.kind === "prerequisite");
    if (prerequisiteGap) {
      const prerequisitePath = getLearningPath(
        state,
        prerequisiteGap.topicId,
        today
      );
      const nodes = (prerequisitePath?.steps ?? []).map(step => ({
        topicId: step.topicId,
        topic: step.topic,
        kind: step.kind,
        action: step.action,
        route: step.route,
        duration: step.duration,
        reason: step.reason,
      }));
      return {
        topicId,
        status: "prerequisite_first",
        reason: "prerequisite_gap",
        conceptSignal: primary,
        knowledgeGap: prerequisiteGap,
        nodes,
        summary: `${primary.label} is showing a strong assessment signal, but ${prerequisiteGap.topic} should be strengthened before another full-topic attempt.`,
      };
    }

    return {
      topicId,
      status: "targeted",
      reason: "concept_signal",
      conceptSignal: primary,
      nodes: [signalToNode(primary, topicId)],
      summary: `Target ${primary.label} with focused remediation, then verify it with fresh questions.`,
    };
  }

  const prerequisiteGap = gaps.find(gap => gap.kind === "prerequisite");
  if (prerequisiteGap) {
    const gap = prerequisiteGap;
    const gapPath = getLearningPath(state, gap.topicId, today);
    return {
      topicId,
      status: "prerequisite_first",
      reason: "prerequisite_gap",
      knowledgeGap: gap,
      nodes: (gapPath?.steps ?? []).map(step => ({
        topicId: step.topicId,
        topic: step.topic,
        kind: step.kind,
        action: step.action,
        route: step.route,
        duration: step.duration,
        reason: step.reason,
      })),
      summary: `Strengthen ${gap.topic} before returning to the target topic.`,
    };
  }

  if (!primary && intelligence.attemptsConsidered === 0) {
    return {
      topicId,
      status: "needs_diagnosis",
      reason: "insufficient_evidence",
      nodes: [
        {
          topicId,
          topic: path?.targetTopic ?? topicId,
          kind: "target",
          action: "verify",
          route: "/quizzes",
          duration: 10,
          reason:
            "Run a varied diagnostic check before choosing a deeper remediation route.",
        },
      ],
      summary:
        "There is not enough response evidence to localize a concept yet; use a short varied diagnostic.",
    };
  }

  if (path?.status === "ready") {
    const verification = path.steps.find(step => step.kind === "verification");
    return {
      topicId,
      status: "verify",
      reason: "ready_to_verify",
      conceptSignal: primary,
      nodes: verification ? [{ ...verification }] : [],
      summary:
        "The topic is sufficiently ready; verify it with fresh questions before closing the remediation loop.",
    };
  }

  return {
    topicId,
    status: "needs_diagnosis",
    reason: "no_signal",
    conceptSignal: primary,
    nodes: primary ? [signalToNode(primary, topicId)] : [],
    summary:
      "No concentrated concept signal is strong enough to justify deeper remediation yet.",
  };
}
