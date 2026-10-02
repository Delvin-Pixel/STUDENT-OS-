import { describe, expect, it } from "vitest";

function clampGoalProgress(current: number, target: number, by: number) {
  return Math.max(0, Math.min(target, current + by));
}

describe("goal progress bounds", () => {
  it("clamps repeated decrement and increment values to the canonical range", () => {
    expect(clampGoalProgress(0, 10, -1)).toBe(0);
    expect(clampGoalProgress(9, 10, 5)).toBe(10);
    expect(clampGoalProgress(5, 10, -3)).toBe(2);
  });
});
