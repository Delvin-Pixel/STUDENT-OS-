import type { QuizAttempt, StudyQuiz, StudyState } from "./types";

type AttemptWithQuiz = { attempt: QuizAttempt; quiz: StudyQuiz };

export type AssessmentConceptSignal = {
  key: string;
  label: string;
  attempts: number;
  distinctQuestions: number;
  misses: number;
  opportunities: number;
  accuracy: number;
  recentAccuracy: number;
  repeatedMiss: boolean;
  confidence: number;
  severity: "high" | "medium" | "low";
  reason: string;
  recommendedAction: "review" | "practice" | "recheck";
};

export type AssessmentIntelligence = {
  topicId: string;
  quizzesConsidered: number;
  attemptsConsidered: number;
  questionsConsidered: number;
  misses: number;
  score: number;
  distinctQuestionsMissed: number;
  conceptSignals: AssessmentConceptSignal[];
  primarySignal?: AssessmentConceptSignal;
  remediation: string;
  confidence: number;
};

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function attemptsForTopic(
  state: StudyState,
  topicId: string
): AttemptWithQuiz[] {
  const quizzes = new Map(state.quizzes.map(quiz => [quiz.id, quiz]));
  return state.quizAttempts
    .map(attempt => ({ attempt, quiz: quizzes.get(attempt.quizId) }))
    .filter(
      (entry): entry is AttemptWithQuiz =>
        entry.quiz !== undefined &&
        (entry.attempt.topicId ?? entry.quiz.topicId) === topicId
    )
    .sort((a, b) => a.attempt.completedAt.localeCompare(b.attempt.completedAt));
}

function severityFor(
  accuracy: number,
  confidence: number,
  repeatedMiss: boolean
): AssessmentConceptSignal["severity"] {
  if ((accuracy < 45 && confidence >= 45) || (repeatedMiss && accuracy < 60))
    return "high";
  if (accuracy < 70 || confidence < 45) return "medium";
  return "low";
}

/**
 * Turns quiz response evidence into deterministic remediation signals.
 * It deliberately says "concept signal" rather than diagnosing a specific
 * misconception: answer patterns can locate a likely weak concept, but cannot
 * prove why a learner chose a wrong answer.
 */
export function getAssessmentIntelligence(
  state: StudyState,
  topicId: string
): AssessmentIntelligence {
  const entries = attemptsForTopic(state, topicId);
  if (!entries.length) {
    return {
      topicId,
      quizzesConsidered: 0,
      attemptsConsidered: 0,
      questionsConsidered: 0,
      misses: 0,
      score: 0,
      distinctQuestionsMissed: 0,
      conceptSignals: [],
      remediation:
        "No quiz response evidence is available yet. Run a focused check to locate the gap.",
      confidence: 0,
    };
  }

  const groups = new Map<
    string,
    {
      label: string;
      attempts: Set<string>;
      questions: Set<string>;
      misses: number;
      opportunities: number;
      recent: Array<{ correct: boolean }>;
    }
  >();
  const missedQuestionIds = new Set<string>();
  let questionsConsidered = 0;
  let misses = 0;

  for (const { attempt } of entries) {
    for (const response of attempt.responses ?? []) {
      questionsConsidered += 1;
      if (!response.correct) {
        misses += 1;
        missedQuestionIds.add(response.questionId);
      }
      const label = response.subtopic?.trim() || "General topic";
      const key = normalize(label);
      const group = groups.get(key) ?? {
        label,
        attempts: new Set<string>(),
        questions: new Set<string>(),
        misses: 0,
        opportunities: 0,
        recent: [],
      };
      group.attempts.add(attempt.id);
      group.questions.add(response.questionId);
      group.opportunities += 1;
      if (!response.correct) group.misses += 1;
      group.recent.push({ correct: response.correct });
      groups.set(key, group);
    }
  }

  const conceptSignals = Array.from(groups.entries())
    .map(([key, group]) => {
      const accuracy = group.opportunities
        ? Math.round(
            ((group.opportunities - group.misses) / group.opportunities) * 100
          )
        : 0;
      const recentWindow = group.recent.slice(
        -Math.min(5, group.recent.length)
      );
      const recentAccuracy = recentWindow.length
        ? Math.round(
            (recentWindow.filter(entry => entry.correct).length /
              recentWindow.length) *
              100
          )
        : accuracy;
      const repeatedMiss = group.misses >= 2 && group.questions.size >= 2;
      const evidenceBreadth = Math.min(40, group.questions.size * 10);
      const attemptDepth = Math.min(35, group.attempts.size * 12);
      const recurrence = repeatedMiss ? 20 : group.misses > 0 ? 8 : 0;
      const confidence = clamp(
        evidenceBreadth +
          attemptDepth +
          recurrence +
          (group.opportunities >= 3 ? 5 : 0)
      );
      const severity = severityFor(accuracy, confidence, repeatedMiss);
      const recommendedAction: AssessmentConceptSignal["recommendedAction"] =
        severity === "high" ? "review" : accuracy < 75 ? "practice" : "recheck";
      const reason = repeatedMiss
        ? `${group.misses} misses recur across ${group.questions.size} distinct questions in this concept. That is a strong signal for targeted remediation.`
        : group.misses > 0
          ? `${group.misses} miss${group.misses === 1 ? "" : "es"} appear in this concept; more varied checks are needed before drawing a strong conclusion.`
          : "No misses are visible in this concept across the retained response evidence.";
      return {
        key,
        label: group.label,
        attempts: group.attempts.size,
        distinctQuestions: group.questions.size,
        misses: group.misses,
        opportunities: group.opportunities,
        accuracy,
        recentAccuracy,
        repeatedMiss,
        confidence,
        severity,
        reason,
        recommendedAction,
      } satisfies AssessmentConceptSignal;
    })
    .sort(
      (a, b) =>
        (b.severity === "high" ? 2 : b.severity === "medium" ? 1 : 0) -
          (a.severity === "high" ? 2 : a.severity === "medium" ? 1 : 0) ||
        a.accuracy - b.accuracy ||
        b.confidence - a.confidence ||
        a.label.localeCompare(b.label)
    );

  const totalQuestions = entries.reduce(
    (sum, entry) => sum + entry.attempt.questionCount,
    0
  );
  const score = Math.round(
    entries.reduce((sum, entry) => sum + entry.attempt.score, 0) /
      entries.length
  );
  const primarySignal =
    conceptSignals.find(signal => signal.misses > 0) ?? conceptSignals[0];
  const confidence = primarySignal
    ? clamp(
        Math.round(
          (primarySignal.confidence + Math.min(30, entries.length * 8)) * 0.8
        )
      )
    : Math.min(70, entries.length * 10);
  const remediation = primarySignal
    ? primarySignal.severity === "high"
      ? `Target ${primarySignal.label} first: review the concept, then use fresh questions that test it in a different way.`
      : primarySignal.severity === "medium"
        ? `Practice ${primarySignal.label} with fresh questions before using another full-topic score as proof of mastery.`
        : `Use a short recheck on ${primarySignal.label} to confirm the signal holds across fresh questions.`
    : "The retained responses do not reveal a concentrated weak concept yet. Use varied questions to improve diagnostic resolution.";

  return {
    topicId,
    quizzesConsidered: new Set(entries.map(entry => entry.quiz.id)).size,
    attemptsConsidered: entries.length,
    questionsConsidered: Math.max(questionsConsidered, totalQuestions),
    misses,
    score,
    distinctQuestionsMissed: missedQuestionIds.size,
    conceptSignals,
    primarySignal,
    remediation,
    confidence,
  };
}
