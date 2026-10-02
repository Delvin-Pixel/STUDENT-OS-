import { describe, expect, it } from "vitest";
import { isValidLocalIsoDate } from "./calendarValidation";
import { validateNewTransaction } from "./transactionValidation";

const validTransaction = {
  type: "expense" as const,
  amount: 4.5,
  category: "food" as const,
  label: "Lunch",
  date: "2026-08-24",
};

describe("transaction validation", () => {
  it("accepts a bounded, dated canonical transaction", () => {
    expect(validateNewTransaction(validTransaction)).toBeNull();
  });

  it("rejects empty, malformed, impossible, and non-finite transaction values before workspace mutation", () => {
    expect(
      validateNewTransaction({ ...validTransaction, label: "   " })
    ).toContain("name");
    expect(validateNewTransaction({ ...validTransaction, date: "" })).toContain(
      "calendar date"
    );
    expect(
      validateNewTransaction({ ...validTransaction, date: "2026-02-29" })
    ).toContain("calendar date");
    expect(
      validateNewTransaction({ ...validTransaction, amount: Number.NaN })
    ).toContain("amount");
    expect(isValidLocalIsoDate("2026-08-24")).toBe(true);
    expect(isValidLocalIsoDate("2026-13-01")).toBe(false);
  });
});
