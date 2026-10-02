import { describe, expect, it } from "vitest";
import { phoneTestErrorMessage } from "./pushTestErrors";

describe("phoneTestErrorMessage", () => {
  it("replaces raw browser fetch errors with an actionable reminder setup step", () => {
    expect(phoneTestErrorMessage(new Error("Failed to fetch"))).toContain(
      "turn phone reminders off and on again"
    );
  });

  it("keeps a specific server-side registration message", () => {
    expect(
      phoneTestErrorMessage(
        new Error("This phone is not registered for Student OS reminders.")
      )
    ).toBe("This phone is not registered for Student OS reminders.");
  });
});
