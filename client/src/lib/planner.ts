/* STUDENT OS — Smart Planner & "Generate My Study Plan" algorithm.
   Pure local rule-based logic. Prioritises: 1) upcoming exams 2) weak subjects
   3) important topics 4) subjects not studied recently. Structured so a real
   AI API can be plugged in later. */

import { isoDate } from "./utils";

export interface PlanInput {
  subjects: {
    name: string;
    difficulty: "easy" | "medium" | "hard";
    confidence: 1 | 2 | 3 | 4 | 5; // 1 = weak, 5 = strong
    lastStudied: string; // ISO date or ""
    examDate?: string; // ISO date or ""
  }[];
  availableHoursPerDay: number;
  preferredTimes: string[]; // e.g. ["Morning", "Afternoon", "Evening"]
  startDate: string; // ISO date
}

export interface PlanDay {
  date: string;
  label: string;
  slots: {
    subject: string;
    minutes: number;
    reason: string;
    timeOfDay: string;
  }[];
  totalMinutes: number;
}

export interface GeneratedPlan {
  days: PlanDay[];
  totalMinutes: number;
  notes: string[];
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

function daysUntil(dateStr: string, from: string): number {
  const a = new Date(from + "T00:00:00").getTime();
  const b = new Date(dateStr + "T00:00:00").getTime();
  return Math.round((b - a) / 86400000);
}

function weaknessScore(difficulty: string, confidence: number): number {
  // higher = needs more study time
  let s = (5 - confidence) * 20; // 0-80
  if (difficulty === "hard") s += 25;
  else if (difficulty === "medium") s += 12;
  return s;
}

function recencyScore(lastStudied: string, from: string): number {
  if (!lastStudied) return 30; // never studied = high priority
  const d = daysUntil(lastStudied, from);
  if (d < 2) return 0;
  if (d < 7) return 15;
  return 30;
}

export function generateStudyPlan(input: PlanInput): GeneratedPlan {
  const minutesPerDay = Math.round(input.availableHoursPerDay * 60);
  if (minutesPerDay < 15) {
    return {
      days: [],
      totalMinutes: 0,
      notes: [
        "Not enough time entered — aim for at least 30 minutes a day to build momentum.",
      ],
    };
  }

  const start = new Date(input.startDate + "T00:00:00");
  // Build next 7 days
  const days: PlanDay[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const iso = isoDate(d);
    return {
      date: iso,
      label: `${DAY_LABELS[(d.getDay() + 6) % 7]}, ${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
      slots: [],
      totalMinutes: 0,
    };
  });

  const timeSlots = input.preferredTimes.length
    ? input.preferredTimes
    : ["Afternoon"];

  const notes: string[] = [];

  // Score each subject per day
  const daySubjects = days.map(day => {
    const scores = input.subjects.map(s => {
      let score =
        weaknessScore(s.difficulty, s.confidence) +
        recencyScore(s.lastStudied, day.date);
      // exam urgency: boost when exam within the next 14 days, closer = bigger
      if (s.examDate) {
        const until = daysUntil(s.examDate, day.date);
        if (until >= 0 && until <= 14) score += Math.round((14 - until) * 4);
        else if (until < 0) score -= 50; // exam already passed — deprioritise
      }
      // cap per-day so subjects rotate
      return { ...s, score };
    });
    return scores;
  });

  // Allocate slots: fill each day up to minutesPerDay
  days.forEach((day, dayIdx) => {
    let remaining = minutesPerDay;
    // sort subjects by score desc; rotate starting position across days for variety
    const ordered = [...daySubjects[dayIdx]].sort((a, b) => b.score - a.score);
    const rotation = dayIdx % ordered.length;
    const rotated = [...ordered.slice(rotation), ...ordered.slice(0, rotation)];
    for (const s of rotated) {
      if (remaining <= 0) break;
      const minutes =
        remaining >= 60 ? 60 : remaining >= 45 ? 45 : remaining >= 30 ? 30 : 15;
      if (minutes < 20) break; // skip micro-slots
      let reason = "";
      if (
        s.examDate &&
        daysUntil(s.examDate, day.date) <= 14 &&
        daysUntil(s.examDate, day.date) >= 0
      )
        reason = `Exam on ${new Date(s.examDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
      else if (s.confidence <= 2)
        reason = "Weak area — extra practice pays off";
      else if (!s.lastStudied)
        reason = "Haven't touched this yet — good time to start";
      else if (daysUntil(s.lastStudied, day.date) >= 7)
        reason = "Not studied in a while — keep it fresh";
      else reason = "Regular review";
      const timeOfDay =
        timeSlots[(dayIdx + Math.floor(dayIdx / 2)) % timeSlots.length];
      day.slots.push({ subject: s.name, minutes, reason, timeOfDay });
      day.totalMinutes += minutes;
      remaining -= minutes;
    }
  });

  // Sanity notes
  const heavy = days.find(
    d => d.totalMinutes > input.availableHoursPerDay * 60
  );
  if (heavy)
    notes.push(
      `${heavy.label} is your busiest day — feel free to trim a slot.`
    );
  const noExam = input.subjects.every(s => !s.examDate);
  if (noExam)
    notes.push(
      "No exam dates set yet — add one in the Exam Centre to make your plan exam-focused."
    );

  const totalMinutes = days.reduce((sum, d) => sum + d.totalMinutes, 0);
  return { days, totalMinutes, notes };
}

/* Weekly smart planner variant: spreads given subjects across the week with
   a weekly hour budget, used by the Study Planner smart mode. */
export function generateWeeklyPlan(
  subjects: {
    name: string;
    difficulty: "easy" | "medium" | "hard";
    confidence: number;
  }[],
  weeklyHours: number
): { subject: string; weeklyMinutes: number }[] {
  if (subjects.length === 0 || weeklyHours <= 0) return [];
  const totalMinutes = weeklyHours * 60;
  const weights = subjects.map(s => {
    let w = (5 - s.confidence) * 1.2 + 1;
    if (s.difficulty === "hard") w += 1.5;
    else if (s.difficulty === "medium") w += 0.7;
    return { ...s, w };
  });
  const sumW = weights.reduce((a, b) => a + b.w, 0);
  return weights.map(s => {
    let mins = Math.round((s.w / sumW) * totalMinutes);
    mins = Math.max(
      30,
      Math.min(mins, totalMinutes - 30 * (weights.length - 1))
    );
    return { subject: s.name, weeklyMinutes: mins };
  });
}
