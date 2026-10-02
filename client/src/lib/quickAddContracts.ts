import type { NlpResult } from "./quickAddParse";

export const QUICK_ADD_SESSION_STATUS = "planned" as const;

export interface QuickAddSessionDraft {
  title: string;
  subject: string;
  date: string;
  duration: number;
}

export function buildQuickAddSessionDraft(
  raw: string,
  parsed: NlpResult,
  subjects: string[],
  localToday: string
): QuickAddSessionDraft {
  const subject =
    parsed.subject ??
    subjects.find(item => raw.toLowerCase().includes(item.toLowerCase())) ??
    subjects[0] ??
    "General";
  return {
    title: parsed.title || raw.trim(),
    subject,
    date: parsed.date ?? localToday,
    duration: parsed.minutes ?? 30,
  };
}

export function validQuickAddSessionDraft(draft: QuickAddSessionDraft) {
  if (!draft.title.trim()) return "Give the study session a topic.";
  if (!draft.subject.trim()) return "Choose a subject for this study session.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date))
    return "Choose a valid local calendar date.";
  if (
    !Number.isInteger(draft.duration) ||
    draft.duration < 5 ||
    draft.duration > 480
  )
    return "Choose a study duration from 5 minutes to 8 hours.";
  return null;
}

export function validQuickAddExpenseAmount(
  amount: number | undefined
): amount is number {
  return (
    typeof amount === "number" &&
    Number.isFinite(amount) &&
    amount > 0 &&
    amount <= 1_000_000
  );
}
