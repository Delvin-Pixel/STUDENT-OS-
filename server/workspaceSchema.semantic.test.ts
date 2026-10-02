import { describe, expect, it } from "vitest";
import { emptyState } from "../client/src/lib/storage";
import { validateStudyStateSemantics } from "../shared/workspaceSchema";

describe("workspace semantic validation", () => {
  it("accepts a coherent empty workspace", () => {
    expect(validateStudyStateSemantics(emptyState()).success).toBe(true);
  });

  it("rejects invalid dates and broken task references", () => {
    const state = emptyState();
    state.tasks.push({
      id: "task-1",
      title: "Task",
      description: "",
      subject: "Maths",
      dueDate: "2026-02-30",
      priority: "medium",
      status: "todo",
      createdAt: "2026-08-27",
      topicId: "missing",
    });
    const result = validateStudyStateSemantics(state);
    expect(result.success).toBe(false);
    expect(result.success ? "" : result.reason).toContain("task task-1");
  });

  it("rejects duplicate identifiers before merge or cloud persistence", () => {
    const state = emptyState();
    state.goals.push({
      id: "goal-1",
      name: "Goal",
      target: 10,
      current: 0,
      unit: "minutes",
      deadline: "",
      category: "study",
      completed: false,
    });
    state.goals.push({
      id: "goal-1",
      name: "Duplicate",
      target: 10,
      current: 0,
      unit: "minutes",
      deadline: "",
      category: "study",
      completed: false,
    });
    const result = validateStudyStateSemantics(state);
    expect(result.success).toBe(false);
    expect(result.success ? "" : result.reason).toBe(
      "workspace contains duplicate record identifiers"
    );
  });
});
