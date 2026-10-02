import type { TimetableEvent } from "./types";

const isLocalTime = (value: string) => {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  return Boolean(match && Number(match[1]) <= 23 && Number(match[2]) <= 59);
};

const minutes = (value: string) =>
  Number(value.slice(0, 2)) * 60 + Number(value.slice(3));

export type TimetableEventDraft = Omit<TimetableEvent, "id">;

export function normalizeTimetableEventDraft(
  event: TimetableEventDraft
): TimetableEventDraft {
  return {
    ...event,
    title: event.title.trim(),
    subject: event.subject.trim(),
    location: event.location.trim(),
    notes: event.notes.trim(),
  };
}

export function validateTimetableEventDraft(
  event: TimetableEventDraft
): string | null {
  if (
    !event.title ||
    event.title.length > 120 ||
    !event.subject ||
    event.subject.length > 120 ||
    !event.location ||
    event.location.length > 120 ||
    event.notes.length > 20_000
  )
    return "Event details exceed the workspace limits.";
  if (!Number.isInteger(event.day) || event.day < 0 || event.day > 6)
    return "Choose a valid day of the week.";
  if (
    !isLocalTime(event.startTime) ||
    !isLocalTime(event.endTime) ||
    minutes(event.endTime) <= minutes(event.startTime)
  )
    return "Choose a valid event time range.";
  if (!["class", "study", "exam", "personal"].includes(event.type))
    return "Choose a valid event type.";
  return null;
}
