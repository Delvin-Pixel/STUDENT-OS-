import { describe, expect, it } from "vitest";
import { deadlineRiskWarnings } from "./scheduleRisk";
describe("deadline capacity warnings", () => {
  it("flags deadlines whose estimated work cannot fit selected capacity and preferred hours", () => {
    expect(
      deadlineRiskWarnings(
        [{ title: "Essay", dueDate: "2026-08-24", estimatedMinutes: 180 }],
        "2026-08-23",
        120,
        60
      )
    ).toMatchObject([{ title: "Essay", availableMinutes: 120, atRisk: true }]);
  });
  it("does not warn when time can fit", () =>
    expect(
      deadlineRiskWarnings(
        [{ title: "Quiz", dueDate: "2026-08-24", estimatedMinutes: 90 }],
        "2026-08-23",
        120,
        60
      )
    ).toEqual([]));
  it("subtracts active planned study time before reporting deadline availability", () => {
    expect(
      deadlineRiskWarnings(
        [{ title: "Quiz", dueDate: "2026-08-24", estimatedMinutes: 30 }],
        "2026-08-23",
        120,
        60,
        [
          { date: "2026-08-23", duration: 60 },
          { date: "2026-08-24", duration: 60 },
        ]
      )
    ).toMatchObject([{ title: "Quiz", availableMinutes: 0, atRisk: true }]);
  });
  it("flags the later deadline when individually feasible work exceeds shared cumulative capacity", () => {
    expect(
      deadlineRiskWarnings(
        [
          { title: "Reading", dueDate: "2026-08-24", estimatedMinutes: 60 },
          { title: "Quiz", dueDate: "2026-08-24", estimatedMinutes: 60 },
        ],
        "2026-08-24",
        60,
        60
      )
    ).toMatchObject([
      {
        title: "Quiz",
        availableMinutes: 60,
        requiredMinutesThroughDeadline: 120,
        atRisk: true,
      },
    ]);
  });
});
