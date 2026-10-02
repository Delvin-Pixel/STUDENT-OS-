import type { StudyState } from "./types";
import { todayStr } from "./utils";

function weekdayIndex(date: string) {
  return (new Date(`${date}T12:00:00`).getDay() + 6) % 7;
}

export function buildDailyContext(state: StudyState, date = todayStr()) {
  const day = weekdayIndex(date);
  const completedStudyMinutes =
    state.sessions
      .filter(
        session => session.date === date && session.status === "completed"
      )
      .reduce(
        (sum, session) => sum + (session.actualDuration ?? session.duration),
        0
      ) +
    state.focusSessions
      .filter(session => session.date === date)
      .reduce((sum, session) => sum + session.duration, 0);
  const monthPrefix = date.slice(0, 7);
  const monthlySpend = state.transactions
    .filter(
      transaction =>
        transaction.type === "expense" &&
        transaction.date.startsWith(monthPrefix)
    )
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  return {
    date,
    dueTasks: state.tasks
      .filter(
        task =>
          task.status !== "completed" && task.dueDate && task.dueDate <= date
      )
      .toSorted((a, b) => a.dueDate.localeCompare(b.dueDate)),
    sessions: state.sessions
      .filter(
        session =>
          session.date === date &&
          ["planned", "in_progress", "paused"].includes(session.status)
      )
      .toSorted((a, b) => a.startTime.localeCompare(b.startTime)),
    timetableEvents: state.events
      .filter(event => event.day === day)
      .toSorted((a, b) => a.startTime.localeCompare(b.startTime)),
    completedStudyMinutes,
    dailyGoalMinutes: state.dailyGoal.targetMinutes,
    activeGoals: state.goals.filter(goal => !goal.completed).slice(0, 3),
    habitCount: state.habits.length,
    remindersActive:
      state.settings.notifications &&
      (state.settings.notificationPreferences.tasks ||
        state.settings.notificationPreferences.exams ||
        state.settings.notificationPreferences.studyPlan ||
        state.settings.notificationPreferences.dailyGoal),
    monthlySpend,
    currency: state.settings.currency,
  };
}
