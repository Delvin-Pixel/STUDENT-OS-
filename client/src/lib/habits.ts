import { awardXpState, recordActivityState } from "./gamification";
import type { StudyState } from "./types";
import { XP_RULES } from "./utils";

/** Toggles one habit against the actual predecessor state, including its matching XP transition. */
export function toggleHabitCompletion(
  state: StudyState,
  habitId: string,
  date: string
): StudyState {
  if (!state.habits.some(habit => habit.id === habitId)) return state;
  const done = state.habitLog[date]?.includes(habitId) ?? false;
  const dayDone = (state.habitLog[date] ?? []).filter(id => id !== habitId);
  if (!done) dayDone.push(habitId);
  const next = { ...state, habitLog: { ...state.habitLog, [date]: dayDone } };
  return done
    ? awardXpState(next, -XP_RULES.habit)
    : recordActivityState(awardXpState(next, XP_RULES.habit));
}
