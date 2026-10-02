import { describe, expect, it } from "vitest";
import { validateNewGoal } from "./goalValidation";

const validGoal = {
  name: "Study Physics",
  category: "study" as const,
  target: 10,
  current: 0,
  unit: "hours",
  deadline: "",
};

describe("goal validation", () => {
  it("accepts an intentionally empty optional deadline as the canonical workspace string", () => {
    expect(validateNewGoal(validGoal)).toBeNull();
  });

  it("rejects malformed or impossible deadlines and invalid bounded values before mutation", () => {
    expect(validateNewGoal({ ...validGoal, deadline: "2026-02-29" })).toContain(
      "deadline"
    );
    expect(validateNewGoal({ ...validGoal, deadline: "not-a-date" })).toContain(
      "deadline"
    );
    expect(
      validateNewGoal({ ...validGoal, target: Number.POSITIVE_INFINITY })
    ).toContain("target");
  });
});
