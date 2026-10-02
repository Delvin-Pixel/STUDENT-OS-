/* STUDENT OS — canonical task execution and recovery workspace. */

import { BrandedEmpty, PriorityChip, SubjectBadge } from "@/components/AppBits";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useStore } from "@/contexts/StoreContext";
import {
  getIncompleteTaskDependencies,
  getRemainingTaskMinutes,
  getTaskProgress,
  getTaskRecoveryKind,
  wouldCreateTaskDependencyCycle,
} from "@/lib/taskExecution";
import type { Priority, Task, TaskStatus, TaskSubtask } from "@/lib/types";
import { addDays, cn, formatDateHuman, todayStr, uid } from "@/lib/utils";
import {
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock3,
  Forward,
  Link2,
  ListChecks,
  Pencil,
  Timer as TimerIcon,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type StatusFilter = "all" | TaskStatus;

const priorityOrder = { high: 0, medium: 1, low: 2 };

export default function Tasks() {
  const {
    state,
    addTask,
    updateTask,
    deleteTask,
    completeTask,
    recordTaskWork,
    deferTask,
  } = useStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [sortBy, setSortBy] = useState<"due" | "priority">("due");

  const list = useMemo(() => {
    const tasks =
      filter === "all"
        ? [...state.tasks]
        : state.tasks.filter(task => task.status === filter);
    tasks.sort((a, b) => {
      if (a.status === "completed" && b.status !== "completed") return 1;
      if (b.status === "completed" && a.status !== "completed") return -1;
      if (sortBy === "priority")
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      return (
        (a.dueDate || "9999-12-31").localeCompare(b.dueDate || "9999-12-31") ||
        priorityOrder[a.priority] - priorityOrder[b.priority]
      );
    });
    return tasks;
  }, [state.tasks, filter, sortBy]);

  const todayCounts = useMemo(
    () =>
      state.tasks.filter(
        task => task.dueDate === todayStr() && task.status !== "completed"
      ).length,
    [state.tasks]
  );

  const saveTask = (data: Partial<Task>): boolean => {
    let accepted = false;
    if (editing) {
      const { status, ...patch } = data;
      if (status === "completed") accepted = completeTask(editing.id, patch);
      else
        accepted = updateTask(
          editing.id,
          status ? { ...patch, status } : patch
        );
    } else {
      accepted = addTask({
        title: data.title ?? "",
        description: data.description ?? "",
        subject: data.subject ?? "",
        dueDate: data.dueDate ?? "",
        priority: data.priority ?? "medium",
        status: data.status ?? "todo",
        topicId: data.topicId,
        estimatedMinutes: data.estimatedMinutes,
        progressPercent: data.progressPercent,
        subtasks: data.subtasks,
        dependsOnTaskIds: data.dependsOnTaskIds,
      });
    }
    if (!accepted) return false;
    setDialogOpen(false);
    setEditing(null);
    return true;
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">
            Tasks
          </h1>
          {todayCounts > 0 && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {todayCounts} due today
            </p>
          )}
        </div>
        <Button
          variant="sunrise"
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          + Add task
        </Button>
      </div>

      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Keep work recoverable: record real progress, defer consciously, and link
        important tasks to the topics or focus rounds that move them forward.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {(["all", "todo", "in_progress", "completed"] as StatusFilter[]).map(
          entry => (
            <button
              key={entry}
              onClick={() => setFilter(entry)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-xs font-medium capitalize transition-colors",
                filter === entry
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:bg-accent"
              )}
            >
              {entry.replace("_", " ")}
            </button>
          )
        )}
        <div className="flex-1" />
        <Select
          value={sortBy}
          onValueChange={value => setSortBy(value as "due" | "priority")}
        >
          <SelectTrigger className="h-8 w-32 rounded-full text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="due">Sort: Due date</SelectItem>
            <SelectItem value="priority">Sort: Priority</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mt-4 flex flex-col gap-2.5">
        {list.length === 0 ? (
          <BrandedEmpty
            icon={ListChecks}
            title="No tasks here"
            text={
              filter === "completed"
                ? "No completed tasks yet — check some off to see them here."
                : "You're all caught up! Add your first task."
            }
            coach={
              filter === "all"
                ? "Write down one thing — finishing it feels better than it sounds."
                : undefined
            }
            actionLabel={filter === "all" ? "+ Add Task" : undefined}
            onAction={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          />
        ) : (
          list.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              tasks={state.tasks}
              onEdit={() => {
                setEditing(task);
                setDialogOpen(true);
              }}
              onDelete={() => deleteTask(task.id)}
              onComplete={() => completeTask(task.id)}
              onStatus={status =>
                status === "completed"
                  ? completeTask(task.id)
                  : updateTask(task.id, { status })
              }
              onLog={() => recordTaskWork(task.id, 15)}
              onDefer={() =>
                deferTask(
                  task.id,
                  addDays(todayStr(), 1),
                  "Deferred from Tasks"
                )
              }
              onToggleSubtask={subtaskId =>
                updateTask(task.id, {
                  subtasks: (task.subtasks ?? []).map(subtask =>
                    subtask.id === subtaskId
                      ? { ...subtask, completed: !subtask.completed }
                      : subtask
                  ),
                })
              }
            />
          ))
        )}
      </div>

      <TaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        onSave={saveTask}
      />
    </div>
  );
}

