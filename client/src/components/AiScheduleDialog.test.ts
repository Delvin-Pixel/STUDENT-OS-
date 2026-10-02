import "@shared/sourceAssertions";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { validateReviewedScheduleApplication } from "./AiScheduleDialog";

const source = readFileSync(
  fileURLToPath(new URL("./AiScheduleDialog.tsx", import.meta.url)),
  "utf8"
);

const draft = {
  title: "Plan",
  instructions: "Review",
  sessions: [
    {
      date: "2026-08-24",
      startTime: "16:00",
      duration: 60,
      subject: "Physics",
      topic: "Waves",
      priority: "high" as const,
      reason: "Deadline",
      deadlineTitle: "Waves task",
    },
  ],
};

describe("AI schedule review and apply guard", () => {
  it("requires review and rejects invalid edited durations before canonical session creation", () => {
    expect(validateReviewedScheduleApplication(draft, {}, [], 120, [])).toMatch(
      /Review every/
    );
    expect(
      validateReviewedScheduleApplication(
        { ...draft, sessions: [{ ...draft.sessions[0], duration: 10 }] },
        { 0: true },
        [],
        120,
        []
      )
    ).toMatch(/15–180/);
  });
  it("rejects reviewed proposals that overlap an active planner session", () => {
    const existing = [
      {
        id: "s1",
        subject: "Maths",
        topic: "Algebra",
        date: "2026-08-24",
        startTime: "16:30",
        duration: 60,
        difficulty: "medium" as const,
        priority: "medium" as const,
        notes: "",
        status: "planned" as const,
      },
    ];
    expect(
      validateReviewedScheduleApplication(draft, { 0: true }, existing, 120, [])
    ).toMatch(/overlaps/);
  });
  it("includes active sessions in daily capacity and rechecks recurring timetable blocks after learner edits", () => {
    const existing = [
      {
        id: "s1",
        subject: "Maths",
        topic: "Algebra",
        date: "2026-08-24",
        startTime: "09:00",
        duration: 60,
        difficulty: "medium" as const,
        priority: "medium" as const,
        notes: "",
        status: "planned" as const,
      },
    ];
    expect(
      validateReviewedScheduleApplication(draft, { 0: true }, existing, 90, [])
    ).toMatch(/daily study capacity/);
    expect(
      validateReviewedScheduleApplication(draft, { 0: true }, [], 120, [
        { day: 0, startTime: "16:00", endTime: "17:00" },
      ])
    ).toMatch(/recurring timetable block/);
  });
  it("claims one reviewed proposal before creating sessions and resets only for a fresh draft", () => {
    expect(source).toContainSource("const applyClaimRef = useRef(false);");
    expect(source).toContainSource(
      "applyClaimRef.current = false; setDraft(value);"
    );
    expect(source).toContainSource("if (applyClaimRef.current) return;");
    expect(source).toContainSource("applyClaimRef.current = true;");
    expect(source).toContainSource("setDraft(null); setReviewed({});");
  });
});
