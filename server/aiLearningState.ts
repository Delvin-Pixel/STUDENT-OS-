import { z } from "zod";

type Evidence = {
  topicId: string;
  subject: string;
  kind?: string;
  score?: number;
  minutes?: number;
  recordedAt?: string;
};
type Topic = { id: string; subject: string; name: string };
type Exam = {
  id?: string;
  subject: string;
  name: string;
  date: string;
  topics: Array<{ id: string; name: string; status: string }>;
};
type Task = {
  subject?: string;
  title?: string;
  topicId?: string;
  dueDate?: string;
  priority?: string;
  status?: string;
};

export type LearnerLearningState = {
  topics: Topic[];
  learningEvidence: Evidence[];
  exams: Exam[];
  tasks: Task[];
};

const snapshotSchema = z.object({
  requestedSubject: z.string(),
  requestedTopic: z.string(),
  masteryScore: z.number().min(0).max(100),
  masteryBand: z.enum(["unknown", "needs_review", "developing", "strong"]),
  evidenceCount: z.number().int().min(0),
  directEvidenceCount: z.number().int().min(0),
  daysSinceEvidence: z.number().int().min(0).nullable(),
  upcomingExamDays: z.number().int().min(0).nullable(),
  upcomingExamName: z.string().nullable(),
  openTaskCount: z.number().int().min(0),
  priorityGuidance: z.enum(["rebuild", "practice", "maintain", "learn_first"]),
  evidenceSummary: z.array(z.string()).max(5),
});

export type LearningStateSnapshot = z.infer<typeof snapshotSchema>;

function normalize(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function daysBetween(dateA: string, dateB: string) {
  const a = new Date(`${dateA}T12:00:00Z`).getTime();
  const b = new Date(`${dateB}T12:00:00Z`).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86400000));
}

function recencyWeight(recordedAt: string | undefined, today: string) {
  if (!recordedAt) return 0.35;
  const parsed = new Date(recordedAt);
  if (Number.isNaN(parsed.getTime())) return 0.35;
  const date = parsed.toISOString().slice(0, 10);
  const age = Math.max(0, daysBetween(date, today));
  if (age <= 7) return 1;
  if (age <= 30) return 0.7;
  return 0.45;
}

function band(
  score: number,
  evidenceCount: number
): LearningStateSnapshot["masteryBand"] {
  if (evidenceCount === 0) return "unknown";
  if (score < 55) return "needs_review";
  if (score < 75) return "developing";
  return "strong";
}

function priorityGuidanceFor(
  score: number,
  evidenceCount: number,
  examDays: number | null
): LearningStateSnapshot["priorityGuidance"] {
  if (evidenceCount === 0) return "learn_first";
  if (score < 55) return "rebuild";
  if (score < 75)
    return examDays !== null && examDays <= 21 ? "practice" : "learn_first";
  return examDays !== null && examDays <= 14 ? "practice" : "maintain";
}

/**
 * Builds a compact, bounded learner-state summary for AI prompts. The full
 * workspace is never sent to the model. Only deterministic signals that help
 * choose an appropriate learning action are projected.
 */
