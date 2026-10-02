import { localDateFromTimestamp } from "./calendarValidation";
import { getRankedNextActions, getTopicMastery } from "./learningIntelligence";
import { learningMetrics } from "./progressMetrics";
import type { StudyState } from "./types";
import { todayStr, weekDays } from "./utils";

export function buildDailyReview(state: StudyState, date = todayStr()) {
  const sessions = state.sessions.filter(
    session => session.date === date && session.status === "completed"
  );
  const metrics = learningMetrics(
    state.sessions,
    state.focusSessions,
    state.learningEvidence,
    [date]
  );
  const quizAttempts = state.quizAttempts.filter(
    attempt => localDateFromTimestamp(attempt.completedAt) === date
  );
  const actions = getRankedNextActions(state, date);
  const weakTopic = getTopicMastery(state).sort((a, b) => a.score - b.score)[0];
  return {
    completedStudyMinutes: metrics.totalRecordedMinutes,
    completedPlannerMinutes: metrics.completedSessionMinutes,
    focusMinutes: metrics.focusMinutes,
    academicEvidenceMinutes: metrics.academicEvidenceMinutes,
    completedSessions: sessions.length,
    completedTasks: state.tasks.filter(
      task =>
        task.completedAt && localDateFromTimestamp(task.completedAt) === date
    ).length,
    quizAttempts,
    nextAction: actions[0] ?? null,
    weakTopic: weakTopic ?? null,
  };
}

export function buildWeeklyReview(state: StudyState, dates = weekDays()) {
  const completedSessions = state.sessions.filter(
    session => dates.includes(session.date) && session.status === "completed"
  );
  const metrics = learningMetrics(
    state.sessions,
    state.focusSessions,
    state.learningEvidence,
    dates
  );
  const attempts = state.quizAttempts.filter(attempt => {
    const date = localDateFromTimestamp(attempt.completedAt);
    return Boolean(date && dates.includes(date));
  });
  const averageQuizScore = attempts.length
    ? Math.round(
        attempts.reduce((sum, attempt) => sum + attempt.score, 0) /
          attempts.length
      )
    : null;
  const completedTasks = state.tasks.filter(task => {
    const date = task.completedAt
      ? localDateFromTimestamp(task.completedAt)
      : null;
    return Boolean(date && dates.includes(date));
  }).length;
  return {
    studyMinutes: metrics.totalRecordedMinutes,
    completedPlannerMinutes: metrics.completedSessionMinutes,
    focusMinutes: metrics.focusMinutes,
    scheduledMinutes: metrics.scheduledMinutes,
    academicEvidenceMinutes: metrics.academicEvidenceMinutes,
    completedSessions: completedSessions.length,
    completedTasks,
    attempts,
    averageQuizScore,
  };
}
