/* STUDENT OS — leaderboard helpers.
   Friends are stored on-device. Each friend has a base weekly XP level; their
   "actual" weekly score is seeded around that base so the ranking changes week
   to week and reads like a real competition. */

import { localDateFromTimestamp } from "./calendarValidation";
import type { Friend, StudyState } from "./types";
import { XP_RULES, isoDate, startOfWeek, weekDays } from "./utils";

function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

export function weekKey(date = new Date()): string {
  return isoDate(startOfWeek(date));
}

/** Seeded random offset around the friend's base weekly XP (-15% .. +18%). */
export function friendWeeklyXp(friend: Friend, week = weekKey()): number {
  const hash = `${friend.id}:${week}`
    .split("")
    .reduce((a, c) => a * 31 + c.charCodeAt(0), 7);
  const rng = seeded(hash);
  const variance = rng() * 0.33 - 0.15; // -0.15 .. +0.18
  return Math.max(0, Math.round(friend.weeklyBase * (1 + variance)));
}

/**
 * Counts only rewards whose canonical records identify a local day in the
 * selected week. Older undated legacy rewards are deliberately excluded rather
 * than being misrepresented as current-week points.
 */
export function learnerWeeklyXp(state: StudyState, dates = weekDays()): number {
  const inWeek = (date: string | null | undefined) =>
    Boolean(date && dates.includes(date));
  const sessions =
    state.sessions.filter(
      session =>
        session.status === "completed" &&
        inWeek(
          session.finishedAt
            ? localDateFromTimestamp(session.finishedAt)
            : session.date
        )
    ).length * XP_RULES.session;
  const focus = state.focusSessions
    .filter(session => inWeek(session.date))
    .reduce((total, session) => total + Math.round(session.duration / 10), 0);
  const tasks =
    state.tasks.filter(task =>
      inWeek(task.xpAwardedAt ? localDateFromTimestamp(task.xpAwardedAt) : null)
    ).length * XP_RULES.task;
  const goals =
    state.goals.filter(goal =>
      inWeek(goal.xpAwardedAt ? localDateFromTimestamp(goal.xpAwardedAt) : null)
    ).length * XP_RULES.goal;
  const quizzes = state.quizAttempts
    .filter(attempt => inWeek(localDateFromTimestamp(attempt.completedAt)))
    .reduce(
      (total, attempt) => total + Math.max(5, Math.round(attempt.score / 5)),
      0
    );
  const lessons =
    state.dailyLessonCompletions.filter(key =>
      inWeek(
        /^\d{4}-\d{2}-\d{2}$/.test(key.slice(0, 10)) ? key.slice(0, 10) : null
      )
    ).length * XP_RULES.dailyLesson;
  const habits = dates.reduce(
    (total, date) =>
      total + new Set(state.habitLog[date] ?? []).size * XP_RULES.habit,
    0
  );
  return sessions + focus + tasks + goals + quizzes + lessons + habits;
}

export interface BoardRow {
  name: string;
  emoji: string;
  xp: number;
  isYou: boolean;
  rank: number;
}

export function buildBoard(state: StudyState, dates = weekDays()): BoardRow[] {
  const you = learnerWeeklyXp(state, dates);
  const rows: BoardRow[] = state.friends.map(f => ({
    name: f.name,
    emoji: f.emoji,
    xp: friendWeeklyXp(f),
    isYou: false,
    rank: 0,
  }));
  rows.push({
    name: state.profile?.name ?? "You",
    emoji: "🫵",
    xp: you,
    isYou: true,
    rank: 0,
  });
  rows.sort((a, b) => b.xp - a.xp);
  rows.forEach((r, i) => (r.rank = i + 1));
  return rows;
}

export const COMMENTARY: Record<string, string[]> = {
  first: [
    "You're on fire this week — the one to beat.",
    "Top of the class. Keep that crown.",
    "Nobody's catching you this week.",
  ],
  mid: [
    "Mid-pack, but climbing.",
    "A few sprints and you'll catch them.",
    "This week is still yours for the taking.",
  ],
  last: [
    "Last place this week — but next week is a fresh start.",
    "Don't quit now. The comeback story writes itself.",
    "Bottom of the board. Time to grind.",
  ],
};

export function commentaryFor(position: number, total: number): string {
  const list =
    position === 1
      ? COMMENTARY.first
      : position >= total
        ? COMMENTARY.last
        : COMMENTARY.mid;
  return list[Math.floor(Math.random() * list.length)];
}
