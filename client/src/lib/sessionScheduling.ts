import type { StudySession, TimetableEvent } from "./types";

const ACTIVE_STATUSES: StudySession["status"][] = [
  "planned",
  "in_progress",
  "paused",
];

function toMinutes(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours <= 23 && minutes <= 59 ? hours * 60 + minutes : null;
}

function weekday(date: string) {
  return (new Date(`${date}T12:00:00`).getDay() + 6) % 7;
}

/** True when the proposed active interval overlaps an existing active interval on the same local date. */
export function hasActiveSessionOverlap(
  sessions: StudySession[],
  proposed: Pick<StudySession, "date" | "startTime" | "duration">,
  excludeId?: string
) {
  const start = toMinutes(proposed.startTime);
  if (start === null || !/^\d{4}-\d{2}-\d{2}$/.test(proposed.date)) return true;
  const end = start + proposed.duration;
  return sessions.some(session => {
    if (
      session.id === excludeId ||
      session.date !== proposed.date ||
      !ACTIVE_STATUSES.includes(session.status)
    )
      return false;
    const existingStart = toMinutes(session.startTime);
    if (existingStart === null) return false;
    return start < existingStart + session.duration && end > existingStart;
  });
}

/** True when a dated study interval overlaps a recurring timetable block on that local weekday. */
export function hasRecurringTimetableOverlap(
  events: TimetableEvent[],
  proposed: Pick<StudySession, "date" | "startTime" | "duration">
) {
  const start = toMinutes(proposed.startTime);
  if (start === null || !/^\d{4}-\d{2}-\d{2}$/.test(proposed.date)) return true;
  return events.some(event => {
    if (event.day !== weekday(proposed.date)) return false;
    const eventStart = toMinutes(event.startTime);
    const eventEnd = toMinutes(event.endTime);
    if (eventStart === null || eventEnd === null || eventEnd <= eventStart)
      return false;
    return start < eventEnd && eventStart < start + proposed.duration;
  });
}

/** True when a proposed recurring timetable block intersects a weekly block on the same weekday. */
export function hasTimetableEventOverlap(
  events: TimetableEvent[],
  proposed: Pick<TimetableEvent, "day" | "startTime" | "endTime">,
  excludeId?: string
) {
  const start = toMinutes(proposed.startTime);
  const end = toMinutes(proposed.endTime);
  if (
    start === null ||
    end === null ||
    end <= start ||
    proposed.day < 0 ||
    proposed.day > 6
  )
    return true;
  return events.some(event => {
    if (event.id === excludeId || event.day !== proposed.day) return false;
    const eventStart = toMinutes(event.startTime);
    const eventEnd = toMinutes(event.endTime);
    if (eventStart === null || eventEnd === null || eventEnd <= eventStart)
      return false;
    return start < eventEnd && eventStart < end;
  });
}
