import { describe, expect, it } from "vitest";
import {
  normalizeFocusSessionInput,
  validateFocusSessionInput,
} from "./focusValidation";

describe("focusValidation", () => {
  it("normalizes a valid local Focus-session record", () => {
    const normalized = normalizeFocusSessionInput({
      subject: " Physics ",
      duration: 25,
      date: "2026-08-24",
      objective: " Revise waves ",
    });
    expect(normalized).toMatchObject({
      subject: "Physics",
      objective: "Revise waves",
    });
    expect(validateFocusSessionInput(normalized)).toBeNull();
  });

  it("rejects malformed duration, date, subject, and objective values", () => {
    expect(
      validateFocusSessionInput({
        subject: "Physics",
        duration: 0,
        date: "2026-08-24",
      })
    ).toContain("between 1 minute");
    expect(
      validateFocusSessionInput({
        subject: "Physics",
        duration: 25.5,
        date: "2026-08-24",
      })
    ).toContain("between 1 minute");
    expect(
      validateFocusSessionInput({
        subject: "Physics",
        duration: 25,
        date: "2026-02-30",
      })
    ).toContain("valid local calendar");
    expect(
      validateFocusSessionInput({
        subject: "s".repeat(1_001),
        duration: 25,
        date: "2026-08-24",
      })
    ).toContain("Focus subject");
    expect(
      validateFocusSessionInput({
        subject: "Physics",
        duration: 25,
        date: "2026-08-24",
        objective: "o".repeat(1_001),
      })
    ).toContain("Focus objective");
  });
});
