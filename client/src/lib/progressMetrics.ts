import type {
  FocusSessionRecord,
  LearningEvidence,
  StudySession,
} from "./types";

/** Completed-learning projections must use what the learner recorded, not the original plan. */
export function completedSessionMinutes(
  session: Pick<StudySession, "duration" | "actualDuration">
): number {
  return Math.max(0, session.actualDuration ?? session.duration);
}

export type LearningMetrics = {
  scheduledMinutes: number;
  completedSessionMinutes: number;
  focusMinutes: number;
  academicEvidenceMinutes: number;
  /** Deliberately additive only for independent records; labels must show the components. */
  totalRecordedMinutes: number;
};

const inDates = (date: string, dates: readonly string[]) =>
  dates.includes(date);

/**
 * Returns separate time signals instead of presenting planned time, completed
 * planner time, Focus time, and evidence minutes as one ambiguous number.
 * Focus records have no canonical StudySession identity, so they remain an
 * explicitly separate signal rather than being heuristically de-duplicated.
 */
export function learningMetrics(
  sessions: Array<
    Pick<StudySession, "date" | "duration" | "actualDuration" | "status">
  >,
  focusSessions: Array<Pick<FocusSessionRecord, "date" | "duration">>,
  evidence: Array<Pick<LearningEvidence, "recordedAt" | "minutes">> = [],
  dates: readonly string[]
): LearningMetrics {
  const scopedSessions = sessions.filter(session =>
    inDates(session.date, dates)
  );
  const scheduledMinutes = scopedSessions
    .filter(
      session =>
        session.status === "planned" ||
        session.status === "in_progress" ||
        session.status === "paused"
    )
    .reduce((total, session) => total + Math.max(0, session.duration), 0);
  const completedPlannerMinutes = scopedSessions
    .filter(session => session.status === "completed")
    .reduce((total, session) => total + completedSessionMinutes(session), 0);
  const focusMinutes = focusSessions
    .filter(session => inDates(session.date, dates))
    .reduce((total, session) => total + Math.max(0, session.duration), 0);
  const academicEvidenceMinutes = evidence
    .filter(item =>
      inDates(new Date(item.recordedAt).toLocaleDateString("en-CA"), dates)
    )
    .reduce((total, item) => total + Math.max(0, item.minutes ?? 0), 0);

  return {
    scheduledMinutes,
    completedSessionMinutes: completedPlannerMinutes,
    focusMinutes,
    academicEvidenceMinutes,
    totalRecordedMinutes: completedPlannerMinutes + focusMinutes,
  };
}

/** Backward-compatible aggregate used by goals and assistant planning. */
export function weeklyLearningMinutes(
  sessions: Array<
    Pick<StudySession, "date" | "duration" | "actualDuration" | "status">
  >,
  focusSessions: Array<Pick<FocusSessionRecord, "date" | "duration">>,
  dates: readonly string[]
) {
  return learningMetrics(sessions, focusSessions, [], dates)
    .totalRecordedMinutes;
}
