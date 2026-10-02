import { describe, expect, it } from "vitest";
import { parseQuickAdd, QUICK_ADD_MAX_SESSION_MINUTES } from "./quickAddParse";

describe("Quick Add natural-language dates", () => {
  it.each(["12 Aug", "Aug 12", "12 August", "August 12"])(
    "recognizes %s",
    dateText => {
      const parsed = parseQuickAdd(`Revise physics ${dateText}`, ["Physics"]);
      expect(parsed.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(parsed.title.toLowerCase()).not.toContain(dateText.toLowerCase());
    }
  );

  it("recognizes today, tomorrow, and next Monday", () => {
    expect(parseQuickAdd("Read today", []).date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(parseQuickAdd("Read tomorrow", []).date).toMatch(
      /^\d{4}-\d{2}-\d{2}$/
    );
    const monday = parseQuickAdd("Read next Monday", []);
    expect(monday.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(monday.title.toLowerCase()).not.toContain("next");
  });

  it("does not convert impossible calendar dates into a different day", () => {
    expect(parseQuickAdd("Review 31 Feb", []).date).toBeUndefined();
  });

  it("rejects parsed study durations outside the explicitly supported planning range", () => {
    expect(parseQuickAdd("Physics revision 3 min", []).durationError).toContain(
      "5 minutes"
    );
    expect(
      parseQuickAdd("Physics revision 9 hours", []).durationError
    ).toContain("8 hours");
    expect(parseQuickAdd("Physics revision 90 min", []).minutes).toBe(90);
    expect(QUICK_ADD_MAX_SESSION_MINUTES).toBe(480);
  });
});
