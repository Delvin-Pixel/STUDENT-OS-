import { describe, expect, it } from "vitest";
import {
  getIncompleteTaskDependencies,
  getRemainingTaskMinutes,
  getTaskProgress,
  getTaskRecoveryKind,
  recordTaskWork,
  wouldCreateTaskDependencyCycle,
} from "./taskExecution";
import type { Task } from "./types";

const task = (patch: Partial<Task> = {}): Task => ({
  id: "task-a",
  title: "Lab report",
  description: "",
  subject: "Science",
  dueDate: "2026-08-20",
  priority: "high",
  status: "todo",
  createdAt: "2026-08-01",
  ...patch,
});

describe("canonical task execution helpers", () => {
  it("uses the highest explicit or checklist-derived progress without treating effort as completion", () => {
    const current = task({
      estimatedMinutes: 60,
      progressPercent: 20,
      subtasks: [
        { id: "s1", title: "Research", completed: true },
        { id: "s2", title: "Write", completed: false },
      ],
    });
    expect(getTaskProgress(current)).toBe(50);
    expect(recordTaskWork(current, 60, "2026-08-23T10:00:00Z")).toMatchObject({
      actualMinutes: 60,
      progressPercent: 99,
      status: "in_progress",
    });
  });

  it("identifies blocked, deferred, partial, and overdue recovery states deterministically", () => {
    const prerequisite = task({
      id: "task-prerequisite",
      status: "todo",
      dueDate: "",
    });
    expect(
      getIncompleteTaskDependencies(
        task({ dependsOnTaskIds: [prerequisite.id] }),
        [prerequisite]
      )
    ).toEqual([prerequisite]);
    expect(
      getTaskRecoveryKind(
        task({ dependsOnTaskIds: [prerequisite.id] }),
        [prerequisite],
        "2026-08-23"
      )
    ).toBe("blocked");
    expect(
      getTaskRecoveryKind(
        task({ deferredUntil: "2026-08-25" }),
        [],
        "2026-08-23"
      )
    ).toBe("deferred");
    expect(
      getTaskRecoveryKind(
        task({ dueDate: "", progressPercent: 25, status: "in_progress" }),
        [],
        "2026-08-23"
      )
    ).toBe("partial");
    expect(getTaskRecoveryKind(task(), [], "2026-08-23")).toBe("overdue");
  });

  it("reports capacity from learner estimates minus confirmed work", () => {
    expect(
      getRemainingTaskMinutes(task({ estimatedMinutes: 90, actualMinutes: 25 }))
    ).toBe(65);
    expect(
      getRemainingTaskMinutes(task({ estimatedMinutes: 30, actualMinutes: 80 }))
    ).toBe(0);
  });

  it("rejects direct and indirect dependency cycles while allowing an acyclic prerequisite", () => {
    const taskA = task({ id: "task-a", dependsOnTaskIds: ["task-b"] });
    const taskB = task({ id: "task-b", dependsOnTaskIds: ["task-c"] });
    const taskC = task({ id: "task-c" });
    expect(
      wouldCreateTaskDependencyCycle(
        "task-b",
        ["task-a"],
        [taskA, taskB, taskC]
      )
    ).toBe(true);
    expect(
      wouldCreateTaskDependencyCycle(
        "task-c",
        ["task-c"],
        [taskA, taskB, taskC]
      )
    ).toBe(true);
    expect(
      wouldCreateTaskDependencyCycle(
        "task-c",
        ["task-a"],
        [taskA, taskB, taskC]
      )
    ).toBe(true);
    expect(
      wouldCreateTaskDependencyCycle(
        "task-a",
        ["task-c"],
        [taskA, taskB, taskC]
      )
    ).toBe(false);
  });
});
