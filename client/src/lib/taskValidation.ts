import { isValidLocalIsoDate } from "./calendarValidation";
import type { Task } from "./types";

export type NewTask = Omit<Task, "id" | "createdAt">;

export function normalizeNewTask(task: NewTask): NewTask {
  return {
    ...task,
    title: task.title.trim(),
    description: task.description.trim(),
    subject: task.subject.trim(),
    dueDate: task.dueDate.trim(),
    topicId: task.topicId?.trim() || undefined,
    estimatedMinutes:
      task.estimatedMinutes === undefined
        ? undefined
        : Math.round(task.estimatedMinutes),
    actualMinutes:
      task.actualMinutes === undefined
        ? undefined
        : Math.round(task.actualMinutes),
    progressPercent:
      task.progressPercent === undefined
        ? undefined
        : Math.round(task.progressPercent),
    subtasks: task.subtasks?.map(subtask => ({
      ...subtask,
      title: subtask.title.trim(),
    })),
    dependsOnTaskIds: task.dependsOnTaskIds?.map(id => id.trim()),
    deferredUntil: task.deferredUntil?.trim() || undefined,
    recoveryReason: task.recoveryReason?.trim() || undefined,
    sourceRef: task.sourceRef?.trim() || undefined,
  };
}

export function validateNewTask(task: NewTask): string | null {
  if (!task.title || task.title.length > 1_000)
    return "Give the task a title of up to 1,000 characters.";
  if (task.description.length > 20_000 || task.subject.length > 1_000)
    return "Task details exceed the workspace limits.";
  if (task.dueDate && !isValidLocalIsoDate(task.dueDate))
    return "Choose a valid due date.";
  if (task.deferredUntil && !isValidLocalIsoDate(task.deferredUntil))
    return "Choose a valid deferred date.";
  if (!["low", "medium", "high"].includes(task.priority))
    return "Choose a valid task priority.";
  if (!["todo", "in_progress", "completed"].includes(task.status))
    return "Choose a valid task status.";
  if (
    task.estimatedMinutes !== undefined &&
    (!Number.isInteger(task.estimatedMinutes) ||
      task.estimatedMinutes < 1 ||
      task.estimatedMinutes > 1_440)
  )
    return "Work estimates must be between 1 and 1,440 minutes.";
  if (
    task.actualMinutes !== undefined &&
    (!Number.isInteger(task.actualMinutes) ||
      task.actualMinutes < 0 ||
      task.actualMinutes > 100_000)
  )
    return "Recorded work must stay within the workspace limit.";
  if (
    task.progressPercent !== undefined &&
    (!Number.isInteger(task.progressPercent) ||
      task.progressPercent < 0 ||
      task.progressPercent > 100)
  )
    return "Progress must be between 0 and 100 percent.";
  if (
    task.subtasks &&
    (task.subtasks.length > 100 ||
      task.subtasks.some(
        subtask =>
          !subtask.id ||
          !subtask.title ||
          subtask.title.length > 1_000 ||
          typeof subtask.completed !== "boolean"
      ))
  )
    return "Task steps must be valid and stay within the workspace limit.";
  if (
    task.topicId !== undefined &&
    (!task.topicId || task.topicId.length > 160)
  )
    return "Task topic links must be valid.";
  if (task.recoveryReason !== undefined && task.recoveryReason.length > 1_000)
    return "Recovery reasons must stay within the workspace limit.";
  if (
    task.dependsOnTaskIds &&
    (task.dependsOnTaskIds.length > 100 ||
      task.dependsOnTaskIds.some(id => !id || id.length > 160))
  )
    return "Task dependencies must be valid and stay within the workspace limit.";
  if (task.completedAt !== undefined && task.completedAt.length > 64)
    return "Task completion timestamps are invalid.";
  if (task.xpAwardedAt !== undefined && task.xpAwardedAt.length > 64)
    return "Task reward timestamps are invalid.";
  if (task.lastWorkedAt !== undefined && task.lastWorkedAt.length > 64)
    return "Task work timestamps are invalid.";
  if (
    task.origin !== undefined &&
    !["manual", "transition", "system"].includes(task.origin)
  )
    return "Task origin is invalid.";
  if (
    task.sourceRef !== undefined &&
    (!task.sourceRef || task.sourceRef.length > 160)
  )
    return "Task source references must be valid.";
  return null;
}
