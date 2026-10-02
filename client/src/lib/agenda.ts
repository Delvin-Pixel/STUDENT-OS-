import type { TimetableEvent } from "./types";

export const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export function weekdayIndex(date = new Date()) {
  return (date.getDay() + 6) % 7;
}

export function shiftWeekday(day: number, delta: -1 | 1) {
  return (day + delta + WEEKDAYS.length) % WEEKDAYS.length;
}

export function agendaEventsForDay(events: TimetableEvent[], day: number) {
  return events
    .filter(event => event.day === day)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
}

export type CalendarDay = { date: Date; inMonth: boolean };

export function buildCalendarMonth(anchor: Date): CalendarDay[] {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const first = new Date(year, month, 1);
  const gridStart = new Date(year, month, 1 - weekdayIndex(first));
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(
      gridStart.getFullYear(),
      gridStart.getMonth(),
      gridStart.getDate() + index
    );
    return { date, inMonth: date.getMonth() === month };
  });
}

export function shiftMonth(anchor: Date, delta: -1 | 1) {
  return new Date(anchor.getFullYear(), anchor.getMonth() + delta, 1);
}

export function agendaEventsForDate(events: TimetableEvent[], date: Date) {
  return agendaEventsForDay(events, weekdayIndex(date));
}
