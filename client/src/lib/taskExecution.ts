import type { StudyState, Task } from "./types";

export type TaskRecoveryKind =
  "ready" | "partial" | "overdue" | "blocked" | "deferred";

const clampPercent = (value: number) =>
  Math.max(0, Math.min(100, Math.round(value)));

export function getTaskProgress(task: Task): number {
  if (task.status === "completed") return 100;
  const explicit = clampPercent(task.progressPercent ?? 0);
  const subtaskProgress = task.subtasks?.length
    ? clampPercent(
        (task.subtasks.filter(subtask => subtask.completed).length /
          task.subtasks.length) *
          100
      )
    : 0;
  return Math.max(explicit, subtaskProgress);
}

export function getRemainingTaskMinutes(task: Task): number {
  const estimated = task.estimatedMinutes ?? 30;
  return Math.max(0, estimated - (task.actualMinutes ?? 0));
}

export function getIncompleteTaskDependencies(
  task: Task,
  tasks: Task[]
): Task[] {
  const dependencyIds = new Set(task.dependsOnTaskIds ?? []);
  return tasks.filter(
    candidate =>
      dependencyIds.has(candidate.id) && candidate.status !== "completed"
  );
}

/** Returns true when replacing a task's prerequisites would create a dependency cycle. */
export function wouldCreateTaskDependencyCycle(
  taskId: string,
  dependencyIds: string[],
  tasks: Task[]
): boolean {
  const dependenciesByTaskId = new Map(
    tasks.map(task => [task.id, task.dependsOnTaskIds ?? []])
  );
  dependenciesByTaskId.set(taskId, dependencyIds);

  const reachesEditedTask = (
    candidateId: string,
    visited: Set<string>
  ): boolean => {
    if (candidateId === taskId) return true;
    if (visited.has(candidateId)) return false;
    visited.add(candidateId);
    return (dependenciesByTaskId.get(candidateId) ?? []).some(dependencyId =>
      reachesEditedTask(dependencyId, visited)
    );
  };

  return dependencyIds.some(dependencyId =>
    reachesEditedTask(dependencyId, new Set())
  );
}

export function getTaskRecoveryKind(
  task: Task,
  tasks: Task[],
  today: string
): TaskRecoveryKind | null {
  if (task.status === "completed") return null;
  if (task.deferredUntil && task.deferredUntil > today) return "deferred";
  if (getIncompleteTaskDependencies(task, tasks).length) return "blocked";
  if (task.dueDate && task.dueDate < today) return "overdue";
  if (task.status === "in_progress" || getTaskProgress(task) > 0)
    return "partial";
  return "ready";
}

export function getTaskRecoverySummary(state: StudyState, today: string) {
  const summary: Record<TaskRecoveryKind, Task[]> = {
    ready: [],
    partial: [],
    overdue: [],
    blocked: [],
    deferred: [],
  };
  state.tasks.forEach(task => {
    const kind = getTaskRecoveryKind(task, state.tasks, today);
    if (kind) summary[kind].push(task);
  });
  return summary;
}

/** Applies a bounded learner-confirmed work update without automatically claiming task or learning completion. */
export function recordTaskWork(
  task: Task,
  minutes: number,
  now: string,
  progressPercent?: number
): Task {
  const workedMinutes = Math.max(1, Math.min(1_440, Math.round(minutes)));
  const actualMinutes = Math.max(
    0,
    Math.min(100_000, (task.actualMinutes ?? 0) + workedMinutes)
  );
  const estimatedProgress = task.estimatedMinutes
    ? Math.floor((actualMinutes / task.estimatedMinutes) * 100)
    : getTaskProgress(task);
  // Time spent is evidence of effort, not proof that the task is complete.
  const nextProgress = Math.min(
    99,
    Math.max(
      getTaskProgress(task),
      progressPercent === undefined
        ? estimatedProgress
        : clampPercent(progressPercent)
    )
  );
  return {
    ...task,
    actualMinutes,
    progressPercent: nextProgress,
    status: task.status === "todo" ? "in_progress" : task.status,
    lastWorkedAt: now,
  };
}
