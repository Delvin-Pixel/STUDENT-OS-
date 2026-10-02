import { describe, expect, it } from "vitest";
import {
  agendaEventsForDate,
  agendaEventsForDay,
  buildCalendarMonth,
  shiftMonth,
  shiftWeekday,
  weekdayIndex,
} from "./agenda";

describe("timetable agenda navigation", () => {
  it("uses Monday as the first agenda day and cycles safely across week boundaries", () => {
    expect(weekdayIndex(new Date(2026, 7, 24))).toBe(0);
    expect(shiftWeekday(0, -1)).toBe(6);
    expect(shiftWeekday(6, 1)).toBe(0);
  });

  it("groups each day in start-time order", () => {
    const events = [
      {
        id: "later",
        title: "Later",
        subject: "",
        day: 2,
        startTime: "14:00",
        endTime: "15:00",
        type: "study" as const,
        location: "",
        notes: "",
      },
      {
        id: "early",
        title: "Early",
        subject: "",
        day: 2,
        startTime: "09:00",
        endTime: "10:00",
        type: "class" as const,
        location: "",
        notes: "",
      },
      {
        id: "other",
        title: "Other",
        subject: "",
        day: 3,
        startTime: "08:00",
        endTime: "09:00",
        type: "personal" as const,
        location: "",
        notes: "",
      },
    ];
    expect(agendaEventsForDay(events, 2).map(event => event.id)).toEqual([
      "early",
      "later",
    ]);
  });

  it("constructs a six-week month grid and maps recurring weekday events to every matching date", () => {
    const august = new Date(2026, 7, 1);
    const days = buildCalendarMonth(august);
    const event = {
      id: "tuesday",
      title: "Chemistry",
      subject: "",
      day: 1,
      startTime: "09:00",
      endTime: "10:00",
      type: "class" as const,
      location: "",
      notes: "",
    };
    expect(days).toHaveLength(42);
    expect(days[0].date.toDateString()).toBe(
      new Date(2026, 6, 27).toDateString()
    );
    expect(days.filter(day => day.inMonth)).toHaveLength(31);
    expect(agendaEventsForDate([event], new Date(2026, 7, 4))).toEqual([event]);
    expect(agendaEventsForDate([event], new Date(2026, 7, 5))).toEqual([]);
    expect(shiftMonth(august, -1).toDateString()).toBe(
      new Date(2026, 6, 1).toDateString()
    );
    expect(shiftMonth(august, 1).toDateString()).toBe(
      new Date(2026, 8, 1).toDateString()
    );
  });
});
