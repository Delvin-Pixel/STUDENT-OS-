import { describe, expect, it } from "vitest";
import {
  normalizeTimetableEventDraft,
  validateTimetableEventDraft,
} from "./timetableEventValidation";

const valid = {
  title: " Physics class ",
  subject: " Physics ",
  day: 1,
  startTime: "09:00",
  endTime: "10:00",
  type: "class" as const,
  location: " Hall ",
  notes: " Review ",
};

describe("timetable event validation", () => {
  it("normalizes bounded canonical event fields", () => {
    expect(normalizeTimetableEventDraft(valid)).toMatchObject({
      title: "Physics class",
      subject: "Physics",
      location: "Hall",
      notes: "Review",
    });
  });
  it("rejects malformed calendar, time, type, and bounded fields", () => {
    expect(validateTimetableEventDraft({ ...valid, day: 7 })).toContain("day");
    expect(
      validateTimetableEventDraft({ ...valid, endTime: "09:00" })
    ).toContain("time");
    expect(
      validateTimetableEventDraft({ ...valid, type: "other" as "class" })
    ).toContain("type");
    expect(
      validateTimetableEventDraft({ ...valid, title: "x".repeat(121) })
    ).toContain("limits");
  });
});
