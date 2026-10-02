import { describe, expect, it } from "vitest";
import { normalizeNewTask, validateNewTask } from "./taskValidation";

const validTask = {
  title: "Revise algebra",
  description: "",
  subject: "Maths",
  dueDate: "",
  priority: "medium" as const,
  status: "todo" as const,
};

describe("taskValidation", () => {
  it("normalizes and accepts a bounded task", () => {
    expect(
      validateNewTask(
        normalizeNewTask({ ...validTask, title: " Revise algebra " })
      )
    ).toBeNull();
  });
  it("rejects malformed or over-bounded task fields", () => {
    expect(
      validateNewTask(normalizeNewTask({ ...validTask, title: " " }))
    ).toContain("title");
    expect(
      validateNewTask(normalizeNewTask({ ...validTask, dueDate: "tomorrow" }))
    ).toContain("valid due date");
    expect(
      validateNewTask(normalizeNewTask({ ...validTask, dueDate: "2026-02-30" }))
    ).toContain("valid due date");
    expect(
      validateNewTask(
        normalizeNewTask({ ...validTask, deferredUntil: "2026-04-31" })
      )
    ).toContain("valid deferred date");
    expect(
      validateNewTask(
        normalizeNewTask({ ...validTask, estimatedMinutes: 1_441 })
      )
    ).toContain("estimates");
    expect(
      validateNewTask(
        normalizeNewTask({ ...validTask, description: "x".repeat(20_001) })
      )
    ).toContain("limits");
    expect(
      validateNewTask(
        normalizeNewTask({ ...validTask, recoveryReason: "x".repeat(1_001) })
      )
    ).toContain("Recovery reasons");
  });
});
