import { weeklyLearningMinutes } from "./progressMetrics";
import type { Exam, StudyState } from "./types";
import { weekDays } from "./utils";

/** The Assistant must describe the same current-week learning total shown elsewhere. */
export function getCurrentWeekLearningMinutes(
  state: StudyState,
  dates = weekDays()
) {
  return weeklyLearningMinutes(state.sessions, state.focusSessions, dates);
}

/** Selects the earliest exam without mutating the canonical workspace collection. */
export function getUpcomingExam(exams: Exam[]) {
  return [...exams].sort((a, b) => a.date.localeCompare(b.date))[0];
}