function TaskCard({
  task,
  tasks,
  onEdit,
  onDelete,
  onComplete,
  onStatus,
  onLog,
  onDefer,
  onToggleSubtask,
}: {
  task: Task;
  tasks: Task[];
  onEdit: () => void;
  onDelete: () => void;
  onComplete: () => void;
  onStatus: (status: TaskStatus) => void;
  onLog: () => void;
  onDefer: () => void;
  onToggleSubtask: (subtaskId: string) => void;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border bg-card p-4 shadow-sm lift-card",
        task.status === "completed"
          ? "border-border/60 opacity-70"
          : "border-border"
      )}
    >
      <div className="flex items-start gap-3">
        <button
          onClick={onComplete}
          disabled={task.status === "completed"}
          aria-label={
            task.status === "completed" ? "Task completed" : "Mark complete"
          }
          className="mt-0.5 shrink-0 disabled:cursor-default"
        >
          {task.status === "completed" ? (
            <CheckCircle2 className="h-5.5 w-5.5 text-primary" />
          ) : task.status === "in_progress" ? (
            <TimerIcon className="h-5.5 w-5.5 text-amber-500" />
          ) : (
            <Circle className="h-5.5 w-5.5 text-muted-foreground/50" />
          )}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3
              className={cn(
                "text-sm font-semibold",
                task.status === "completed" &&
                  "text-muted-foreground line-through"
              )}
            >
              {task.title}
            </h3>
            <PriorityChip priority={task.priority} />
          </div>
          {task.description && (
            <p className="mt-1 text-xs text-muted-foreground">
              {task.description}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {task.subject && <SubjectBadge subject={task.subject} />}
            {task.dueDate && (
              <span
                className={cn(
                  "inline-flex items-center gap-1",
                  task.dueDate < todayStr() &&
                    task.status !== "completed" &&
                    "text-destructive"
                )}
              >
                <CalendarDays className="h-3 w-3" />
                {formatDateHuman(task.dueDate)}
              </span>
            )}
          </div>
          {task.status !== "completed" && (
            <TaskRecoveryDetails
              task={task}
              tasks={tasks}
              onToggleSubtask={onToggleSubtask}
            />
          )}
          {task.status !== "completed" && (
            <div className="mt-3 flex flex-wrap gap-2">
              {(["todo", "in_progress", "completed"] as TaskStatus[]).map(
                status => (
                  <button
                    key={status}
                    onClick={() => onStatus(status)}
                    className={cn(
                      "rounded-full border px-2.5 py-0.5 text-[11px] font-medium capitalize",
                      task.status === status
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-muted-foreground hover:bg-accent"
                    )}
                  >
                    {status.replace("_", " ")}
                  </button>
                )
              )}
              <button
                onClick={onLog}
                className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-accent"
              >
                <Clock3 className="h-3 w-3" />
                Log 15m
              </button>
              <button
                onClick={onDefer}
                className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-accent"
              >
                <Forward className="h-3 w-3" />
                Tomorrow
              </button>
              <div className="flex-1" />
              <button
                onClick={onEdit}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
              >
                <Pencil className="h-3 w-3" />
                Edit
              </button>
              <button
                onClick={onDelete}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3 w-3" />
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TaskRecoveryDetails({
  task,
  tasks,
  onToggleSubtask,
}: {
  task: Task;
  tasks: Task[];
  onToggleSubtask: (subtaskId: string) => void;
}) {
  const recovery = getTaskRecoveryKind(task, tasks, todayStr());
  const dependencies = getIncompleteTaskDependencies(task, tasks);
  const progress = getTaskProgress(task);
  const label =
    recovery === "blocked"
      ? `Blocked by ${dependencies.length} task${dependencies.length === 1 ? "" : "s"}`
      : recovery === "deferred"
        ? `Deferred until ${task.deferredUntil}`
        : recovery === "overdue"
          ? "Needs a recovery decision"
          : recovery === "partial"
            ? "Partially underway"
            : "Ready to start";
  return (
    <div className="mt-3 rounded-xl bg-muted/50 p-3">
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        <span
          className={cn(
            "rounded-full border px-2 py-0.5 font-medium",
            recovery === "overdue"
              ? "border-destructive/30 text-destructive"
              : recovery === "blocked"
                ? "border-amber-400/40 text-amber-700 dark:text-amber-300"
                : "border-border"
          )}
        >
          {label}
        </span>
        {task.topicId && (
          <span className="inline-flex items-center gap-1">
            <Link2 className="h-3 w-3" />
            Topic linked
          </span>
        )}
        {task.estimatedMinutes && (
          <span>{getRemainingTaskMinutes(task)} min remaining estimate</span>
        )}
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-background">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        {progress}% recorded progress · {task.actualMinutes ?? 0} min confirmed
        work
      </p>
      {task.subtasks?.length ? (
        <div className="mt-2 space-y-1">
          {task.subtasks.map(subtask => (
            <button
              key={subtask.id}
              onClick={() => onToggleSubtask(subtask.id)}
              className="flex w-full items-center gap-2 text-left text-xs text-muted-foreground hover:text-foreground"
            >
              <span
                className={cn(
                  "h-3.5 w-3.5 rounded border",
                  subtask.completed && "border-primary bg-primary"
                )}
              />
              {subtask.title}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function TaskDialog({
  open,
  onOpenChange,
  editing,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Task | null;
  onSave: (data: Partial<Task>) => boolean;
}) {
  const { state } = useStore();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [topicId, setTopicId] = useState("");
  const [estimatedMinutes, setEstimatedMinutes] = useState("30");
  const [progressPercent, setProgressPercent] = useState("0");
  const [subtaskText, setSubtaskText] = useState("");
  const [dependsOnTaskIds, setDependsOnTaskIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const saveClaimRef = useRef(false);
  const topicOptions = useMemo(
    () =>
      Array.from(
        new Map([
          ...state.topics.map(topic => [topic.id, topic] as const),
          ...state.exams.flatMap(exam =>
            exam.topics.map(
              topic =>
                [
                  topic.id,
                  { id: topic.id, subject: exam.subject, name: topic.name },
                ] as const
            )
          ),
        ]).values()
      ),
    [state.exams, state.topics]
  );

  useEffect(() => {
    if (open) saveClaimRef.current = false;
    if (editing) {
      setTitle(editing.title);
      setDescription(editing.description);
      setSubject(editing.subject);
      setDueDate(editing.dueDate);
      setPriority(editing.priority);
      setStatus(editing.status);
      setTopicId(editing.topicId ?? "");
      setEstimatedMinutes(String(editing.estimatedMinutes ?? 30));
      setProgressPercent(String(getTaskProgress(editing)));
      setSubtaskText(
        (editing.subtasks ?? []).map(subtask => subtask.title).join("\n")
      );
      setDependsOnTaskIds(editing.dependsOnTaskIds ?? []);
    } else {
      setTitle("");
      setDescription("");
      setSubject("");
      setDueDate("");
      setPriority("medium");
      setStatus("todo");
      setTopicId("");
      setEstimatedMinutes("30");
      setProgressPercent("0");
      setSubtaskText("");
      setDependsOnTaskIds([]);
    }
    setError("");
  }, [editing, open]);

  const submit = () => {
    if (!title.trim()) return setError("Give your task a title.");
    if (
      editing &&
      wouldCreateTaskDependencyCycle(editing.id, dependsOnTaskIds, state.tasks)
    )
      return setError(
        "Choose dependencies that do not lead back to this task."
      );
    if (saveClaimRef.current) return;
    saveClaimRef.current = true;
    const oldSubtasks = editing?.subtasks ?? [];
    const subtasks: TaskSubtask[] = subtaskText
      .split("\n")
      .map(line => line.trim())
      .filter(Boolean)
      .slice(0, 100)
      .map((line, index) => ({
        id: oldSubtasks[index]?.id ?? uid(),
        title: line.slice(0, 1_000),
        completed: oldSubtasks[index]?.completed ?? false,
      }));
    if (
      !onSave({
        title: title.trim(),
        description: description.trim(),
        subject,
        dueDate,
        priority,
        status,
        ...(topicId ? { topicId } : {}),
        estimatedMinutes: Math.max(
          1,
          Math.min(1_440, Math.round(Number(estimatedMinutes) || 30))
        ),
        progressPercent:
          status === "completed"
            ? 100
            : Math.max(
                0,
                Math.min(99, Math.round(Number(progressPercent) || 0))
              ),
        subtasks,
        dependsOnTaskIds,
      })
    )
      saveClaimRef.current = false;
  };

  const candidates = state.tasks.filter(
    task => task.id !== editing?.id && task.status !== "completed"
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">
            {editing ? "Edit task" : "New task"}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div>
            <Label className="mb-1.5 block text-xs font-semibold">Title</Label>
            <Input
              value={title}
              onChange={event => setTitle(event.target.value)}
              placeholder="e.g. Finish calculus exercise"
              className="rounded-xl"
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-semibold">
              Description
            </Label>
            <Textarea
              value={description}
              onChange={event => setDescription(event.target.value)}
              placeholder="Details…"
              className="rounded-xl"
              rows={2}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5 block text-xs font-semibold">
                Subject
              </Label>
              <Select
                value={subject || "_none"}
                onValueChange={value =>
                  setSubject(value === "_none" ? "" : value)
                }
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Any</SelectItem>
                  {(state.profile?.subjects ?? []).map(entry => (
                    <SelectItem key={entry} value={entry}>
                      {entry}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block text-xs font-semibold">
                Due date
              </Label>
              <Input
                type="date"
                value={dueDate}
                onChange={event => setDueDate(event.target.value)}
                className="rounded-xl"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5 block text-xs font-semibold">
                Priority
              </Label>
              <Select
                value={priority}
                onValueChange={value => setPriority(value as Priority)}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block text-xs font-semibold">
                Status
              </Label>
              <Select
                value={status}
                onValueChange={value => setStatus(value as TaskStatus)}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">To Do</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  {editing && (
                    <SelectItem value="completed">Completed</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5 block text-xs font-semibold">
                Topic link
              </Label>
              <Select
                value={topicId || "_none"}
                onValueChange={value => {
                  const next = value === "_none" ? "" : value;
                  setTopicId(next);
                  const selected = topicOptions.find(
                    topic => topic.id === next
                  );
                  if (selected) setSubject(selected.subject);
                }}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">No topic link</SelectItem>
                  {topicOptions
                    .filter(topic => !subject || topic.subject === subject)
                    .map(topic => (
                      <SelectItem key={topic.id} value={topic.id}>
                        {topic.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block text-xs font-semibold">
                Work estimate (min)
              </Label>
              <Input
                type="number"
                min="1"
                max="1440"
                value={estimatedMinutes}
                onChange={event => setEstimatedMinutes(event.target.value)}
                className="rounded-xl"
              />
            </div>
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-semibold">
              Progress recorded (%)
            </Label>
            <Input
              type="number"
              min="0"
              max="99"
              value={progressPercent}
              onChange={event => setProgressPercent(event.target.value)}
              className="rounded-xl"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Logging time never completes a task automatically.
            </p>
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-semibold">
              Task steps (one per line)
            </Label>
            <Textarea
              value={subtaskText}
              onChange={event => setSubtaskText(event.target.value)}
              placeholder={"Find sources\nDraft outline\nSubmit final copy"}
              className="rounded-xl"
              rows={3}
            />
          </div>
          {editing && candidates.length > 0 && (
            <div>
              <Label className="mb-1.5 block text-xs font-semibold">
                Blocked until these tasks finish
              </Label>
              <div className="max-h-28 space-y-1 overflow-y-auto rounded-xl border p-2">
                {candidates.map(task => (
                  <label
                    key={task.id}
                    className="flex items-center gap-2 text-xs"
                  >
                    <input
                      type="checkbox"
                      checked={dependsOnTaskIds.includes(task.id)}
                      onChange={event =>
                        setDependsOnTaskIds(current =>
                          event.target.checked
                            ? [...current, task.id]
                            : current.filter(id => id !== task.id)
                        )
                      }
                    />
                    {task.title}
                  </label>
                ))}
              </div>
            </div>
          )}
          {error && (
            <p className="text-xs font-medium text-destructive">{error}</p>
          )}
          <Button onClick={submit} className="rounded-xl">
            {editing ? "Save changes" : "Add task"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
