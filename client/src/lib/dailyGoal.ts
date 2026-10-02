import type { StudyState } from "./types";

export type DailyGoalProgress = {
  completedMinutes: number;
  targetMinutes: number;
  remainingMinutes: number;
  percent: number;
  complete: boolean;
};

/** Derive a student's daily learning progress from completed study and focus work. */
export function getDailyGoalProgress(
  state: StudyState,
  date: string
): DailyGoalProgress {
  const sessionMinutes = state.sessions
    .filter(session => session.date === date && session.status === "completed")
    .reduce(
      (total, session) =>
        total + Math.max(0, session.actualDuration ?? session.duration),
      0
    );
  const focusMinutes = state.focusSessions
    .filter(session => session.date === date)
    .reduce((total, session) => total + Math.max(0, session.duration), 0);
  const targetMinutes = Math.max(10, state.dailyGoal.targetMinutes);
  const completedMinutes = sessionMinutes + focusMinutes;
  return {
    completedMinutes,
    targetMinutes,
    remainingMinutes: Math.max(0, targetMinutes - completedMinutes),
    percent: Math.min(
      100,
      Math.round((completedMinutes / targetMinutes) * 100)
    ),
    complete: completedMinutes >= targetMinutes,
  };
}
