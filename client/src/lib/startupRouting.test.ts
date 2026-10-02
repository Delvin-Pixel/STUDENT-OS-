import { describe, expect, it } from "vitest";
import { getStartupView } from "./startupRouting";
import { emptyState } from "./storage";

describe("device-local startup routing", () => {
  it("opens essential profile setup immediately on a new device", () => {
    expect(getStartupView(emptyState(), true)).toBe("onboarding");
  });

  it("returns a completed device directly to its saved workspace", () => {
    const returningState = emptyState();
    returningState.profile = {
      name: "Alex",
      age: 16,
      studentType: "Secondary School",
      educationLevel: "Secondary",
      goals: ["Improve grades"],
      subjects: ["Mathematics"],
      hoursPerDay: "1 hour",
    };

    expect(getStartupView(returningState, true)).toBe("workspace");
  });

  it("waits only while local state is unavailable", () => {
    expect(getStartupView(emptyState(), false)).toBe("loading");
  });
});
