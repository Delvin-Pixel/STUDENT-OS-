import { describe, expect, it } from "vitest";
import {
  hasActiveSessionOverlap,
  hasRecurringTimetableOverlap,
  hasTimetableEventOverlap,
} from "./sessionScheduling";
import type { StudySession } from "./types";

const session: StudySession = {
  id: "existing",
  subject: "Maths",
  topic: "Algebra",
  date: "2026-08-23",
  startTime: "18:00",
  duration: 45,
  difficulty: "medium",
  priority: "medium",
  notes: "",
  status: "planned",
};

describe("active study session scheduling", () => {
  it("rejects intersecting intervals but permits adjacent blocks", () => {
    expect(
      hasActiveSessionOverlap([session], {
        date: "2026-08-23",
        startTime: "18:30",
        duration: 30,
      })
    ).toBe(true);
    expect(
      hasActiveSessionOverlap([session], {
        date: "2026-08-23",
        startTime: "18:45",
        duration: 30,
      })
    ).toBe(false);
  });

  it("ignores terminal sessions and the session being edited", () => {
    const completed = {
      ...session,
      id: "completed",
      status: "completed" as const,
    };
    expect(
      hasActiveSessionOverlap([completed], {
        date: "2026-08-23",
        startTime: "18:00",
        duration: 30,
      })
    ).toBe(false);
    expect(
      hasActiveSessionOverlap(
        [session],
        { date: "2026-08-23", startTime: "18:00", duration: 45 },
        "existing"
      )
    ).toBe(false);
  });

  it("detects recurring timetable blocks on the proposed local weekday", () => {
    const events = [
      {
        id: "class",
        title: "Physics",
        subject: "Physics",
        day: 0,
        startTime: "18:00",
        endTime: "19:00",
        type: "class" as const,
        location: "",
        notes: "",
      },
    ];
    expect(
      hasRecurringTimetableOverlap(events, {
        date: "2026-08-24",
        startTime: "18:30",
        duration: 30,
      })
    ).toBe(true);
    expect(
      hasRecurringTimetableOverlap(events, {
        date: "2026-08-24",
        startTime: "19:00",
        duration: 30,
      })
    ).toBe(false);
  });

  it("rejects intersecting recurring event edits while permitting adjacent blocks and the event being edited", () => {
    const events = [
      {
        id: "class",
        title: "Physics",
        subject: "Physics",
        day: 0,
        startTime: "18:00",
        endTime: "19:00",
        type: "class" as const,
        location: "",
        notes: "",
      },
    ];
    expect(
      hasTimetableEventOverlap(events, {
        day: 0,
        startTime: "18:30",
        endTime: "19:30",
      })
    ).toBe(true);
    expect(
      hasTimetableEventOverlap(events, {
        day: 0,
        startTime: "19:00",
        endTime: "19:30",
      })
    ).toBe(false);
    expect(
      hasTimetableEventOverlap(events, {
        day: 1,
        startTime: "18:30",
        endTime: "19:30",
      })
    ).toBe(false);
    expect(
      hasTimetableEventOverlap(
        events,
        { day: 0, startTime: "18:00", endTime: "19:00" },
        "class"
      )
    ).toBe(false);
  });
});