export function buildLearningStateSnapshot(
  state: LearnerLearningState,
  subject: string,
  topic: string,
  today: string
): LearningStateSnapshot {
  const requestedSubject = subject.trim();
  const requestedTopic = topic.trim();
  const normalizedSubject = normalize(requestedSubject);
  const normalizedTopic = normalize(requestedTopic);
  const topicRecord =
    state.topics.find(
      candidate =>
        normalize(candidate.name) === normalizedTopic &&
        normalize(candidate.subject) === normalizedSubject
    ) ??
    state.topics.find(
      candidate => normalize(candidate.name) === normalizedTopic
    );
  const topicId = topicRecord?.id;
  const evidence = state.learningEvidence.filter(
    entry =>
      (topicId && entry.topicId === topicId) ||
      (!topicId &&
        normalize(entry.subject || "") === normalizedSubject &&
        normalize((entry as Evidence & { topic?: string }).topic || "") ===
          normalizedTopic)
  );
  const direct = evidence.filter(
    entry =>
      (entry.kind === "quiz" || entry.kind === "practice") &&
      typeof entry.score === "number"
  );
  const weightedScore = direct.reduce(
    (sum, entry) =>
      sum + (entry.score as number) * recencyWeight(entry.recordedAt, today),
    0
  );
  const weight = direct.reduce(
    (sum, entry) => sum + recencyWeight(entry.recordedAt, today),
    0
  );
  const baseScore =
    weight > 0 ? weightedScore / weight : evidence.length ? 50 : 0;
  const studyMinutes = evidence
    .filter(entry => entry.kind === "study_session")
    .reduce((sum, entry) => sum + Math.min(60, entry.minutes ?? 0), 0);
  const masteryScore = evidence.length
    ? Math.round(
        Math.min(100, baseScore + Math.min(8, Math.round(studyMinutes / 30)))
      )
    : 0;

  const relevantExams = state.exams
    .filter(
      exam =>
        normalize(exam.subject) === normalizedSubject && exam.date >= today
    )
    .map(exam => ({
      exam,
      days: daysBetween(today, exam.date),
      topicMatch: topicId
        ? exam.topics.some(candidate => candidate.id === topicId)
        : exam.topics.some(
            candidate => normalize(candidate.name) === normalizedTopic
          ),
    }))
    .filter(entry => entry.topicMatch)
    .sort((a, b) => a.days - b.days);
  const upcoming = relevantExams[0];
  const openTaskCount = state.tasks.filter(
    task =>
      task.status !== "completed" &&
      normalize(task.subject || "") === normalizedSubject &&
      (!task.topicId || !topicId || task.topicId === topicId)
  ).length;
  const lastEvidence = evidence
    .map(entry => entry.recordedAt)
    .filter(Boolean)
    .sort()
    .at(-1);
  const daysSinceEvidence = lastEvidence
    ? daysBetween(lastEvidence.slice(0, 10), today)
    : null;
  const masteryBand = band(masteryScore, evidence.length);
  const priorityGuidance = priorityGuidanceFor(
    masteryScore,
    evidence.length,
    upcoming?.days ?? null
  );

  const evidenceSummary = [
    evidence.length
      ? `${evidence.length} learning evidence record${evidence.length === 1 ? "" : "s"} for this topic.`
      : "No recorded learning evidence for this topic yet.",
    direct.length
      ? `${direct.length} direct assessment result${direct.length === 1 ? "" : "s"} inform the current mastery estimate.`
      : "No direct quiz/practice score is available for this topic.",
    daysSinceEvidence !== null
      ? `Latest evidence is ${daysSinceEvidence} day${daysSinceEvidence === 1 ? "" : "s"} old.`
      : "Recency cannot be established yet.",
    upcoming
      ? `Linked exam “${upcoming.exam.name}” is ${upcoming.days === 0 ? "today" : `in ${upcoming.days} day${upcoming.days === 1 ? "" : "s"}`}.`
      : "No linked upcoming exam was found for this topic.",
    openTaskCount
      ? `${openTaskCount} open task${openTaskCount === 1 ? "" : "s"} also reference this subject/topic.`
      : "No open task currently references this subject/topic.",
  ];

  return snapshotSchema.parse({
    requestedSubject,
    requestedTopic,
    masteryScore,
    masteryBand,
    evidenceCount: evidence.length,
    directEvidenceCount: direct.length,
    daysSinceEvidence,
    upcomingExamDays: upcoming?.days ?? null,
    upcomingExamName: upcoming?.exam.name ?? null,
    openTaskCount,
    priorityGuidance,
    evidenceSummary,
  });
}

/** Human-readable, bounded prompt context for AI. */
export function learningStatePrompt(snapshot: LearningStateSnapshot) {
  return [
    `Current mastery estimate: ${snapshot.masteryBand}${snapshot.evidenceCount ? ` (${snapshot.masteryScore}/100)` : " (no evidence yet)"}.`,
    `Learning action guidance: ${snapshot.priorityGuidance}.`,
    snapshot.upcomingExamDays !== null
      ? `Upcoming linked exam: ${snapshot.upcomingExamName} in ${snapshot.upcomingExamDays} day${snapshot.upcomingExamDays === 1 ? "" : "s"}.`
      : "No linked upcoming exam.",
    snapshot.daysSinceEvidence !== null
      ? `Latest evidence age: ${snapshot.daysSinceEvidence} day${snapshot.daysSinceEvidence === 1 ? "" : "s"}.`
      : "No prior evidence.",
    snapshot.openTaskCount
      ? `Open related tasks: ${snapshot.openTaskCount}.`
      : "No open related tasks.",
    "Do not invent scores, deadlines, completed work, or mastery claims that are not present in this context.",
  ].join(" ");
}

/** Rejects strong unsupported claims that contradict the deterministic snapshot. */
export function validateLearningStateClaims(
  outputText: string,
  snapshot: LearningStateSnapshot,
  label: string
) {
  const text = normalize(outputText);
  if (!text) throw new Error(`${label} has no usable learning-state content.`);
  const explicitScoreMatches = [
    ...outputText.matchAll(
      /\b(?:scored|score|got|achieved|mastered)\s+(\d{1,3})\s*%/gi
    ),
  ];
  for (const match of explicitScoreMatches) {
    const claimed = Number(match[1]);
    if (
      snapshot.directEvidenceCount === 0 ||
      Math.abs(claimed - snapshot.masteryScore) > 25
    ) {
      throw new Error(
        `${label} contains an unsupported assessment score claim.`
      );
    }
  }
  const explicitExam =
    /\b(?:your|the)\s+(?:exam|test)\b.*\b(?:today|tomorrow|in\s+\d+\s+days?)\b/i.test(
      outputText
    );
  if (explicitExam && snapshot.upcomingExamDays === null) {
    throw new Error(`${label} contains an unsupported imminent-exam claim.`);
  }
}
