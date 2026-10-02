import type { CustomReminder } from "./types";

export type CustomReminderDraft = Omit<CustomReminder, "id" | "createdAt">;

function isLocalCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day, 12);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

/** Normalizes user input and rejects malformed schedules before persistence. */
export function normalizeCustomReminder(
  draft: CustomReminderDraft
): CustomReminderDraft | null {
  const title = draft.title.trim().slice(0, 70);
  const message = draft.message.trim().slice(0, 180);
  const time = draft.time.trim();
  const repeat = draft.repeat;
  const date = repeat === "daily" ? "" : draft.date.trim();
  const validTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(time);

  if (
    !title ||
    !message ||
    !validTime ||
    (repeat !== "daily" && repeat !== "once") ||
    (repeat === "once" && !isLocalCalendarDate(date))
  ) {
    return null;
  }

  return {
    title,
    message,
    time,
    date,
    repeat,
    enabled: Boolean(draft.enabled),
  };
}

/** Exact duplicates would deliver identical alerts, so they are not stored twice. */
export function areSameCustomReminder(
  a: CustomReminderDraft,
  b: CustomReminderDraft
) {
  return (
    a.title === b.title &&
    a.message === b.message &&
    a.time === b.time &&
    a.date === b.date &&
    a.repeat === b.repeat
  );
}
