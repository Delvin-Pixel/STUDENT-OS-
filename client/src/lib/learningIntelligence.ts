import { WORKSPACE_STUDY_PLAN_ITEM_LIMIT } from "@shared/workspaceSchema";
import { getEvidenceTrust } from "./assessmentTrust";
import {
  getActionDecisionIndex,
  prioritizeNextActions,
} from "./priorityEngine";
import { getRemainingTaskMinutes, getTaskRecoveryKind } from "./taskExecution";
import type {
  ExamTopic,
  LearningEvidence,
  StudyPlan,
  StudyPlanItem,
  StudySession,
  StudyState,
  SubjectTopic,
} from "./types";
import { addDays, daysBetween, isoDate, todayStr } from "./utils";

export type TopicMastery = {
  topicId: string;
  subject: string;
  topic: string;
  score: number;
  /** Separate from score: how trustworthy the estimate is based on evidence quality/count. */
  confidence: number;
  /** 0–100 freshness of the newest learning signal. */
  freshness: number;
  /** Multiplicative recency factor applied to the newest signal. */
  decayMultiplier: number;
  /** Latest direct assessment result, when one exists. */
  latestDirectScore?: number;
  /** Calendar day of the latest signal, when one exists. */
  latestEvidenceAt?: string;
  /** Readiness combines mastery strength with evidence confidence. */
  readiness: number;
  /** 0–100 pressure from the nearest exam containing this topic. */
  examPressure: number;
  evidenceCount: number;
  directEvidenceCount: number;
  estimated: boolean;
};

export type NextAction = {
  id: string;
  kind: "task" | "study" | "flashcards" | "session";
  title: string;
  detail: string;
  subject?: string;
  topic?: string;
  topicId?: string;
  duration: number;
  score: number;
  reason: string;
  route: "/tasks" | "/study" | "/flashcards" | "/today";
};

/**
 * Carries a deterministic study recommendation to the planner without trusting
 * display labels from the URL. The planner resolves this opaque topic ID from
 * the learner's canonical workspace before pre-filling a new session.
 */
export function getNextActionHref(
  action: Pick<NextAction, "kind" | "route" | "topicId">
) {
  return action.kind === "study" && action.topicId
    ? getTopicRecommendationHref("/study", action.topicId)
    : action.route;
}

/** Builds a URL carrying only a canonical topic identifier to a review surface. */
export function getTopicRecommendationHref(
  route: "/study" | "/quizzes",
  topicId: string
) {
  return `${route}?topicId=${encodeURIComponent(topicId)}`;
}

export type ExecutionCoach = {
  session: StudySession;
  action: NextAction;
};

export type ExamReadiness = {
  readiness: number;
  coverage: number;
  evidenceBackedTopics: number;
  strongTopics: string[];
  needsAttentionTopics: string[];
  recommendedSessions: number;
  /** Weighted count of topics where the signal is both weak and decision-ready. */
  highPriorityTopics: number;
  /** 0–100 confidence that the exam-level readiness number is evidence-backed. */
  confidence: number;
  /** Human-readable first move produced by the same deterministic ranking model. */
  nextMove?: {
    topicId: string;
    topic: string;
    reason: string;
    duration: number;
  };
};

export type ExamStrategyTopic = {
  topicId: string;
  topic: string;
  mastery: number;
  readiness: number;
  confidence: number;
  examPressure: number;
  priority: number;
  duration: number;
  action: "learn" | "practice" | "review" | "maintain";
  reason: string;
};

export type DueReviewQueue = {
  total: number;
  subjects: Array<{ subject: string; count: number; deckIds: string[] }>;
};

export type ExecutionFeedback = {
  topicId?: string;
  sessionsConsidered: number;
  completedSessions: number;
  skippedSessions: number;
  rescheduledSessions: number;
  difficultOrConfused: number;
  completionRate: number;
  struggleRate: number;
  averagePlannedMinutes: number;
  averageActualMinutes: number;
  suggestedDurationDelta: number;
  /** Percentage of skipped sessions attributed to running out of time. */
  noTimeSkipRate: number;
  /** A conservative duration derived from completed learner-confirmed sessions. */
  preferredDuration?: number;
  /** 0–100 bounded signal describing whether the learner's recent execution is stable. */
  executionFit: number;
  signal: "stable" | "shorten" | "extend" | "recover";
  reason: string;
};

export type RecoveryActionKind =
  | "shorten_session"
  | "prerequisite_review"
  | "retrieve_material"
  | "reschedule"
  | "change_method";

export type KnowledgeGap = {
  topicId: string;
  topic: string;
  subject: string;
  kind: "prerequisite" | "direct";
  severity: "high" | "medium" | "low";
  mastery: number;
  confidence: number;
  reason: string;
  route: "/study" | "/quizzes";
};

function gapSeverity(
  readiness: number,
  confidence: number
): KnowledgeGap["severity"] {
  if (readiness < 45 || (readiness < 60 && confidence < 50)) return "high";
  if (readiness < 70 || confidence < 45) return "medium";
  return "low";
}

/**
 * Finds the smallest evidence-backed knowledge gap behind a struggling topic.
 * Explicit prerequisite links are authoritative. A weak prerequisite outranks
 * the current topic; without one, the current topic itself is returned as a
 * direct gap. This function is deterministic and read-only.
 */
export function getKnowledgeGaps(
  state: StudyState,
  topicId: string,
  today = todayStr()
): KnowledgeGap[] {
  const mastery = getTopicMastery(state, today);
  const target = mastery.find(entry => entry.topicId === topicId);
  if (!target) return [];

  const topic = uniqueTopics(state).find(entry => entry.id === topicId);
  if (!topic) return [];

  const gaps: KnowledgeGap[] = [];
  for (const prerequisiteId of topic.prerequisiteTopicIds ?? []) {
    if (prerequisiteId === topicId) continue;
    const prerequisite = mastery.find(
      entry => entry.topicId === prerequisiteId
    );
    const prerequisiteTopic = uniqueTopics(state).find(
      entry => entry.id === prerequisiteId
    );
    if (!prerequisite || !prerequisiteTopic) continue;
    if (prerequisite.readiness >= 70 && prerequisite.confidence >= 50) continue;
    gaps.push({
      topicId: prerequisite.topicId,
      topic: prerequisite.topic,
      subject: prerequisite.subject,
      kind: "prerequisite",
      severity: gapSeverity(prerequisite.readiness, prerequisite.confidence),
      mastery: prerequisite.score,
      confidence: prerequisite.confidence,
      reason: `This prerequisite is weaker than the current topic requires${prerequisiteTopic.learningObjective ? `: ${prerequisiteTopic.learningObjective}` : "."}`,
      route: prerequisite.confidence < 50 ? "/study" : "/quizzes",
    });
  }

  if (gaps.length > 0) {
    return gaps.sort((a, b) => {
      const severity = { high: 3, medium: 2, low: 1 };
      return (
        severity[b.severity] - severity[a.severity] ||
        a.mastery - b.mastery ||
        a.topic.localeCompare(b.topic)
      );
    });
  }

  if (target.readiness < 70 || target.confidence < 50) {
    return [
      {
        topicId: target.topicId,
        topic: target.topic,
        subject: target.subject,
        kind: "direct",
        severity: gapSeverity(target.readiness, target.confidence),
        mastery: target.score,
        confidence: target.confidence,
        reason:
          target.confidence < 50
            ? "There is not enough direct evidence yet. Use a short learning or diagnostic step before assuming the gap is deeper."
            : "The topic itself remains below a reliable readiness threshold, so target the exact concept before expanding the workload.",
        route: target.confidence < 50 ? "/study" : "/quizzes",
      },
    ];
  }

  return [];
}

