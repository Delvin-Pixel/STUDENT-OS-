import type { StudyState } from "./types";
import { checkAchievements, isoDate, todayStr } from "./utils";

/** Applies one reward and refreshes achievement status from the resulting state. */
export function awardXpState(state: StudyState, amount: number): StudyState {
  const xp = Math.max(0, state.xp + amount);
  const unlockedIds = checkAchievements({
    sessionsCompleted: state.sessions.filter(
      session => session.status === "completed"
    ).length,
    tasksCompleted: state.tasks.filter(task => task.status === "completed")
      .length,
    goalsCompleted: state.goals.filter(goal => goal.completed).length,
    focusSessions: state.focusSessions.length,
    cardsReviewed: state.decks.reduce(
      (sum, deck) =>
        sum +
        deck.cards.filter(
          card => card.status === "easy" || card.status === "difficult"
        ).length,
      0
    ),
    xp,
    streakDays: state.streakDays,
  });

  return {
    ...state,
    xp,
    achievements: state.achievements.map(achievement =>
      !achievement.unlocked && unlockedIds.includes(achievement.id)
        ? { ...achievement, unlocked: true, unlockedAt: todayStr() }
        : achievement
    ),
  };
}

/** Records one meaningful activity in the provided state so compound transitions stay atomic. */
export function recordActivityState(prev: StudyState): StudyState {
  const today = todayStr();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yIso = isoDate(yesterday);
  let { streakDays, streakStart } = prev;
  if (prev.lastActiveDay === today) {
    // already logged today — no change
  } else if (prev.lastActiveDay === yIso) {
    streakDays += 1;
  } else if (!prev.lastActiveDay) {
    streakDays = 1;
    streakStart = today;
  } else {
    streakDays = 1;
    streakStart = today;
  }
  return {
    ...prev,
    lastActiveDay: today,
    streakDays,
    streakStart,
    longestStreak: Math.max(prev.longestStreak ?? 0, streakDays),
  };
}

/** Records a lesson only once, preventing double rewards from repeated clicks. */
export function recordDailyLessonCompletion(
  state: StudyState,
  lessonKey: string,
  xpReward: number
) {
  if (state.dailyLessonCompletions.includes(lessonKey)) {
    return { state, recorded: false } as const;
  }
  return {
    state: awardXpState(
      {
        ...state,
        dailyLessonCompletions: [...state.dailyLessonCompletions, lessonKey],
      },
      xpReward
    ),
    recorded: true,
  } as const;
}
