import type { NextAction, TopicMastery } from "./learningIntelligence";
import type { StudySession, StudyState, Task } from "./types";
import { daysBetween, todayStr } from "./utils";

export type PriorityFactors = {
  urgency: number;
  weakness: number;
  continuity: number;
  userPriority: number;
  recency: number;
  examPressure: number;
  timeFit: number;
};

export type PriorityDecision = {
  action: NextAction;
  factors: PriorityFactors;
  confidence: "high" | "medium" | "low";
};

const clamp = (value: number, min = 0, max = 100) =>
  Math.max(min, Math.min(max, value));
const priorityWeight = (
  priority: Task["priority"] | StudySession["priority"]
) => (priority === "high" ? 100 : priority === "medium" ? 60 : 30);

function daysUntil(date: string, today: string) {
  return date ? daysBetween(today, date) : null;
}

function taskDecision(
  action: NextAction,
  task: Task,
  today: string,
  availableMinutes?: number
): PriorityDecision {
  const days = daysUntil(task.dueDate, today);
  const overdueDays =
    days !== null && days < 0 ? Math.min(14, Math.max(1, Math.abs(days))) : 0;
  const urgency =
    days === null
      ? 10
      : days < 0
        ? 100
        : days === 0
          ? 95
          : days === 1
            ? 85
            : days <= 3
              ? 70
              : 45;
  const continuity =
    task.status === "in_progress" ? 100 : task.lastWorkedAt ? 70 : 20;
  const timeFit =
    availableMinutes === undefined
      ? clamp(100 - Math.max(0, action.duration - 60) * 1.5)
      : clamp(
          action.duration <= availableMinutes
            ? 100
            : 100 - (action.duration - availableMinutes) * 4
        );
  const factors = {
    urgency: clamp(urgency + overdueDays * 2),
    weakness: 0,
    continuity,
    userPriority: priorityWeight(task.priority),
    recency: task.lastWorkedAt ? 75 : 20,
    examPressure: 0,
    timeFit,
  };
  const score =
    factors.urgency * 0.36 +
    factors.userPriority * 0.22 +
    factors.continuity * 0.2 +
    factors.recency * 0.08 +
    factors.timeFit * 0.14;
  return {
    action: { ...action, score: Math.round(score * 100) },
    factors,
    confidence:
      days !== null || task.status === "in_progress" ? "high" : "medium",
  };
}

function sessionDecision(
  action: NextAction,
  session: StudySession,
  today: string,
  availableMinutes?: number
): PriorityDecision {
  const days = daysUntil(session.date, today);
  const active =
    session.status === "in_progress" || session.status === "paused";
  const urgency = active
    ? 100
    : days === 0
      ? 88
      : days !== null && days < 0
        ? 94
        : 45;
  const continuity = active ? 100 : 65;
  const factors = {
    urgency,
    weakness: 0,
    continuity,
    userPriority: priorityWeight(session.priority),
    recency: active ? 100 : 55,
    examPressure: 0,
    timeFit:
      availableMinutes === undefined
        ? clamp(100 - Math.max(0, action.duration - 60) * 1.5)
        : clamp(
            action.duration <= availableMinutes
              ? 100
              : 100 - (action.duration - availableMinutes) * 4
          ),
  };
  const score =
    factors.urgency * 0.38 +
    factors.userPriority * 0.2 +
    factors.continuity * 0.24 +
    factors.recency * 0.08 +
    factors.timeFit * 0.1;
  return {
    action: { ...action, score: Math.round(score * 100) },
    factors,
    confidence: active || session.date === today ? "high" : "medium",
  };
}

function studyDecision(
  action: NextAction,
  mastery: TopicMastery | undefined,
  examDays: number,
  availableMinutes?: number
): PriorityDecision {
  const masteryScore = mastery?.readiness ?? mastery?.score ?? 25;
  const weakness = clamp(100 - masteryScore);
  const examPressure =
    mastery?.examPressure ??
    (examDays <= 0
      ? 100
      : examDays <= 3
        ? 95
        : examDays <= 7
          ? 80
          : examDays <= 21
            ? 60
            : 35);
  const urgency = examPressure;
  const continuity = mastery?.estimated ? 35 : mastery?.evidenceCount ? 65 : 45;
  const confidenceSignal = mastery?.confidence ?? 20;
  const recency = mastery ? mastery.freshness : 30;
  const factors = {
    urgency,
    weakness,
    continuity,
    userPriority: 50,
    recency,
    examPressure,
    timeFit:
      availableMinutes === undefined
        ? clamp(100 - Math.max(0, action.duration - 45) * 2)
        : clamp(
            action.duration <= availableMinutes
              ? 100
              : 100 - (action.duration - availableMinutes) * 4
          ),
  };
  // Low-confidence mastery is intentionally not treated as proof of weakness.
  // Confidence blends into weakness only as a bounded adjustment, while exam
  // pressure and the raw evidence-derived score remain explicit factors.
  const confidenceAdjustment = (100 - confidenceSignal) * 0.08;
  const score =
    factors.urgency * 0.34 +
    factors.weakness * 0.34 +
    factors.examPressure * 0.12 +
    factors.continuity * 0.08 +
    factors.recency * 0.05 +
    factors.timeFit * 0.07 +
    confidenceAdjustment;
  const decisionConfidence =
    mastery?.directEvidenceCount &&
    mastery.directEvidenceCount >= 2 &&
    confidenceSignal >= 70
      ? "high"
      : mastery?.directEvidenceCount
        ? "medium"
        : "low";
  return {
    action: { ...action, score: Math.round(score * 100) },
    factors,
    confidence: decisionConfidence,
  };
}

export function prioritizeNextActions(
  decisions: PriorityDecision[],
  limit = 5
) {
  return decisions
    .toSorted(
      (a, b) =>
        b.action.score - a.action.score ||
        a.action.id.localeCompare(b.action.id)
    )
    .slice(0, limit);
}

export function getActionDecisionIndex(
  state: StudyState,
  actions: NextAction[],
  mastery: TopicMastery[],
  today = todayStr(),
  availableMinutes?: number
): PriorityDecision[] {
  const masteryByTopic = new Map(mastery.map(entry => [entry.topicId, entry]));
  return actions.map(action => {
    if (action.kind === "task") {
      const task = state.tasks.find(
        candidate => `task:${candidate.id}` === action.id
      );
      if (task) return taskDecision(action, task, today, availableMinutes);
    }
    if (action.kind === "session") {
      const session = state.sessions.find(
        candidate => `session:${candidate.id}` === action.id
      );
      if (session)
        return sessionDecision(action, session, today, availableMinutes);
    }
    if (action.kind === "study") {
      const days =
        state.exams
          .filter(exam =>
            exam.topics.some(topic => topic.id === action.topicId)
          )
          .map(exam => daysUntil(exam.date, today))
          .filter((value): value is number => value !== null && value >= 0)
          .sort((a, b) => a - b)[0] ?? 60;
      return studyDecision(
        action,
        action.topicId ? masteryByTopic.get(action.topicId) : undefined,
        days,
        availableMinutes
      );
    }
    return {
      action,
      factors: {
        urgency: 40,
        weakness: 0,
        continuity: 0,
        userPriority: 20,
        recency: 30,
        examPressure: 20,
        timeFit: 100,
      },
      confidence: "low" as const,
    };
  });
}
