import { describe, expect, it } from "vitest";
import {
  buildQuickAddSessionDraft,
  QUICK_ADD_SESSION_STATUS,
  validQuickAddExpenseAmount,
  validQuickAddSessionDraft,
} from "./quickAddContracts";
import { parseQuickAdd } from "./quickAddParse";

describe("Quick Add confirmation contracts", () => {
  it("retains the parsed local date and creates only planned session drafts", () => {
    const parsed = parseQuickAdd("Physics waves tomorrow 45 min", ["Physics"]);
    const draft = buildQuickAddSessionDraft(
      "Physics waves tomorrow 45 min",
      parsed,
      ["Physics"],
      "2026-08-22"
    );
    expect(draft).toMatchObject({
      title: "waves",
      subject: "Physics",
      date: parsed.date,
      duration: 45,
    });
    expect(QUICK_ADD_SESSION_STATUS).toBe("planned");
    expect(validQuickAddSessionDraft(draft)).toBeNull();
  });

  it("rejects empty or misleading session fields and zero/negative/unsafe expense amounts", () => {
    expect(
      validQuickAddSessionDraft({
        title: "",
        subject: "Physics",
        date: "2026-08-22",
        duration: 30,
      })
    ).toContain("topic");
    expect(
      validQuickAddSessionDraft({
        title: "Waves",
        subject: "Physics",
        date: "not-a-date",
        duration: 30,
      })
    ).toContain("date");
    expect(
      validQuickAddSessionDraft({
        title: "Waves",
        subject: "Physics",
        date: "2026-08-22",
        duration: 481,
      })
    ).toContain("duration");
    expect(validQuickAddExpenseAmount(0)).toBe(false);
    expect(validQuickAddExpenseAmount(-2)).toBe(false);
    expect(validQuickAddExpenseAmount(4.5)).toBe(true);
  });
});