export type LearningPathStep = {
  id: string;
  topicId: string;
  topic: string;
  subject: string;
  kind: "prerequisite" | "target" | "verification";
  action: "learn" | "practice" | "review" | "verify";
  route: "/study" | "/study-materials" | "/quizzes";
  duration: number;
  reason: string;
};

export type LearningPath = {
  topicId: string;
  targetTopic: string;
  subject: string;
  status: "ready" | "needs_prerequisite" | "needs_evidence";
  steps: LearningPathStep[];
  summary: string;
};

function learningPathStepForTopic(
  topic: SubjectTopic,
  mastery: TopicMastery | undefined,
  kind: "prerequisite" | "target",
  state: StudyState
): LearningPathStep {
  const hasMaterial = state.studyMaterials.some(
    material =>
      material.topicId === topic.id ||
      (!material.topicId && material.subject === topic.subject)
  );
  const readiness = mastery?.readiness ?? 0;
  const confidence = mastery?.confidence ?? 0;

  if (kind === "prerequisite") {
    const action = confidence < 50 ? "learn" : "review";
    return {
      id: `${kind}-${topic.id}`,
      topicId: topic.id,
      topic: topic.name,
      subject: topic.subject,
      kind,
      action,
      route: action === "learn" && hasMaterial ? "/study-materials" : "/study",
      duration: action === "learn" ? 20 : 15,
      reason:
        confidence < 50
          ? "Build enough foundation evidence before returning to the target topic."
          : "Refresh this prerequisite until its readiness is reliable enough to support the target topic.",
    };
  }

  if (confidence < 50) {
    return {
      id: `${kind}-${topic.id}`,
      topicId: topic.id,
      topic: topic.name,
      subject: topic.subject,
      kind,
      action: "learn",
      route: hasMaterial ? "/study-materials" : "/study",
      duration: 25,
      reason:
        "There is not enough direct evidence yet; learn the concept before using a performance score to judge mastery.",
    };
  }

  return {
    id: `${kind}-${topic.id}`,
    topicId: topic.id,
    topic: topic.name,
    subject: topic.subject,
    kind,
    action: readiness < 70 ? "practice" : "review",
    route: "/quizzes",
    duration: readiness < 70 ? 20 : 15,
    reason:
      readiness < 70
        ? "Use targeted practice to move the topic from learning toward reliable readiness."
        : "The topic is sufficiently ready; use a short verification pass before marking the path complete.",
  };
}

/**
 * Builds an ordered, deterministic recovery-to-mastery path. Explicit
 * prerequisite links are traversed first, with cycle protection. The returned
 * path is a plan only: it never creates sessions, tasks, evidence, or mastery.
 */
