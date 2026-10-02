import {
  getExecutionFeedback,
  getRecoveryRecommendation,
} from "./learningIntelligence";
import type {
  TransitionLearningPlan,
  TransitionLearningPlanStep,
} from "./transitionLearningPlan";
import type { StudyState } from "./types";
import { addDays } from "./utils";

export type AdaptiveExecutionMode =
  "standard" | "shorten" | "extend" | "recover" | "recheck";

export interface TransitionExecutionStep {
  id: string;
  sourceRef: string;
  title: string;
  description: string;
  subject: string;
  topicId: string;
  topic: string;
  action: TransitionLearningPlanStep["action"];
  route: TransitionLearningPlanStep["route"];
  duration: number;
  originalDuration: number;
  priority: TransitionLearningPlanStep["priority"];
  date: string;
  mode: AdaptiveExecutionMode;
  reason: string;
  dependsOnStepId?: string;
}

export interface TransitionAdaptiveExecutionPlan {
  status: "ready" | "needs_learning_signal" | "no_capacity";
  startDate: string;
  endDate: string;
  dailyCapacityMinutes: number;
  totalMinutes: number;
  steps: TransitionExecutionStep[];
  notes: string[];
}

function boundedDuration(
  step: TransitionLearningPlanStep,
  feedbackDuration?: number,
  recoveryDuration?: number
) {
  const candidate = recoveryDuration ?? feedbackDuration ?? step.duration;
  return Math.max(10, Math.min(90, Math.round(candidate)));
}

function executionMode(
  step: TransitionLearningPlanStep,
  feedback: ReturnType<typeof getExecutionFeedback>,
  recovery: ReturnType<typeof getRecoveryRecommendation>
): AdaptiveExecutionMode {
  if (step.action === "verify") return "recheck";
  if (recovery) return "recover";
  if (feedback.signal === "shorten") return "shorten";
  if (feedback.signal === "extend") return "extend";
  return "standard";
}

function executionReason(
  step: TransitionLearningPlanStep,
  feedback: ReturnType<typeof getExecutionFeedback>,
  recovery: ReturnType<typeof getRecoveryRecommendation>
) {
  if (recovery) return recovery.reason;
  if (feedback.signal !== "stable") return feedback.reason;
  return `Use the planned ${step.duration}-minute block and let new evidence determine whether the next step should change.`;
}

/**
 * Converts a transition-aware learning plan into an execution plan that reacts
 * to recent learner behavior. This is read-only: it schedules recommendations
 * but never creates tasks, sessions, evidence, or mastery.
 */
export function getTransitionAdaptiveExecutionPlan(
  state: StudyState,
  plan: TransitionLearningPlan,
  dailyCapacityMinutes: number,
  startDate: string,
  maxDays = 30
): TransitionAdaptiveExecutionPlan {
  const capacity = Math.max(0, Math.floor(dailyCapacityMinutes));
  const boundedDays = Math.max(1, Math.min(60, Math.floor(maxDays)));
  if (plan.steps.length === 0) {
    return {
      status: plan.status,
      startDate,
      endDate: startDate,
      dailyCapacityMinutes: capacity,
      totalMinutes: 0,
      steps: [],
      notes: [plan.summary],
    };
  }
  if (capacity < 10) {
    return {
      status: "no_capacity",
      startDate,
      endDate: startDate,
      dailyCapacityMinutes: capacity,
      totalMinutes: 0,
      steps: [],
      notes: [
        capacity <= 0
          ? "No study capacity was supplied, so Student OS will not pretend the transition plan is scheduled."
          : "Less than 10 minutes of daily capacity is too small for a reliable transition learning block. Student OS will leave the work unscheduled instead of exceeding the learner's limit.",
      ],
    };
  }

  const steps: TransitionExecutionStep[] = [];
  const notes: string[] = [];
  let dayIndex = 0;
  let usedToday = 0;

  for (const step of plan.steps) {
    const feedback = getExecutionFeedback(state, step.topicId, step.subject);
    const recovery = getRecoveryRecommendation(
      state,
      step.topicId,
      step.subject,
      startDate
    );
    const duration = boundedDuration(
      step,
      feedback.completedSessions >= 2 ? feedback.preferredDuration : undefined,
      recovery?.duration
    );

    const fittedDuration = Math.min(duration, capacity);
    if (usedToday + fittedDuration > capacity) {
      dayIndex += 1;
      usedToday = 0;
    }
    if (dayIndex >= boundedDays) break;

    const date = addDays(startDate, dayIndex);
    const mode = executionMode(step, feedback, recovery);
    const wasFitted = fittedDuration < duration;
    steps.push({
      id: `transition-execution:${step.sourceRef}:${date}`,
      sourceRef: step.sourceRef,
      title: step.title,
      description: wasFitted
        ? `${step.description} Fitted from ${duration} to ${fittedDuration} minutes to respect today's capacity.`
        : step.description,
      subject: step.subject,
      topicId: step.topicId,
      topic: step.topic,
      action: step.action,
      route: step.route,
      duration: fittedDuration,
      originalDuration: step.duration,
      priority: step.priority,
      date,
      mode,
      reason: wasFitted
        ? `${executionReason(step, feedback, recovery)} The block was bounded by the learner's available capacity.`
        : executionReason(step, feedback, recovery),
      dependsOnStepId: steps.at(-1)?.id,
    });
    usedToday += fittedDuration;
    if (wasFitted)
      notes.push(
        `${step.topic}: the planned block was fitted to the available daily capacity.`
      );

    if (feedback.signal === "recover" || recovery)
      notes.push(
        `${step.topic}: recent execution friction triggered a lower-friction recovery mode.`
      );
    else if (feedback.signal === "shorten")
      notes.push(
        `${step.topic}: recent difficulty shortened the next commitment.`
      );
    else if (feedback.signal === "extend")
      notes.push(
        `${step.topic}: recent stable execution permits a modest duration increase.`
      );
  }

  const totalMinutes = steps.reduce((sum, step) => sum + step.duration, 0);
  const endDate = steps.length ? steps[steps.length - 1].date : startDate;
  return {
    status: steps.length ? "ready" : "no_capacity",
    startDate,
    endDate,
    dailyCapacityMinutes: capacity,
    totalMinutes,
    steps,
    notes: notes.length
      ? notes
      : [
          "The plan is scheduled using the learner's stated capacity and current evidence.",
        ],
  };
}
