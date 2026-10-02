import { describe, expect, it } from "vitest";
import { dedupePlannedPushReminders } from "./pushDb";

describe("push reminder plan deduplication", () => {
  it("keeps one deterministic latest entry per device-level dedupe key before persistence", () => {
    const reminders = dedupePlannedPushReminders([
      {
        dedupeKey: "task-a",
        title: "Old",
        body: "Old",
        targetUrl: "/tasks",
        fireAt: new Date("2026-08-23T10:00:00Z"),
      },
      {
        dedupeKey: "task-a",
        title: "Latest",
        body: "Latest",
        targetUrl: "/tasks",
        fireAt: new Date("2026-08-23T11:00:00Z"),
      },
      {
        dedupeKey: "exam-b",
        title: "Exam",
        body: "Exam",
        targetUrl: "/exams",
        fireAt: new Date("2026-08-24T10:00:00Z"),
      },
    ]);
    expect(reminders).toHaveLength(2);
    expect(
      reminders.find(reminder => reminder.dedupeKey === "task-a")?.title
    ).toBe("Latest");
  });
});
