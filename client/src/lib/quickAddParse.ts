/* STUDENT OS — natural language parsing for Quick Add.
   Turns free text like "math chapter 4 tomorrow 30 min high" into a parsed
   command: subject, duration, due date, and priority are extracted from
   recognizable tokens and patterns, leaving the clean remainder as the title. */

import { addDays, isoDate, todayStr } from "./utils";

export interface NlpResult {
  title: string;
  subject?: string;
  /** minutes for sessions, when detected (e.g. "30 min", "1h", "45m") */
  minutes?: number;
  /** Present when a duration token was recognized but is unsafe to schedule. */
  durationError?: string;
  /** ISO date (YYYY-MM-DD) for tasks/sessions due dates */
  date?: string;
  /** human label for the detected date, e.g. "tomorrow" */
  dateLabel?: string;
  priority?: "low" | "medium" | "high";
}

export const QUICK_ADD_MIN_SESSION_MINUTES = 5;
export const QUICK_ADD_MAX_SESSION_MINUTES = 8 * 60;

const DAY_OFFSETS: Record<string, number> = {
  today: 0,
  tomorrow: 1,
  tonight: 0,
  weekend: 5,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sunday: 7,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
  sun: 7,
};

const NEXT_WEEKDAY = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

/** Parse "mon/tuesday" into the NEXT occurrence of that weekday (min 1 day away). */
function weekdayOffset(name: string): number {
  const base = DAY_OFFSETS[name] ?? -1;
  if (base <= 0) return -1;
  const nowDow = new Date().getDay(); // 0=Sun … 6=Sat
  const target = base % 7; // 1=Mon … 0=Sun
  let off = target - nowDow;
  if (off <= 0) off += 7;
  return off;
}

export function parseQuickAdd(raw: string, subjects: string[]): NlpResult {
  const out: NlpResult = { title: raw };
  let text = " " + raw + " ";

  // ── priority ──
  const pm = text.match(/\s(high|urgent|low|easy)\s/i);
  if (pm) {
    const k = pm[1].toLowerCase();
    out.priority =
      k === "high" || k === "urgent"
        ? "high"
        : k === "low" || k === "easy"
          ? "low"
          : "medium";
    text = text.replace(pm[0], " ");
  }

  // ── duration ──
  const dm = text.match(
    /\s(\d+(?:\.\d+)?)\s*(min|mins|minutes|hour|hours|h)\b/i
  );
  if (dm) {
    let v = parseFloat(dm[1]);
    const unit = dm[2].toLowerCase();
    if (unit.startsWith("h")) v *= 60;
    const minutes = Math.round(v);
    if (
      minutes < QUICK_ADD_MIN_SESSION_MINUTES ||
      minutes > QUICK_ADD_MAX_SESSION_MINUTES
    ) {
      out.durationError = `Choose a study duration from ${QUICK_ADD_MIN_SESSION_MINUTES} minutes to ${QUICK_ADD_MAX_SESSION_MINUTES / 60} hours.`;
    } else {
      out.minutes = minutes;
    }
    text = text.replace(dm[0], " ");
  }

  // ── dates: "dd/mm", "mm/dd" (ambiguous: prefer day/month when day <= 12? use dd/mm), month names, weekday names, today/tomorrow ──
  // month-name date: "12 aug", "aug 12"
  const months = [
    "jan",
    "feb",
    "mar",
    "apr",
    "may",
    "jun",
    "jul",
    "aug",
    "sep",
    "oct",
    "nov",
    "dec",
  ];
  const monthIdx = (s: string) => months.indexOf(s.slice(0, 3).toLowerCase());
  const dayFirstMonth = text.match(
    /\s(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s/i
  );
  const monthFirstDay = text.match(
    /\s(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+(\d{1,2})\s/i
  );
  const mMonth = dayFirstMonth || monthFirstDay;
  if (mMonth) {
    const monthToken = dayFirstMonth ? dayFirstMonth[2] : monthFirstDay![1];
    const day = parseInt(
      dayFirstMonth ? dayFirstMonth[1] : monthFirstDay![2],
      10
    );
    const mo = monthIdx(monthToken) + 1;
    const now = new Date();
    const year = now.getFullYear();
    let candidate = new Date(year, mo - 1, day);
    if (candidate.getTime() < now.getTime() - 2 * 86400000)
      candidate = new Date(year + 1, mo - 1, day);
    if (
      day >= 1 &&
      day <= 31 &&
      mo &&
      candidate.getMonth() === mo - 1 &&
      candidate.getDate() === day
    ) {
      out.date = isoDate(candidate);
      out.dateLabel = `${day} ${monthToken}`;
      text = text.replace(mMonth[0], " ");
    }
  }

  // "dd/mm" or "dd.mm"
  if (!out.date) {
    const slash = text.match(/\s(\d{1,2})[/.](\d{1,2})\s/);
    if (slash) {
      const a = parseInt(slash[1], 10);
      const b = parseInt(slash[2], 10);
      const now = new Date();
      // month = second number; assume near future
      let candidate = new Date(now.getFullYear(), b - 1, a);
      if (candidate.getTime() < now.getTime() - 3 * 86400000)
        candidate = new Date(now.getFullYear() + 1, b - 1, a);
      if (
        a >= 1 &&
        a <= 31 &&
        b >= 1 &&
        b <= 12 &&
        candidate.getMonth() === b - 1 &&
        candidate.getDate() === a
      ) {
        out.date = isoDate(candidate);
        out.dateLabel = `${a}/${b}`;
        text = text.replace(slash[0], " ");
      }
    }
  }

  // weekday / today / tomorrow
  if (!out.date) {
    for (const token of NEXT_WEEKDAY) {
      const re = new RegExp(`\\b(?:next\\s+)?${token}(?:day)?\\b`, "i");
      const found = text.match(re);
      if (found) {
        const off = weekdayOffset(token);
        if (off > 0) {
          out.date = addDays(todayStr(), off);
          out.dateLabel = found[0];
          text = text.replace(found[0], " ");
          break;
        }
      }
    }
  }
  if (!out.date) {
    const rel = text.match(/\s(today|tomorrow|tonight)\b/i);
    if (rel) {
      const off = DAY_OFFSETS[rel[1].toLowerCase()] ?? 0;
      out.date = off === 0 ? todayStr() : addDays(todayStr(), off);
      out.dateLabel = rel[1];
      text = text.replace(rel[0], " ");
    }
  }

  // ── subject: match profile subjects (case-insensitive, first match wins) ──
  const lower = text.toLowerCase();
  for (const s of subjects) {
    const i = lower.indexOf(s.toLowerCase());
    if (i >= 0) {
      out.subject = s;
      text = text.slice(0, i) + text.slice(i + s.length);
      break;
    }
  }

  // ── title cleanup ──
  const title = text.replace(/\s{2,}/g, " ").trim();
  if (title) out.title = title;
  return out;
}

export function nlpSummary(r: NlpResult): string {
  const parts: string[] = [];
  if (r.subject) parts.push(r.subject);
  if (r.dateLabel) parts.push(`due ${r.dateLabel}`);
  if (r.minutes) parts.push(`${r.minutes} min`);
  if (r.priority && r.priority !== "medium")
    parts.push(`${r.priority} priority`);
  return parts.join(" · ");
}