export function getLearningPath(
  state: StudyState,
  topicId: string,
  today = todayStr()
): LearningPath | null {
  const topics = uniqueTopics(state);
  const target = topics.find(topic => topic.id === topicId);
  if (!target) return null;

  const mastery = getTopicMastery(state, today);
  const masteryById = new Map(mastery.map(entry => [entry.topicId, entry]));
  const steps: LearningPathStep[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  const visitPrerequisites = (current: SubjectTopic) => {
    if (visited.has(current.id) || visiting.has(current.id)) return;
    visiting.add(current.id);
    for (const prerequisiteId of current.prerequisiteTopicIds ?? []) {
      if (prerequisiteId === current.id || visiting.has(prerequisiteId))
        continue;
      const prerequisite = topics.find(topic => topic.id === prerequisiteId);
      if (!prerequisite) continue;
      const prerequisiteMastery = masteryById.get(prerequisite.id);
      if (
        (prerequisiteMastery?.readiness ?? 0) >= 70 &&
        (prerequisiteMastery?.confidence ?? 0) >= 50
      )
        continue;
      visitPrerequisites(prerequisite);
      steps.push(
        learningPathStepForTopic(
          prerequisite,
          prerequisiteMastery,
          "prerequisite",
          state
        )
      );
    }
    visiting.delete(current.id);
    visited.add(current.id);
  };

  visitPrerequisites(target);

  const targetMastery = masteryById.get(topicId);
  const targetReady =
    (targetMastery?.readiness ?? 0) >= 70 &&
    (targetMastery?.confidence ?? 0) >= 50;
  const hasPrerequisiteStep = steps.length > 0;
  steps.push(learningPathStepForTopic(target, targetMastery, "target", state));

  if (targetReady && !hasPrerequisiteStep) {
    steps.push({
      id: `verification-${target.id}`,
      topicId: target.id,
      topic: target.name,
      subject: target.subject,
      kind: "verification",
      action: "verify",
      route: "/quizzes",
      duration: 10,
      reason:
        "Close the loop with a fresh direct assessment before treating the target as secure.",
    });
  }

  const status: LearningPath["status"] = hasPrerequisiteStep
    ? "needs_prerequisite"
    : targetReady
      ? "ready"
      : "needs_evidence";

  return {
    topicId,
    targetTopic: target.name,
    subject: target.subject,
    status,
    steps,
    summary: hasPrerequisiteStep
      ? `Fix ${steps.length - 1} prerequisite step${steps.length - 1 === 1 ? "" : "s"} before returning to ${target.name}.`
      : targetReady
        ? `${target.name} is ready for a short verification pass.`
        : `Build direct evidence and readiness for ${target.name} before expanding the workload.`,
  };
}

export type MasteryReassessment = {
  topicId: string;
  previous: TopicMastery;
  current: TopicMastery;
  scoreDelta: number;
  readinessDelta: number;
  confidenceDelta: number;
  newDirectEvidenceCount: number;
  outcome: "confirmed" | "improved" | "still_needs_work" | "no_new_evidence";
  nextAction: "maintain" | "review" | "practice" | "learn";
  reason: string;
};

export type LearningPathReassessment = {
  topicId: string;
  targetTopic: string;
  stepsCompleted: number;
  stepsTotal: number;
  complete: boolean;
  reassessment: MasteryReassessment;
  summary: string;
};

/**
 * Recomputes a topic after new learner evidence without mutating workspace
 * state. This is the bridge from a completed path step back into the same
 * canonical mastery engine used by planning and priority.
 */
export function reassessTopicMastery(
  state: StudyState,
  topicId: string,
  newEvidence: LearningEvidence[] = [],
  today = todayStr()
): MasteryReassessment | null {
  const previous = getTopicMastery(state, today).find(
    entry => entry.topicId === topicId
  );
  if (!previous) return null;

  const accepted = newEvidence.filter(entry => entry.topicId === topicId);
  if (accepted.length === 0) {
    return {
      topicId,
      previous,
      current: previous,
      scoreDelta: 0,
      readinessDelta: 0,
      confidenceDelta: 0,
      newDirectEvidenceCount: 0,
      outcome: "no_new_evidence",
      nextAction:
        previous.confidence < 50
          ? "learn"
          : previous.readiness < 70
            ? "practice"
            : "maintain",
      reason:
        "No new evidence was supplied, so the existing mastery estimate remains unchanged.",
    };
  }

  const nextState: StudyState = {
    ...state,
    learningEvidence: [...state.learningEvidence, ...accepted],
  };
  const current = getTopicMastery(nextState, today).find(
    entry => entry.topicId === topicId
  )!;
  const newDirectEvidenceCount = accepted.filter(
    entry =>
      (entry.kind === "quiz" || entry.kind === "practice") &&
      typeof entry.score === "number"
  ).length;
  const scoreDelta = current.score - previous.score;
  const readinessDelta = current.readiness - previous.readiness;
  const confidenceDelta = current.confidence - previous.confidence;

  const outcome: MasteryReassessment["outcome"] =
    current.readiness >= 70 && current.confidence >= 50
      ? previous.readiness < 70 || previous.confidence < 50
        ? "improved"
        : "confirmed"
      : current.readiness > previous.readiness ||
          current.confidence > previous.confidence
        ? "improved"
        : "still_needs_work";
  const nextAction: MasteryReassessment["nextAction"] =
    current.confidence < 50
      ? "learn"
      : current.readiness < 70
        ? "practice"
        : current.readiness < 85
          ? "review"
          : "maintain";
  const reason =
    outcome === "confirmed"
      ? "New evidence confirms that the topic is already reliably ready; maintain it with light recall."
      : outcome === "improved"
        ? "New evidence improved the signal. Continue until readiness and confidence clear the reliable threshold."
        : outcome === "still_needs_work"
          ? "The new evidence did not establish reliable readiness yet; keep the next step targeted."
          : "No new evidence changed the estimate.";

  return {
    topicId,
    previous,
    current,
    scoreDelta,
    readinessDelta,
    confidenceDelta,
    newDirectEvidenceCount,
    outcome,
    nextAction,
    reason,
  };
}

/**
 * Reassesses the target of an existing learning path after fresh evidence.
 * Completion is based on the path's canonical prerequisite ordering and the
 * target's recomputed readiness, never on a manual completion flag.
 */
export function reassessLearningPath(
  state: StudyState,
  path: LearningPath,
  newEvidence: LearningEvidence[] = [],
  today = todayStr()
): LearningPathReassessment | null {
  const reassessment = reassessTopicMastery(
    state,
    path.topicId,
    newEvidence,
    today
  );
  if (!reassessment) return null;

  const nextState: StudyState = newEvidence.length
    ? {
        ...state,
        learningEvidence: [
          ...state.learningEvidence,
          ...newEvidence.filter(
            entry =>
              entry.topicId === path.topicId ||
              path.steps.some(step => step.topicId === entry.topicId)
          ),
        ],
      }
    : state;
  const refreshed = getLearningPath(nextState, path.topicId, today);
  const refreshedSteps = refreshed?.steps ?? path.steps;
  const completed = refreshedSteps.filter(step => {
    const signal = getTopicMastery(nextState, today).find(
      entry => entry.topicId === step.topicId
    );
    return step.kind === "verification"
      ? Boolean(signal?.latestDirectScore !== undefined)
      : Boolean(signal && signal.readiness >= 70 && signal.confidence >= 50);
  }).length;
  const complete = Boolean(
    refreshed &&
    refreshed.status === "ready" &&
    refreshed.steps.every(step => {
      const signal = getTopicMastery(nextState, today).find(
        entry => entry.topicId === step.topicId
      );
      return step.kind === "verification"
        ? Boolean(signal?.latestDirectScore !== undefined)
        : Boolean(signal && signal.readiness >= 70 && signal.confidence >= 50);
    })
  );

  return {
    topicId: path.topicId,
    targetTopic: path.targetTopic,
    stepsCompleted: completed,
    stepsTotal: refreshedSteps.length,
    complete,
    reassessment,
    summary: complete
      ? `${path.targetTopic} now has reliable evidence-backed readiness.`
      : reassessment.nextAction === "learn"
        ? `${path.targetTopic} still needs foundation work before another verification pass.`
        : `${path.targetTopic} still needs targeted work before the path can close.`,
  };
}

export type RecoveryRecommendation = {
  kind: RecoveryActionKind;
  title: string;
  detail: string;
  reason: string;
  duration: number;
  topicId?: string;
  subject?: string;
  route: "/study" | "/study-materials" | "/quizzes" | "/flashcards" | "/today";
  priorityBoost: number;
};

export type AdaptivePlanDraft = {
  title: string;
  startDate: string;
  endDate: string;
  availableMinutesPerDay: number;
  items: Array<Omit<StudyPlanItem, "id" | "createdAt">>;
  notes: string[];
};

function uniqueTopics(state: StudyState) {
  const known = new Map<string, SubjectTopic>();
  state.topics.forEach(topic => known.set(topic.id, topic));
  state.exams.forEach(exam =>
    exam.topics.forEach(topic => {
      if (!known.has(topic.id)) {
        known.set(topic.id, {
          id: topic.id,
          subject: exam.subject,
          name: topic.name,
          source: "exam",
          createdAt: "",
          updatedAt: "",
        });
      }
    })
  );
  return Array.from(known.values());
}

function examTopicEstimate(
  topicId: string,
  exams: StudyState["exams"]
): number | null {
  let status: ExamTopic["status"] | undefined;
  exams.some(exam => {
    const match = exam.topics.find(topic => topic.id === topicId);
    if (match) status = match.status;
    return Boolean(match);
  });
  if (!status) return null;
  // A checklist is useful planning context, but it is never a performance
  // result. Keep it below the strong/readiness threshold until quiz, practice,
  // or recall evidence exists for the same canonical topic.
  return { not_started: 25, learning: 45, revised: 50, mastered: 55 }[status];
}

export function masteryRecencyWeight(recordedAt: string, today = todayStr()) {
  const timestamp = new Date(recordedAt);
  const date = Number.isNaN(timestamp.getTime())
    ? recordedAt.slice(0, 10)
    : isoDate(timestamp);
  const age = Math.max(0, daysBetween(date, today));
  if (age <= 7) return 1;
  if (age <= 30) return 0.7;
  return 0.45;
}

function evidenceDate(recordedAt: string) {
  const timestamp = new Date(recordedAt);
  return Number.isNaN(timestamp.getTime())
    ? recordedAt.slice(0, 10)
    : isoDate(timestamp);
}

function confidenceForEvidence(
  directCount: number,
  evidenceCount: number,
  newestDirectWeight: number
) {
  if (directCount <= 0) return evidenceCount > 0 ? 35 : 20;
  const countConfidence = Math.min(90, 45 + directCount * 15);
  const freshnessConfidence = Math.round(newestDirectWeight * 10);
  return Math.min(100, countConfidence + freshnessConfidence);
}

function examPressureForTopic(
  topicId: string,
  exams: StudyState["exams"],
  today: string
) {
  const days = exams
    .filter(exam => exam.topics.some(topic => topic.id === topicId))
    .map(exam => daysBetween(today, exam.date))
    .filter(value => value >= 0)
    .sort((a, b) => a - b)[0];
  if (days === undefined) return 0;
  if (days <= 0) return 100;
  if (days <= 3) return 95;
  if (days <= 7) return 80;
  if (days <= 21) return 60;
  return 35;
}

/**
 * Computes a transparent learning estimate. Direct quiz/practice evidence has
 * substantially more influence than time spent; topic checklist state is a
 * clearly marked fallback when no evidence has been captured yet.
 */
export function getTopicMastery(
  state: StudyState,
  today = todayStr()
): TopicMastery[] {
  return uniqueTopics(state).map(topic => {
    const evidence = state.learningEvidence
      .filter(entry => entry.topicId === topic.id)
      .slice()
      .sort((a, b) =>
        evidenceDate(a.recordedAt).localeCompare(evidenceDate(b.recordedAt))
      );
    const direct = evidence.filter(
      entry =>
        (entry.kind === "quiz" || entry.kind === "practice") &&
        typeof entry.score === "number"
    );
    // Assessment trust is deliberately separate from recency: repeated low-novelty
    // attempts must not manufacture mastery simply by increasing attempt count.
    const directTrust = direct.map(entry => ({
      entry,
      trust: getEvidenceTrust(entry, evidence, today),
    }));
    const weightedDirect = directTrust.reduce(
      (sum, item) =>
        sum +
        item.entry.score! *
          masteryRecencyWeight(item.entry.recordedAt, today) *
          item.trust.weight,
      0
    );
    const directWeight = directTrust.reduce(
      (sum, item) =>
        sum +
        masteryRecencyWeight(item.entry.recordedAt, today) * item.trust.weight,
      0
    );
    const flashcards = evidence.filter(
      entry => entry.kind === "flashcard" && typeof entry.score === "number"
    );
    const flashcardWeight = flashcards.reduce(
      (sum, entry) =>
        sum +
        masteryRecencyWeight(entry.recordedAt, today) *
          0.45 *
          getEvidenceTrust(entry, evidence, today).weight,
      0
    );
    const flashcardScore = flashcards.reduce(
      (sum, entry) =>
        sum +
        entry.score! *
          masteryRecencyWeight(entry.recordedAt, today) *
          0.45 *
          getEvidenceTrust(entry, evidence, today).weight,
      0
    );
    const studyMinutes = evidence
      .filter(entry => entry.kind === "study_session")
      .reduce((sum, entry) => sum + Math.min(60, entry.minutes ?? 0), 0);
    const totalWeight = directWeight + flashcardWeight;
    const checklistEstimate = examTopicEstimate(topic.id, state.exams);
    const evidenceScore =
      totalWeight > 0 ? (weightedDirect + flashcardScore) / totalWeight : null;
    const score =
      evidenceScore === null
        ? (checklistEstimate ??
          Math.min(55, 20 + Math.round(studyMinutes / 12)))
        : Math.round(
            Math.min(
              100,
              evidenceScore + Math.min(8, Math.round(studyMinutes / 30))
            )
          );

    const newest = evidence[evidence.length - 1];
    const newestDirect = directTrust
      .filter(item => item.trust.label !== "rejected")
      .at(-1)?.entry;
    const newestWeight = newest
      ? masteryRecencyWeight(newest.recordedAt, today)
      : 0;
    const trustedDirectCount = directTrust.filter(
      item => item.trust.label !== "rejected" && item.trust.weight >= 0.5
    ).length;
    const confidence = confidenceForEvidence(
      trustedDirectCount,
      evidence.length,
      newestDirect
        ? masteryRecencyWeight(newestDirect.recordedAt, today) *
            getEvidenceTrust(newestDirect, evidence, today).weight
        : newestWeight
    );
    const freshness = Math.round(newestWeight * 100);
    const decayMultiplier = newestWeight;
    const execution = getExecutionFeedback(state, topic.id, today);
    const executionAdjustment =
      execution.completedSessions >= 2
        ? Math.round((execution.completionRate - execution.struggleRate) * 0.04)
        : 0;
    const readiness = Math.round(
      Math.max(
        0,
        Math.min(100, score * (0.75 + confidence / 400) + executionAdjustment)
      )
    );
    const examPressure = examPressureForTopic(topic.id, state.exams, today);

    return {
      topicId: topic.id,
      subject: topic.subject,
      topic: topic.name,
      score,
      confidence,
      freshness,
      decayMultiplier,
      latestDirectScore: newestDirect?.score,
      latestEvidenceAt: newest?.recordedAt,
      readiness,
      examPressure,
      evidenceCount: evidence.length,
      directEvidenceCount: trustedDirectCount,
      estimated: trustedDirectCount === 0,
    };
  });
}

/**
 * Produces a transparent exam briefing from canonical topic coverage and the
 * same evidence-weighted mastery used everywhere else. It intentionally does
 * not turn a manual topic-status tap into a measured-performance claim.
 */
export function getExamStrategy(
  state: StudyState,
  examId: string,
  today = todayStr()
): ExamStrategyTopic[] {
  const exam = state.exams.find(candidate => candidate.id === examId);
  if (!exam) return [];
  const mastery = getTopicMastery(state, today);
  const days = Math.max(0, daysBetween(today, exam.date));
  return exam.topics
    .map(topic => {
      const signal = mastery.find(entry => entry.topicId === topic.id);
      const fallback = {
        not_started: 25,
        learning: 45,
        revised: 68,
        mastered: 85,
      }[topic.status];
      const masteryScore = signal?.score ?? fallback;
      const readiness = signal?.readiness ?? Math.round(masteryScore * 0.65);
      const confidence = signal?.confidence ?? 20;
      const examPressure =
        signal?.examPressure ??
        (days <= 0
          ? 100
          : days <= 3
            ? 95
            : days <= 7
              ? 80
              : days <= 21
                ? 60
                : 35);
      const weakness = Math.max(0, 100 - readiness);
      const uncertainty = Math.max(0, 100 - confidence);
      const priority = Math.round(
        examPressure * 0.42 +
          weakness * 0.38 +
          uncertainty * 0.12 +
          (topic.status === "not_started" ? 8 : 0)
      );
      const action: ExamStrategyTopic["action"] =
        masteryScore < 45
          ? "learn"
          : masteryScore < 70
            ? "practice"
            : readiness < 80
              ? "review"
              : "maintain";
      const duration =
        action === "learn"
          ? 45
          : action === "practice"
            ? 35
            : action === "review"
              ? 25
              : 15;
      const reason =
        action === "learn"
          ? "Build the foundation before relying on recall."
          : action === "practice"
            ? "Use direct practice to turn partial knowledge into measurable evidence."
            : action === "review"
              ? "A short targeted review can stabilise an otherwise usable signal."
              : "Evidence is already strong; keep recall active without over-investing time.";
      return {
        topicId: topic.id,
        topic: topic.name,
        mastery: masteryScore,
        readiness,
        confidence,
        examPressure,
        priority,
        duration,
        action,
        reason,
      };
    })
    .sort((a, b) => b.priority - a.priority || a.topic.localeCompare(b.topic));
}

export function getExamReadiness(
  state: StudyState,
  examId: string,
  today = todayStr()
): ExamReadiness | null {
  const exam = state.exams.find(candidate => candidate.id === examId);
  if (!exam) return null;
  if (exam.topics.length === 0)
    return {
      readiness: 0,
      coverage: 0,
      evidenceBackedTopics: 0,
      strongTopics: [],
      needsAttentionTopics: [],
      recommendedSessions: 0,
      highPriorityTopics: 0,
      confidence: 0,
    };
  const strategy = getExamStrategy(state, examId, today);
  const mastery = getTopicMastery(state, today);
  const coverage = Math.round(
    (exam.topics.filter(topic => topic.status !== "not_started").length /
      exam.topics.length) *
      100
  );
  const readiness = Math.round(
    strategy.reduce((sum, entry) => sum + entry.readiness, 0) / strategy.length
  );
  const evidenceBackedTopics = strategy.filter(entry =>
    mastery.some(
      signal => signal.topicId === entry.topicId && !signal.estimated
    )
  ).length;
  const needsAttention = strategy.filter(entry => entry.readiness < 60);
  const highPriorityTopics = strategy.filter(
    entry => entry.priority >= 65
  ).length;
  const confidence = Math.round(
    strategy.reduce((sum, entry) => sum + entry.confidence, 0) / strategy.length
  );
  const pressure = Math.max(
    0.5,
    Math.min(
      1,
      daysBetween(today, exam.date) <= 7
        ? 1
        : daysBetween(today, exam.date) <= 21
          ? 0.75
          : 0.5
    )
  );
  const recommendedSessions =
    strategy.length === 0
      ? 0
      : Math.max(
          1,
          Math.min(
            5,
            Math.ceil(
              Math.max(needsAttention.length, highPriorityTopics) * pressure
            )
          )
        );
  const next = strategy[0];
  return {
    readiness,
    coverage,
    evidenceBackedTopics,
    strongTopics: strategy
      .filter(entry => entry.readiness >= 75)
      .slice(0, 2)
      .map(entry => entry.topic),
    needsAttentionTopics: needsAttention.slice(0, 3).map(entry => entry.topic),
    recommendedSessions,
    highPriorityTopics,
    confidence,
    nextMove: next
      ? {
          topicId: next.topicId,
          topic: next.topic,
          reason: next.reason,
          duration: next.duration,
        }
      : undefined,
  };
}

/** Groups cards already due under the existing spaced-repetition schedule. */
export function getDueReviewQueue(
  state: StudyState,
  today = todayStr()
): DueReviewQueue {
  const grouped = new Map<string, { count: number; deckIds: string[] }>();
  state.decks.forEach(deck => {
    const due = deck.cards.filter(card => {
      const dueDate = card.nextReviewDate ?? card.dueDate;
      return !dueDate || dueDate <= today;
    }).length;
    if (!due) return;
    const subject = deck.subject.trim() || "General";
    const existing = grouped.get(subject) ?? { count: 0, deckIds: [] };
    existing.count += due;
    existing.deckIds.push(deck.id);
    grouped.set(subject, existing);
  });
  const subjects = Array.from(grouped.entries())
    .map(([subject, value]) => ({ subject, ...value }))
    .sort((a, b) => b.count - a.count || a.subject.localeCompare(b.subject));
  return {
    total: subjects.reduce((sum, entry) => sum + entry.count, 0),
    subjects,
  };
}

function clockMinutes(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours <= 23 && minutes <= 59 ? hours * 60 + minutes : null;
}

function clockString(totalMinutes: number) {
  return `${String(Math.floor(totalMinutes / 60)).padStart(2, "0")}:${String(totalMinutes % 60).padStart(2, "0")}`;
}

function timetableEventsForDate(state: StudyState, date: string) {
  const weekday = (new Date(`${date}T12:00:00`).getDay() + 6) % 7;
  return state.events.filter(event => event.day === weekday);
}

function timetableMinutesForDate(state: StudyState, date: string) {
  return timetableEventsForDate(state, date).reduce((sum, event) => {
    const start = clockMinutes(event.startTime);
    const end = clockMinutes(event.endTime);
    return (
      sum + (start === null || end === null || end <= start ? 0 : end - start)
    );
  }, 0);
}

/** Finds an evening plan slot that does not overlap timetable, active-session, or plan blocks. */
function findPlanStartTime(
  date: string,
  duration: number,
  state: StudyState,
  planItems: Array<
    Pick<StudyPlanItem, "date" | "startTime" | "duration" | "status">
  >
) {
  const occupied = [
    ...state.sessions
      .filter(
        session =>
          session.date === date &&
          ["planned", "in_progress", "paused"].includes(session.status)
      )
      .map(session => ({
        start: clockMinutes(session.startTime),
        duration: session.duration,
      })),
    ...timetableEventsForDate(state, date).map(event => {
      const start = clockMinutes(event.startTime);
      const end = clockMinutes(event.endTime);
      return {
        start,
        duration: start === null || end === null ? 0 : Math.max(0, end - start),
      };
    }),
    ...planItems
      .filter(item => item.date === date && item.status === "planned")
      .map(item => ({
        start: clockMinutes(item.startTime),
        duration: item.duration,
      })),
  ].filter(
    (entry): entry is { start: number; duration: number } =>
      entry.start !== null
  );

  for (let start = 18 * 60; start + duration <= 24 * 60; start += 5) {
    const end = start + duration;
    if (
      occupied.every(
        entry => end <= entry.start || start >= entry.start + entry.duration
      )
    )
      return clockString(start);
  }
  return null;
}

export type ScheduleGap = {
  startTime: string;
  endTime: string;
  duration: number;
};

/**
 * A concrete execution block produced from the same deterministic action
 * ranking. It tells the UI exactly what can be executed, when it fits, and
 * whether the action is a new time-boxed step or an existing session.
 */
export type NextExecution = {
  action: NextAction;
  date: string;
  startTime: string;
  endTime: string;
  duration: number;
  source: "existing_session" | "free_window";
  mode: "resume" | "start";
};

function occupiedIntervals(
  state: StudyState,
  date: string,
  start: number,
  end: number
) {
  const weekdayEvents = timetableEventsForDate(state, date).map(event => ({
    start: clockMinutes(event.startTime),
    end: clockMinutes(event.endTime),
  }));
  const sessions = state.sessions
    .filter(
      session =>
        session.date === date &&
        ["planned", "in_progress", "paused"].includes(session.status)
    )
    .map(session => {
      const sessionStart = clockMinutes(session.startTime);
      return {
        start: sessionStart,
        end:
          sessionStart === null
            ? null
            : sessionStart + Math.max(0, session.duration),
      };
    });
  return [...weekdayEvents, ...sessions]
    .filter(
      (item): item is { start: number; end: number } =>
        item.start !== null && item.end !== null && item.end > item.start
    )
    .map(item => ({
      start: Math.max(start, item.start),
      end: Math.min(end, item.end),
    }))
    .filter(item => item.end > item.start)
    .sort((a, b) => a.start - b.start || a.end - b.end)
    .reduce<Array<{ start: number; end: number }>>((merged, item) => {
      const previous = merged[merged.length - 1];
      if (!previous || item.start > previous.end) merged.push({ ...item });
      else previous.end = Math.max(previous.end, item.end);
      return merged;
    }, []);
}

/** Finds genuinely free windows after timetable and active/planned study blocks. */
export function getTodayScheduleGaps(
  state: StudyState,
  date: string,
  windowStart = "08:00",
  windowEnd = "22:00",
  currentTime?: string
): ScheduleGap[] {
  const parsedStart = clockMinutes(windowStart);
  const parsedEnd = clockMinutes(windowEnd);
  if (parsedStart === null || parsedEnd === null || parsedEnd <= parsedStart)
    return [];
  const clockNow = currentTime ? clockMinutes(currentTime) : null;
  const start = Math.max(parsedStart, clockNow ?? parsedStart);
  if (start >= parsedEnd) return [];
  const gaps: ScheduleGap[] = [];
  let cursor = start;
  for (const interval of occupiedIntervals(state, date, start, parsedEnd)) {
    if (interval.start > cursor)
      gaps.push({
        startTime: clockString(cursor),
        endTime: clockString(interval.start),
        duration: interval.start - cursor,
      });
    cursor = Math.max(cursor, interval.end);
  }
  if (cursor < parsedEnd)
    gaps.push({
      startTime: clockString(cursor),
      endTime: clockString(parsedEnd),
      duration: parsedEnd - cursor,
    });
  return gaps.filter(gap => gap.duration >= 10);
}

/** Fits the central next-action ranking into the first usable free window. */
export function getNextBestActionForScheduleGap(
  state: StudyState,
  date: string,
  currentTime?: string
) {
  const gaps = getTodayScheduleGaps(state, date, "08:00", "22:00", currentTime);
  for (const gap of gaps) {
    const action = getNextBestActionForTime(state, gap.duration, date);
    if (action) return { gap, action };
  }
  return null;
}

/**
 * Converts the next-best decision into an executable block. Existing active
 * sessions stay authoritative; otherwise the best-ranked action is fitted into
 * the first real schedule gap. No new task/session is written here, so this is
 * a planning decision rather than a side-effect.
 */
export function getNextBestExecution(
  state: StudyState,
  date = todayStr(),
  currentTime?: string,
  windowStart = "08:00",
  windowEnd = "22:00"
): NextExecution | null {
  const actions = getRankedNextActions(state, date);
  const active = actions.find(action => {
    if (action.kind !== "session") return false;
    const session = state.sessions.find(
      candidate => `session:${candidate.id}` === action.id
    );
    return session?.status === "in_progress" || session?.status === "paused";
  });
  if (active) {
    const session = state.sessions.find(
      candidate => `session:${candidate.id}` === active.id
    );
    if (session) {
      const end = clockMinutes(session.startTime);
      const endTime =
        end === null
          ? session.startTime
          : clockString(end + Math.max(1, session.duration));
      return {
        action: active,
        date: session.date,
        startTime: session.startTime,
        endTime,
        duration: session.duration,
        source: "existing_session",
        mode: "resume",
      };
    }
  }

  const gaps = getTodayScheduleGaps(
    state,
    date,
    windowStart,
    windowEnd,
    currentTime
  );
  for (const gap of gaps) {
    const action = getNextBestActionForTime(state, gap.duration, date);
    if (!action) continue;
    const duration = Math.max(1, Math.min(action.duration, gap.duration));
    const start = clockMinutes(gap.startTime);
    if (start === null) continue;
    return {
      action,
      date,
      startTime: gap.startTime,
      endTime: clockString(start + duration),
      duration,
      source: "free_window",
      mode: "start",
    };
  }
  return null;
}

/** Reserves a conservative amount of capacity for unfinished work that is due on a date. */
function dueTaskMinutesForDate(state: StudyState, date: string) {
  return state.tasks
    .filter(
      task =>
        task.status !== "completed" &&
        task.dueDate === date &&
        getTaskRecoveryKind(task, state.tasks, date) !== "deferred"
    )
    .reduce(
      (sum, task) => sum + Math.min(120, getRemainingTaskMinutes(task)),
      0
    );
}

/** Returns a local, explainable priority list that works with no network connection. */
export function getRankedNextActions(
  state: StudyState,
  today = todayStr(),
  availableMinutes?: number
): NextAction[] {
  const actions: NextAction[] = [];
  state.tasks
    .filter(task => task.status !== "completed")
    .forEach(task => {
      const recovery = getTaskRecoveryKind(task, state.tasks, today);
      if (recovery === "blocked" || recovery === "deferred") return;
      const isPartial = recovery === "partial";
      const daysUntilDue = task.dueDate
        ? daysBetween(today, task.dueDate)
        : null;
      const isUpcoming =
        !isPartial &&
        daysUntilDue !== null &&
        daysUntilDue >= 0 &&
        daysUntilDue <= 7;
      const isOverdue = Boolean(task.dueDate && task.dueDate < today);
      if (!isPartial && !isUpcoming && !isOverdue) return;
      const overdueDays =
        task.dueDate && task.dueDate < today
          ? Math.max(1, daysBetween(task.dueDate, today))
          : 0;
      const priorityBoost =
        task.priority === "high" ? 300 : task.priority === "medium" ? 180 : 80;
      const remainingMinutes = Math.max(
        10,
        Math.min(120, getRemainingTaskMinutes(task))
      );
      actions.push({
        id: `task:${task.id}`,
        kind: "task",
        title: task.title,
        detail: overdueDays
          ? `${overdueDays} day${overdueDays === 1 ? "" : "s"} overdue`
          : isPartial
            ? `${task.progressPercent ?? 0}% recorded progress`
            : daysUntilDue === 1
              ? "Due tomorrow"
              : daysUntilDue && daysUntilDue > 1
                ? `Due in ${daysUntilDue} days`
                : "Due today",
        subject: task.subject || undefined,
        duration: remainingMinutes,
        score:
          (overdueDays
            ? 10_000
            : isPartial
              ? 5_800
              : 7_000 - (daysUntilDue ?? 0) * 350) +
          priorityBoost +
          overdueDays * 100,
        reason: overdueDays
          ? "Overdue work needs a deliberate recovery step."
          : isPartial
            ? "Continue a task you already started before opening a new loop."
            : daysUntilDue === 1
              ? "This assignment is due tomorrow."
              : "This deadline is approaching.",
        route: "/tasks",
      });
    });

  state.sessions
    .filter(
      session =>
        !["completed", "skipped", "rescheduled"].includes(session.status) &&
        session.date <= today
    )
    .forEach(session => {
      const overdueDays =
        session.date < today
          ? Math.max(1, daysBetween(session.date, today))
          : 0;
      const statusBoost =
        session.status === "in_progress"
          ? 9_800
          : session.status === "paused"
            ? 9_500
            : 6_000;
      const priorityBoost =
        session.priority === "high"
          ? 300
          : session.priority === "medium"
            ? 180
            : 80;
      const plannedReason = session.notes.trim();
      actions.push({
        id: `session:${session.id}`,
        kind: "session",
        title: `${session.subject} — ${session.topic}`,
        detail:
          session.status === "in_progress"
            ? "In progress"
            : session.status === "paused"
              ? "Paused"
              : overdueDays
                ? `${overdueDays} day${overdueDays === 1 ? "" : "s"} overdue`
                : `${session.startTime} today`,
        subject: session.subject,
        topic: session.topic,
        duration: session.duration,
        score: statusBoost + priorityBoost + overdueDays * 150,
        reason:
          plannedReason ||
          (session.status === "in_progress" || session.status === "paused"
            ? "Finish the study block you already started."
            : "This study block is already on your plan for today."),
        route: "/today",
      });
    });

  const mastery = getTopicMastery(state);
  state.exams
    .map(exam => ({ exam, days: daysBetween(today, exam.date) }))
    .filter(({ days }) => days >= 0 && days <= 60)
    .forEach(({ exam, days }) =>
      exam.topics.forEach(topic => {
        const topicMastery = mastery.find(entry => entry.topicId === topic.id);
        const currentScore =
          topicMastery?.score ?? examTopicEstimate(topic.id, state.exams) ?? 25;
        const urgency = Math.max(1, 61 - days);
        const weakness = 100 - currentScore;
        actions.push({
          id: `exam-topic:${exam.id}:${topic.id}`,
          kind: "study",
          title: `${exam.subject} — ${topic.name}`,
          detail: `${exam.name} in ${days === 0 ? "today" : `${days} day${days === 1 ? "" : "s"}`}`,
          subject: exam.subject,
          topic: topic.name,
          topicId: topic.id,
          duration: currentScore < 50 ? 40 : 25,
          score: urgency * 20 + weakness * 4,
          reason:
            currentScore < 50
              ? "This is one of your weakest exam topics."
              : "A nearby exam makes review worthwhile.",
          route: "/study",
        });
      })
    );

  const dueCards = getDueReviewQueue(state, today).total;
  if (dueCards > 0) {
    actions.push({
      id: "flashcards:due",
      kind: "flashcards",
      title: `Review ${dueCards} due flashcard${dueCards === 1 ? "" : "s"}`,
      detail: "Short recall practice",
      duration: Math.min(30, Math.max(10, dueCards * 2)),
      score: 250 + dueCards * 4,
      reason: "Regular recall supports longer-term retention.",
      route: "/flashcards",
    });
  }

  const decisions = getActionDecisionIndex(
    state,
    actions,
    mastery,
    today,
    availableMinutes
  );
  return prioritizeNextActions(decisions, 5).map(decision => decision.action);
}

/**
 * Chooses the best achievable action for a student's current time window.
 * Long actions are represented as a time-boxed slice rather than pretending
 * the student has more time than they actually do.
 */
export function getExecutionFeedback(
  state: StudyState,
  topicId?: string,
  subject?: string,
  limit = 8
): ExecutionFeedback {
  const sessions = state.sessions
    .filter(session =>
      topicId
        ? session.topicId === topicId
        : subject
          ? session.subject === subject
          : true
    )
    .filter(session =>
      ["completed", "skipped", "rescheduled"].includes(session.status)
    )
    .slice()
    .sort((a, b) =>
      String(
        b.finishedAt ?? b.resumedAt ?? b.startedAt ?? b.date
      ).localeCompare(
        String(a.finishedAt ?? a.resumedAt ?? a.startedAt ?? a.date)
      )
    )
    .slice(0, Math.max(1, Math.min(20, limit)));
  const completed = sessions.filter(s => s.status === "completed");
  const skipped = sessions.filter(s => s.status === "skipped");
  const rescheduled = sessions.filter(s => s.status === "rescheduled");
  const struggled = completed.filter(
    s => s.reflection === "difficult" || s.reflection === "still_confused"
  );
  const noTimeSkips = skipped.filter(s => s.skipReason === "no_time");
  const plannedMinutes = sessions.length
    ? Math.round(
        sessions.reduce((sum, s) => sum + Math.max(0, s.duration), 0) /
          sessions.length
      )
    : 0;
  const actualMinutes = completed.length
    ? Math.round(
        completed.reduce(
          (sum, s) => sum + Math.max(0, s.actualDuration ?? s.duration),
          0
        ) / completed.length
      )
    : 0;
  const completionRate = sessions.length
    ? Math.round((completed.length / sessions.length) * 100)
    : 0;
  const struggleRate = completed.length
    ? Math.round((struggled.length / completed.length) * 100)
    : 0;
  const noTimeSkipRate = skipped.length
    ? Math.round((noTimeSkips.length / skipped.length) * 100)
    : 0;
  const preferredDuration = completed.length
    ? Math.max(15, Math.min(90, Math.round(actualMinutes)))
    : undefined;
  const completionSignal = completionRate;
  const struggleSignal = Math.max(0, 100 - struggleRate);
  const timeSignal = noTimeSkips.length
    ? Math.max(0, 100 - noTimeSkipRate)
    : 100;
  const executionFit = Math.round(
    completionSignal * 0.55 + struggleSignal * 0.25 + timeSignal * 0.2
  );
  let signal: ExecutionFeedback["signal"] = "stable";
  let suggestedDurationDelta = 0;
  let reason = "No strong execution pattern has been observed yet.";
  if (
    sessions.length &&
    skipped.length + rescheduled.length >= Math.ceil(sessions.length / 2)
  ) {
    signal = "recover";
    suggestedDurationDelta = -10;
    reason =
      "Recent planned work was frequently skipped or moved, so the next block should be easier to start.";
  } else if (struggleRate >= 50) {
    signal = "shorten";
    suggestedDurationDelta = -10;
    reason =
      "Recent completed sessions show repeated difficulty, so Student OS is reducing the next block and keeping it focused.";
  } else if (
    completed.length >= 2 &&
    actualMinutes >= plannedMinutes + 10 &&
    completionRate >= 75
  ) {
    signal = "extend";
    suggestedDurationDelta = 10;
    reason =
      "Recent sessions are consistently completed at or beyond the planned duration, so a modestly longer block may fit.";
  }
  return {
    topicId,
    sessionsConsidered: sessions.length,
    completedSessions: completed.length,
    skippedSessions: skipped.length,
    rescheduledSessions: rescheduled.length,
    difficultOrConfused: struggled.length,
    completionRate,
    struggleRate,
    averagePlannedMinutes: plannedMinutes,
    averageActualMinutes: actualMinutes,
    suggestedDurationDelta,
    noTimeSkipRate,
    preferredDuration,
    executionFit,
    signal,
    reason,
  };
}

/**
 * Converts recent execution friction into one bounded recovery move. The
 * recommendation never edits learner data; it only changes the next action.
 */
export function getRecoveryRecommendation(
  state: StudyState,
  topicId?: string,
  subject?: string,
  _today = todayStr()
): RecoveryRecommendation | null {
  const feedback = getExecutionFeedback(state, topicId, subject);
  if (feedback.sessionsConsidered === 0) return null;

  const recent = state.sessions
    .filter(session =>
      topicId
        ? session.topicId === topicId
        : subject
          ? session.subject === subject
          : true
    )
    .slice()
    .sort((a, b) =>
      String(
        b.finishedAt ?? b.resumedAt ?? b.startedAt ?? b.date
      ).localeCompare(
        String(a.finishedAt ?? a.resumedAt ?? a.startedAt ?? a.date)
      )
    )
    .slice(0, 5);

  const latestSkipped = recent.find(session => session.status === "skipped");
  const missingMaterials = recent.filter(
    session =>
      session.status === "skipped" && session.skipReason === "missing_materials"
  ).length;
  const notReady = recent.filter(
    session =>
      session.status === "skipped" && session.skipReason === "not_ready"
  ).length;
  const confused = recent.filter(
    session =>
      session.status === "completed" && session.reflection === "still_confused"
  ).length;
  const difficult = recent.filter(
    session =>
      session.status === "completed" && session.reflection === "difficult"
  ).length;
  const recentMoves = recent.filter(
    session => session.status === "rescheduled"
  ).length;

  if (missingMaterials >= 1) {
    return {
      kind: "retrieve_material",
      title: "Recover the missing material first",
      detail:
        "Gather the note, lesson, example, or reference needed for this topic.",
      reason:
        "A recent session was skipped because the required material was missing. Removing that blocker is more useful than scheduling another full study block.",
      duration: Math.max(10, Math.min(20, feedback.preferredDuration ?? 15)),
      topicId,
      subject,
      route: "/study-materials",
      priorityBoost: 1_100,
    };
  }

  if (notReady >= 1) {
    return {
      kind: "prerequisite_review",
      title: "Review the prerequisite first",
      detail:
        "Take a short foundation pass before returning to the main topic.",
      reason:
        "The learner marked a recent attempt as not ready, so Student OS is inserting a smaller foundation step instead of repeating the same block.",
      duration: Math.max(10, Math.min(25, feedback.preferredDuration ?? 20)),
      topicId,
      subject,
      route: "/study",
      priorityBoost: 1_050,
    };
  }

  if (feedback.noTimeSkipRate >= 60 || recentMoves >= 2) {
    return {
      kind: "reschedule",
      title: "Use a smaller recovery window",
      detail: "Re-enter the topic in a short block that is easier to protect.",
      reason:
        "Recent work is being lost to time pressure or repeated moves. Student OS is reducing the commitment rather than stacking another missed block.",
      duration: Math.max(
        10,
        Math.min(20, Math.round((feedback.preferredDuration ?? 20) * 0.75))
      ),
      topicId,
      subject,
      route: "/today",
      priorityBoost: 1_000,
    };
  }

  if (confused >= 1 || difficult >= 2 || feedback.struggleRate >= 50) {
    return {
      kind: "change_method",
      title: "Change the learning method",
      detail:
        "Switch from passive review to short recall or targeted practice.",
      reason:
        "Recent reflection shows the topic is not sticking with the current approach. A different method gives the next attempt a better chance without simply adding more minutes.",
      duration: Math.max(
        10,
        Math.min(25, Math.round((feedback.preferredDuration ?? 20) * 0.8))
      ),
      topicId,
      subject,
      route: "/quizzes",
      priorityBoost: 980,
    };
  }

  if (feedback.signal === "shorten") {
    return {
      kind: "shorten_session",
      title: "Shrink the next study block",
      detail:
        "Use a focused block before returning to the full session length.",
      reason: feedback.reason,
      duration: Math.max(10, Math.min(30, feedback.preferredDuration ?? 25)),
      topicId,
      subject,
      route: "/study",
      priorityBoost: 900,
    };
  }

  return latestSkipped || feedback.signal === "recover"
    ? {
        kind: "reschedule",
        title: "Create a fresh starting point",
        detail: "Return to this topic with a small, explicit next step.",
        reason:
          "Recent execution has been unstable, so Student OS is choosing a lower-friction restart instead of assuming the original plan still fits.",
        duration: Math.max(10, Math.min(20, feedback.preferredDuration ?? 15)),
        topicId,
        subject,
        route: "/today",
        priorityBoost: 850,
      }
    : null;
}

export function getNextBestActionForTime(
  state: StudyState,
  availableMinutes: number,
  today = todayStr()
): NextAction | null {
  const window = Math.max(0, Math.floor(availableMinutes));
  if (window <= 0) return null;
  const ranked = getRankedNextActions(state, today, window);
  if (ranked.length === 0) return null;
  // Prefer completing a fitting action before slicing a larger commitment.
  const best = ranked.find(action => action.duration <= window) ?? ranked[0];
  const recovery = getRecoveryRecommendation(
    state,
    best.topicId,
    best.subject,
    today
  );
  const feedback = best.topicId
    ? getExecutionFeedback(state, best.topicId)
    : undefined;
  let adjustedDuration = Math.min(window, best.duration);
  if (feedback) {
    if (
      feedback.preferredDuration !== undefined &&
      feedback.completedSessions >= 2
    ) {
      adjustedDuration = Math.min(adjustedDuration, feedback.preferredDuration);
    }
    if (feedback.signal !== "stable") {
      adjustedDuration = Math.min(
        window,
        Math.max(10, adjustedDuration + feedback.suggestedDurationDelta)
      );
    }
  }
  if (recovery) {
    adjustedDuration = Math.min(window, Math.max(10, recovery.duration));
    const slice = Math.min(window, Math.max(10, adjustedDuration));
    return {
      ...best,
      title: recovery.title,
      duration: slice,
      detail: `${slice}-minute recovery · ${recovery.detail}`,
      reason:
        `${best.reason} ${recovery.reason}` +
        (window !== best.duration
          ? ` You have about ${window} minutes now, so Student OS has fitted the recovery to ${slice} minutes.`
          : ""),
      route:
        recovery.route === "/study-materials"
          ? "/study"
          : recovery.route === "/quizzes"
            ? "/study"
            : recovery.route === "/flashcards"
              ? "/flashcards"
              : "/today",
    };
  }
  if (adjustedDuration === best.duration && best.duration <= window)
    return best;
  const slice = Math.min(window, Math.max(10, adjustedDuration));
  const feedbackReason =
    feedback && feedback.signal !== "stable" ? ` ${feedback.reason}` : "";
  return {
    ...best,
    duration: slice,
    detail: `${slice}-minute focused sprint · ${best.detail}`,
    reason: `${best.reason}${feedbackReason} You have about ${window} minutes now, so Student OS has fitted this to a realistic ${slice}-minute step.`,
  };
}

/**
 * Selects an active session first, otherwise the highest-ranked scheduled
 * session. The action is produced by the same central ranking path used by
 * Dashboard and Reviews, so the coach never invents a competing priority.
 */
export function getExecutionCoach(
  state: StudyState,
  today = todayStr()
): ExecutionCoach | null {
  const actions = getRankedNextActions(state, today).filter(
    action => action.kind === "session"
  );
  const active = actions.find(action => {
    const session = state.sessions.find(
      candidate => `session:${candidate.id}` === action.id
    );
    return session?.status === "in_progress" || session?.status === "paused";
  });
  const action = active ?? actions[0];
  if (!action) return null;
  const session = state.sessions.find(
    candidate => `session:${candidate.id}` === action.id
  );
  return session ? { session, action } : null;
}

/**
 * Produces a finite exam revision plan. It only uses capacity remaining after
 * already-planned sessions and stops once the available time before the exam is
 * filled, so a missed session never creates an unbounded backlog.
 */
export function createAdaptiveExamPlan(
  state: StudyState,
  examId: string,
  availableMinutesPerDay: number,
  startDate = todayStr()
): AdaptivePlanDraft | null {
  const exam = state.exams.find(candidate => candidate.id === examId);
  if (!exam || exam.date < startDate) return null;
  const endDate = exam.date === startDate ? startDate : addDays(exam.date, -1);
  const mastery = getTopicMastery(state);
  const topics = exam.topics
    .map(topic => ({
      topic,
      score:
        mastery.find(entry => entry.topicId === topic.id)?.score ??
        examTopicEstimate(topic.id, state.exams) ??
        25,
    }))
    .sort((a, b) => a.score - b.score);
  if (topics.length === 0) {
    return {
      title: `${exam.subject} — ${exam.name}`,
      startDate,
      endDate,
      availableMinutesPerDay,
      items: [],
      notes: [
        "All exam topics are marked mastered. Use short mixed-practice sessions to maintain recall.",
      ],
    };
  }

  const items: AdaptivePlanDraft["items"] = [];
  const days = Math.max(1, daysBetween(startDate, endDate) + 1);
  let cursor = 0;
  for (let offset = 0; offset < days; offset += 1) {
    const date = addDays(startDate, offset);
    const occupied = state.sessions
      .filter(
        session =>
          session.date === date &&
          ["planned", "in_progress", "paused"].includes(session.status)
      )
      .reduce((sum, session) => sum + session.duration, 0);
    let remaining = Math.max(
      0,
      availableMinutesPerDay -
        occupied -
        timetableMinutesForDate(state, date) -
        dueTaskMinutesForDate(state, date)
    );
    while (remaining >= 20) {
      const current = topics[cursor % topics.length];
      const duration = Math.min(remaining, current.score < 50 ? 45 : 30);
      if (duration < 20) break;
      const startTime = findPlanStartTime(date, duration, state, items);
      if (!startTime) break;
      items.push({
        subject: exam.subject,
        topic: current.topic.name,
        topicId: current.topic.id,
        date,
        startTime,
        duration,
        priority: current.score < 50 ? "high" : "medium",
        reason:
          current.score < 50
            ? "Weak exam topic — prioritised for review."
            : "Exam-linked revision keeps this topic active.",
        status: "planned",
        linkedExamId: exam.id,
      });
      remaining -= duration;
      cursor += 1;
    }
  }
  const limitedDays = items.length === 0;
  return {
    title: `${exam.subject} — ${exam.name}`,
    startDate,
    endDate,
    availableMinutesPerDay,
    items,
    notes: limitedDays
      ? [
          "There is no free study capacity before this exam. Reduce other planned sessions or add time before generating a revision plan.",
        ]
      : [
          "Topics are prioritised by nearby exam date and current learning evidence. You can edit any item before studying.",
        ],
  };
}

/**
 * Moves only unfinished, past-due plan items into genuinely free future
 * capacity. Completed items are left untouched, and items that cannot fit are
 * reported instead of silently producing an unrealistic schedule.
 */
export function rebalanceMissedPlanItems(
  plan: StudyPlan,
  state: StudyState,
  today = todayStr()
) {
  const missed = plan.items.filter(
    item => item.status === "planned" && item.date < today
  );
  const retained = plan.items.filter(
    item => !(item.status === "planned" && item.date < today)
  );
  const additions: Array<Omit<StudyPlanItem, "id" | "createdAt">> = [];
  const additionLimit = Math.max(
    0,
    WORKSPACE_STUDY_PLAN_ITEM_LIMIT - plan.items.length
  );
  const endOffset = Math.max(0, daysBetween(today, plan.endDate));
  let cursor = 0;
  for (const missedItem of missed) {
    if (additions.length >= additionLimit) break;
    let placed = false;
    for (let offset = 0; offset <= endOffset; offset += 1) {
      const date = addDays(today, (cursor + offset) % (endOffset + 1));
      const scheduledMinutes = state.sessions
        .filter(
          session =>
            session.date === date &&
            ["planned", "in_progress", "paused"].includes(session.status)
        )
        .reduce((sum, session) => sum + session.duration, 0);
      const timetableMinutes = timetableMinutesForDate(state, date);
      const retainedMinutes = retained
        .filter(item => item.date === date && item.status === "planned")
        .reduce((sum, item) => sum + item.duration, 0);
      const addedMinutes = additions
        .filter(item => item.date === date)
        .reduce((sum, item) => sum + item.duration, 0);
      const dueTaskMinutes = dueTaskMinutesForDate(state, date);
      if (
        scheduledMinutes +
          timetableMinutes +
          retainedMinutes +
          addedMinutes +
          dueTaskMinutes +
          missedItem.duration <=
        plan.availableMinutesPerDay
      ) {
        const startTime = findPlanStartTime(date, missedItem.duration, state, [
          ...retained,
          ...additions,
        ]);
        if (!startTime) continue;
        additions.push({
          ...missedItem,
          date,
          startTime,
          reason: `Rescheduled: ${missedItem.reason}`,
          status: "planned",
        });
        cursor = (cursor + offset + 1) % (endOffset + 1);
        placed = true;
        break;
      }
    }
    if (!placed) continue;
  }
  return {
    skippedItemIds: missed.map(item => item.id),
    additions,
    unallocatedCount: missed.length - additions.length,
  };
}
