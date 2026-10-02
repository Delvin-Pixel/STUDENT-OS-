import { getLearningPath, type LearningPathStep } from "./learningIntelligence";
import type { TransitionAcademicPreparation } from "./transitionAcademicPreparation";
import type { AcademicStage, StudyState } from "./types";

export interface TransitionLearningPlanStep {
  id: string;
  title: string;
  description: string;
  subject: string;
  topicId: string;
  topic: string;
  action: LearningPathStep["action"];
  route: LearningPathStep["route"];
  duration: number;
  priority: "high" | "medium" | "low";
  sourceRef: string;
  prerequisiteStepId?: string;
}

export interface TransitionLearningPlan {
  status: "ready" | "needs_learning_signal";
  summary: string;
  steps: TransitionLearningPlanStep[];
}

function titleFor(step: LearningPathStep): string {
  switch (step.action) {
    case "learn":
      return `Learn ${step.topic}`;
    case "practice":
      return `Practice ${step.topic}`;
    case "review":
      return `Review ${step.topic}`;
    case "verify":
      return `Verify ${step.topic}`;
  }
}

function priorityFor(
  step: LearningPathStep,
  index: number
): TransitionLearningPlanStep["priority"] {
  if (step.kind === "prerequisite") return index === 0 ? "high" : "medium";
  if (step.action === "verify") return "medium";
  return "high";
}

/**
 * Converts transition academic-preparation recommendations into the same ordered
 * learning-path steps used by ordinary study. This is read-only and deterministic;
 * it does not create tasks or change mastery by itself.
 */
export function getTransitionLearningPlan(
  stage: AcademicStage,
  preparation: TransitionAcademicPreparation[],
  state: StudyState,
  limit = 8,
  today = new Date().toISOString().slice(0, 10)
): TransitionLearningPlan {
  const results: TransitionLearningPlanStep[] = [];
  const seen = new Set<string>();

  for (const item of preparation) {
    if (!item.topicId) continue;
    const path = getLearningPath(state, item.topicId, today);
    if (!path) continue;

    path.steps.forEach((step, index) => {
      const key = `${step.topicId}:${step.action}`;
      if (seen.has(key)) return;
      seen.add(key);
      const id = `transition-learning:${item.sourceRef.replace(/^transition-prep:/, "")}:${step.id}`;
      const prior = results.at(-1);
      results.push({
        id,
        title: titleFor(step),
        description: `${step.reason} ${stage === "SHS" ? "Use this as post-SHS preparation evidence, not an admission guarantee." : "Use this as academic preparation, not as proof of eligibility."}`,
        subject: step.subject,
        topicId: step.topicId,
        topic: step.topic,
        action: step.action,
        route: step.route,
        duration: step.duration,
        priority: priorityFor(step, index),
        sourceRef: id,
        prerequisiteStepId: prior?.id,
      });
      if (results.length >= Math.max(1, Math.min(12, limit))) return;
    });
    if (results.length >= Math.max(1, Math.min(12, limit))) break;
  }

  return {
    status: results.length ? "ready" : "needs_learning_signal",
    summary: results.length
      ? `A transition-aware learning sequence is ready: ${results.length} step${results.length === 1 ? "" : "s"} drawn from the existing evidence and prerequisite graph.`
      : "No topic-linked learning path is available yet. Student OS can still keep the transition preparation signal without inventing a learning result.",
    steps: results,
  };
}
