import { describe, expect, it } from "vitest";
import { CURRENCIES, formatMoney } from "./currency";

describe("localized Student OS budget currency", () => {
  it("offers the supported local currency choices", () => {
    expect(CURRENCIES.map(currency => currency.code)).toEqual([
      "GHS",
      "NGN",
      "KES",
      "ZAR",
      "USD",
      "GBP",
      "EUR",
      "INR",
    ]);
  });

  it("formats amounts using the selected currency", () => {
    expect(formatMoney(1250.5, "GHS")).toContain("1,250.50");
    expect(formatMoney(1250.5, "USD")).toContain("1,250.50");
    expect(formatMoney(-12.5, "NGN")).toContain("12.50");
  });
});
