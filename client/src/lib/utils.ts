import { clsx, type ClassValue } from "clsx";
import { nanoid } from "nanoid";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const uid = () => nanoid(10);

export function isoDate(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function isoTomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return isoDate(d);
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return isoDate(d);
}

export function daysBetween(a: string, b: string): number {
  const da = new Date(a + "T00:00:00").getTime();
  const db = new Date(b + "T00:00:00").getTime();
  return Math.round((db - da) / 86400000);
}

export function todayStr(): string {
  return isoDate();
}

export function yesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return isoDate(d);
}

export function daysFromNow(dateStr: string): number {
  return daysBetween(todayStr(), dateStr);
}

export function relativeDayLabel(dateStr: string): string {
  const days = daysFromNow(dateStr);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  return days > 1 ? `In ${days} days` : `${Math.abs(days)} days ago`;
}

export function startOfWeek(date = new Date()): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0 Sun
  const diff = (day + 6) % 7; // Monday-based week
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function weekDays(): string[] {
  const start = startOfWeek();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return isoDate(d);
  });
}

export function shortDay(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "short",
  });
}

export function dayName(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long",
  });
}

export function formatDateHuman(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  if (!m) return "";
  const suffix = h >= 12 ? "pm" : "am";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")}${suffix}`;
}

export function minutesToLabel(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function dayCountLabel(days: number): string {
  return `${days} ${days === 1 ? "day" : "days"}`;
}

export function streakLabel(days: number): string {
  return `${dayCountLabel(days)} streak`;
}

export function greeting(): { text: string; sub: string } {
  const h = new Date().getHours();
  if (h < 12)
    return {
      text: "Good morning",
      sub: "Rise and study — your day starts now.",
    };
  if (h < 18)
    return {
      text: "Good afternoon",
      sub: "Let's make the rest of the day count.",
    };
  return {
    text: "Good evening",
    sub: "One more productive stretch before bed.",
  };
}

/* ── Gamification ─────────────────────────────────────────────────── */

export const XP_RULES = {
  task: 10,
  session: 20,
  goal: 50,
  deckComplete: 30,
  examMilestone: 50,
  habit: 5,
  dailyLesson: 15,
} as const;

export const LEVELS = [
  { level: 1, name: "Beginner", min: 0 },
  { level: 2, name: "Focused", min: 100 },
  { level: 3, name: "Consistent", min: 300 },
  { level: 4, name: "Dedicated", min: 600 },
  { level: 5, name: "Scholar", min: 1000 },
  { level: 6, name: "Academic Beast", min: 1600 },
] as const;

export function levelForXp(xp: number) {
  let current: (typeof LEVELS)[number] = LEVELS[0];
  for (const l of LEVELS) if (xp >= l.min) current = l;
  const next = LEVELS.find(l => l.min > xp);
  return {
    current,
    next,
    nextMin: next?.min ?? current.min,
    progress: next ? (xp - current.min) / (next.min - current.min) : 1,
  };
}

export function checkAchievements(state: {
  sessionsCompleted: number;
  tasksCompleted: number;
  goalsCompleted: number;
  focusSessions: number;
  cardsReviewed: number;
  xp: number;
  streakDays: number;
}): string[] {
  const unlocked: string[] = [];
  const {
    sessionsCompleted,
    tasksCompleted,
    goalsCompleted,
    focusSessions,
    cardsReviewed,
    xp,
    streakDays,
  } = state;
  if (sessionsCompleted >= 1) unlocked.push("first_session");
  if (streakDays >= 7) unlocked.push("streak_7");
  if (sessionsCompleted >= 25) unlocked.push("bookworm");
  if (cardsReviewed >= 500) unlocked.push("flashcard_master");
  if (goalsCompleted >= 10) unlocked.push("goal_crusher");
  if (focusSessions >= 50) unlocked.push("focus_master");
  if (xp >= 500) unlocked.push("xp_500");
  if (tasksCompleted >= 20) unlocked.push("task_doer");
  return unlocked;
}

/* ── Color coding for subjects ────────────────────────────────────── */

const SUBJECT_COLORS = [
  {
    bg: "bg-[oklch(0.95_0.03_35)]",
    text: "text-[oklch(0.55_0.16_35)]",
    bar: "bg-[oklch(0.65_0.19_35)]",
    soft: "bg-[oklch(0.65_0.19_35)]/12",
    hex: "oklch(0.65 0.19 35)",
  },
  {
    bg: "bg-[oklch(0.94_0.02_195)]",
    text: "text-[oklch(0.52_0.09_195)]",
    bar: "bg-[oklch(0.62_0.11_195)]",
    soft: "bg-[oklch(0.62_0.11_195)]/12",
    hex: "oklch(0.62 0.11 195)",
  },
  {
    bg: "bg-[oklch(0.93_0.03_295)]",
    text: "text-[oklch(0.5_0.15_295)]",
    bar: "bg-[oklch(0.55_0.18_295)]",
    soft: "bg-[oklch(0.55_0.18_295)]/12",
    hex: "oklch(0.55 0.18 295)",
  },
  {
    bg: "bg-[oklch(0.95_0.05_75)]",
    text: "text-[oklch(0.6_0.13_75)]",
    bar: "bg-[oklch(0.78_0.15_75)]",
    soft: "bg-[oklch(0.78_0.15_75)]/12",
    hex: "oklch(0.78 0.15 75)",
  },
  {
    bg: "bg-[oklch(0.94_0.03_235)]",
    text: "text-[oklch(0.55_0.1_235)]",
    bar: "bg-[oklch(0.68_0.12_235)]",
    soft: "bg-[oklch(0.68_0.12_235)]/12",
    hex: "oklch(0.68 0.12 235)",
  },
  {
    bg: "bg-[oklch(0.93_0.04_155)]",
    text: "text-[oklch(0.52_0.13_155)]",
    bar: "bg-[oklch(0.62_0.15_155)]",
    soft: "bg-[oklch(0.62_0.15_155)]/12",
    hex: "oklch(0.62 0.15 155)",
  },
];

const colorCache = new Map<string, (typeof SUBJECT_COLORS)[number]>();

export function subjectColor(subject: string) {
  if (!colorCache.has(subject)) {
    const key = subject.toLowerCase();
    // stable hash so a subject always gets the same color
    let hash = 0;
    for (let i = 0; i < key.length; i++)
      hash = (hash * 31 + key.charCodeAt(i)) % SUBJECT_COLORS.length;
    colorCache.set(subject, SUBJECT_COLORS[hash]);
  }
  return colorCache.get(subject)!;
}

export const PRIORITY_STYLES = {
  high: { chip: "bg-destructive/10 text-destructive", dot: "bg-destructive" },
  medium: {
    chip: "bg-[oklch(0.85_0.12_75)]/30 text-[oklch(0.55_0.12_70)]",
    dot: "bg-[oklch(0.78_0.15_75)]",
  },
  low: {
    chip: "bg-[oklch(0.92_0.04_155)] text-[oklch(0.48_0.1_155)]",
    dot: "bg-[oklch(0.62_0.15_155)]",
  },
} as const;

export const STATUS_LABELS = {
  todo: "To Do",
  in_progress: "In Progress",
  completed: "Completed",
  planned: "Planned",
  not_started: "Not started",
  learning: "Learning",
  revised: "Revised",
  mastered: "Mastered",
} as const;

export const MOTIVATION = [
  "Small steps every day beat one big step once a month.",
  "You don't have to be perfect — just consistent.",
  "The best time to study was yesterday. The next best is now.",
  "Discipline is choosing what you want most over what you want now.",
  "Every session counts. Every card reviewed counts.",
  "Progress is progress, no matter the pace.",
  "Your future self will thank you for today's effort.",
];
