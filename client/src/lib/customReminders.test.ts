import { describe, expect, it } from "vitest";
import {
  areSameCustomReminder,
  normalizeCustomReminder,
} from "./customReminders";

describe("custom reminder validation", () => {
  const valid = {
    title: " Review notes ",
    message: " Pick one concept to recall. ",
    time: "18:00",
    date: "2026-08-22",
    repeat: "once" as const,
    enabled: true,
  };

  it("normalizes valid one-time and daily reminders", () => {
    expect(normalizeCustomReminder(valid)).toEqual({
      ...valid,
      title: "Review notes",
      message: "Pick one concept to recall.",
    });
    expect(
      normalizeCustomReminder({ ...valid, repeat: "daily", date: "2026-02-30" })
    ).toEqual({
      ...valid,
      title: "Review notes",
      message: "Pick one concept to recall.",
      repeat: "daily",
      date: "",
    });
  });

  it("rejects blank content, impossible dates, and malformed times", () => {
    expect(normalizeCustomReminder({ ...valid, title: "   " })).toBeNull();
    expect(
      normalizeCustomReminder({ ...valid, date: "2026-02-30" })
    ).toBeNull();
    expect(normalizeCustomReminder({ ...valid, time: "29:99" })).toBeNull();
  });

  it("recognizes an identical schedule after normalization", () => {
    const normalized = normalizeCustomReminder(valid)!;
    expect(
      areSameCustomReminder(normalized, { ...normalized, enabled: false })
    ).toBe(true);
    expect(
      areSameCustomReminder(normalized, { ...normalized, time: "18:30" })
    ).toBe(false);
  });
});
