import { isValidLocalIsoDate } from "./calendarValidation";

export function normalizeFocusSessionInput(input: {
  subject: string;
  duration: number;
  date: string;
  objective?: string;
}) {
  return {
    ...input,
    subject: input.subject.trim(),
    objective: input.objective?.trim(),
  };
}

/** Mirrors canonical focus-session bounds before an optimistic local record and reward. */
export function validateFocusSessionInput(input: {
  subject: string;
  duration: number;
  date: string;
  objective?: string;
}): string | null {
  if (input.subject.trim().length > 1_000)
    return "Keep the Focus subject to 1,000 characters or fewer.";
  if (
    !Number.isInteger(input.duration) ||
    input.duration < 1 ||
    input.duration > 1_440
  )
    return "Record a Focus duration between 1 minute and 24 hours.";
  if (!isValidLocalIsoDate(input.date))
    return "Focus work needs a valid local calendar date.";
  if (input.objective?.trim().length && input.objective.trim().length > 1_000)
    return "Keep the Focus objective to 1,000 characters or fewer.";
  return null;
}
