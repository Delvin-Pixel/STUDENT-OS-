import { describe, expect, it } from "vitest";
import {
  normalizeNewExam,
  validateNewExam,
  validateNewExamTopicName,
} from "./examValidation";

const validExam = {
  subject: "Chemistry",
  name: "Final",
  date: "2026-08-31",
  time: "09:30",
  location: "Hall B",
  notes: "Bring a calculator.",
};

describe("examValidation", () => {
  it("normalizes valid editable text and accepts a bounded canonical exam", () => {
    const normalized = normalizeNewExam({
      ...validExam,
      subject: " Chemistry ",
      name: " Final ",
    });
    expect(normalized.subject).toBe("Chemistry");
    expect(normalized.name).toBe("Final");
    expect(validateNewExam(normalized)).toBeNull();
  });

  it("rejects malformed dates, clock times, and schema-exceeding fields before a workspace write", () => {
    expect(validateNewExam({ ...validExam, date: "2026-02-30" })).toContain(
      "valid local calendar"
    );
    expect(validateNewExam({ ...validExam, time: "25:00" })).toContain(
      "valid exam time"
    );
    expect(
      validateNewExam({ ...validExam, subject: " ".repeat(501) })
    ).toContain("Choose a subject");
    expect(
      validateNewExam({ ...validExam, notes: "n".repeat(20_001) })
    ).toContain("20,000");
  });

  it("requires a bounded exam topic name", () => {
    expect(validateNewExamTopicName("")).toContain("Give the topic");
    expect(validateNewExamTopicName("t".repeat(1_001))).toContain("1,000");
    expect(validateNewExamTopicName("Atomic structure")).toBeNull();
  });
});
