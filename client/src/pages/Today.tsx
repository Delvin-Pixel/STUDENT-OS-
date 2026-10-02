import { ProgressBar } from "@/components/AppBits";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useStore } from "@/contexts/StoreContext";
import { buildDailyContext } from "@/lib/dailyContext";
import {
  getExecutionCoach,
  getExecutionFeedback,
  getNextActionHref,
  getNextBestExecution,
  getRankedNextActions,
  getRecoveryRecommendation,
  type NextAction,
} from "@/lib/learningIntelligence";
import { getRemainingTaskMinutes, getTaskProgress } from "@/lib/taskExecution";
import { addDays, todayStr } from "@/lib/utils";
import {
  BellRing,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  CheckSquare,
  CircleDollarSign,
  Clock3,
  Flame,
  Forward,
  Pause,
  Play,
  SkipForward,
  Target,
} from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";

export default function Today() {
  const { state } = useStore();
  const context = buildDailyContext(state);
  const rankedActions = getRankedNextActions(state);
  const nextAction = rankedActions[0];
  const coach = getExecutionCoach(state);
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const nextExecution = getNextBestExecution(state, todayStr(), currentTime);
  const nextTask =
    nextAction?.kind === "task"
      ? (state.tasks.find(task => `task:${task.id}` === nextAction.id) ?? null)
      : null;
  const recommendation = getTodayRecommendation(nextAction);
  const executionFeedback = nextAction?.topicId
    ? getExecutionFeedback(state, nextAction.topicId)
    : null;
  const recovery = nextAction?.topicId
    ? getRecoveryRecommendation(state, nextAction.topicId, nextAction.subject)
    : null;
  const currency = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: context.currency,
    maximumFractionDigits: 0,
  });
  const goalProgress = context.dailyGoalMinutes
    ? Math.min(
        100,
        Math.round(
          (context.completedStudyMinutes / context.dailyGoalMinutes) * 100
        )
      )
    : 0;

  return (
    <div className="mx-auto max-w-4xl">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-primary">
            <CalendarDays className="h-5 w-5" />
            <span className="text-xs font-bold uppercase tracking-[0.16em]">
              Unified daily context
            </span>
          </div>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">
            Today’s student life
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            One connected view of the plans and work already in your private
            workspace. Student OS makes recovery visible instead of inventing
            duplicate sessions or reminders.
          </p>
        </div>
        <Button asChild variant="outline" className="rounded-full bg-card">
          <Link href="/settings">Reminder settings</Link>
        </Button>
      </header>
      <section className="mt-6 grid gap-3 sm:grid-cols-3">
        <Metric
          icon={Clock3}
          label="Study & focus"
          value={`${context.completedStudyMinutes}/${context.dailyGoalMinutes || "—"} min`}
        />
        <Metric
          icon={CheckSquare}
          label="Due tasks"
          value={String(context.dueTasks.length)}
        />
        <Metric
          icon={CircleDollarSign}
          label="This month’s spending"
          value={currency.format(context.monthlySpend)}
        />
      </section>
      {nextExecution && (
        <Card className="mt-4 border-dashed p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
                Next executable step
              </p>
              <p className="mt-1 text-sm font-semibold">
                {nextExecution.startTime}–{nextExecution.endTime} ·{" "}
                {nextExecution.duration} minutes
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {nextExecution.mode === "resume" ? "Resume" : "Start"}{" "}
                <span className="font-medium text-foreground">
                  {nextExecution.action.title}
                </span>
                {nextExecution.source === "free_window"
                  ? " in the first usable gap."
                  : "."}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {nextExecution.action.reason}
              </p>
            </div>
            <Button asChild size="sm" className="rounded-full">
              <Link href={getNextActionHref(nextExecution.action)}>
                {nextExecution.mode === "resume" ? "Resume step" : "Start step"}
              </Link>
            </Button>
          </div>
        </Card>
      )}
      {executionFeedback && executionFeedback.sessionsConsidered > 0 && (
        <Card className="mt-4 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
            Learning from your execution
          </p>
          <p className="mt-1 text-sm font-semibold">
            {executionFeedback.reason}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Last {executionFeedback.sessionsConsidered} sessions ·{" "}
            {executionFeedback.completionRate}% completed ·{" "}
            {executionFeedback.struggleRate}% difficult/confused
          </p>
          {recovery && (
            <div className="mt-3 rounded-xl bg-background/70 p-3">
              <p className="text-xs font-bold uppercase tracking-wider text-primary">
                Recovery move
              </p>
              <p className="mt-1 text-sm font-semibold">{recovery.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {recovery.reason}
              </p>
            </div>
          )}
        </Card>
      )}
      {nextTask ? (
        <TaskExecutionCard
          taskId={nextTask.id}
          title={nextTask.title}
          subject={nextTask.subject}
          detail={nextAction.detail}
          reason={nextAction.reason}
        />
      ) : coach ? (
        <ExecutionCoachCard
          key={`${coach.session.id}:${coach.session.status}`}
          sessionId={coach.session.id}
          title={coach.action.title}
          subject={coach.session.subject}
          topic={coach.session.topic}
          duration={coach.session.duration}
          reason={coach.action.reason}
          detail={coach.action.detail}
          status={coach.session.status}
          actualDuration={coach.session.actualDuration}
        />
      ) : recommendation ? (
        <LearningRecommendationCard action={recommendation} />
      ) : (
        <Card className="mt-5 border-dashed p-5">
          <h2 className="font-display text-lg font-semibold">
            Your next study step will appear here
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Add a task, plan a study block, or create a flashcard review. The
            command center only recommends work that already exists in your
            workspace.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild size="sm" className="rounded-full">
              <Link href="/tasks">Add task</Link>
            </Button>
            <Button
              asChild
              size="sm"
              variant="outline"
              className="rounded-full bg-card"
            >
              <Link href="/study">Plan study</Link>
            </Button>
          </div>
        </Card>
      )}
      <section className="mt-5 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Focus goal</h2>
            <Target className="h-5 w-5 text-primary" />
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            {context.dailyGoalMinutes
              ? `${context.completedStudyMinutes} of ${context.dailyGoalMinutes} planned focus minutes are completed.`
              : "Set a daily learning target to track focused time here."}
          </p>
          <ProgressBar value={goalProgress} className="mt-3" />
          <div className="mt-4 flex gap-2">
            <Button asChild size="sm" className="rounded-full">
              <Link href="/focus">Start focus</Link>
            </Button>
            <Button
              asChild
              size="sm"
              variant="outline"
              className="rounded-full bg-card"
            >
              <Link href="/goals">Manage goals</Link>
            </Button>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">
              Healthy routines
            </h2>
            <Flame className="h-5 w-5 text-primary" />
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            {context.habitCount
              ? `${context.habitCount} habit tracker${context.habitCount === 1 ? " is" : "s are"} available in your workspace.`
              : "Add a small habit to keep your study routine visible."}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {context.activeGoals.length
              ? `${context.activeGoals.length} active personal goal${context.activeGoals.length === 1 ? "" : "s"} remain in progress.`
              : "No active personal goals yet."}
          </p>
          <Button
            asChild
            size="sm"
            variant="outline"
            className="mt-4 rounded-full bg-card"
          >
            <Link href="/goals">View habits & goals</Link>
          </Button>
        </Card>
      </section>
      <section className="mt-5 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Schedule</h2>
            <CalendarDays className="h-5 w-5 text-primary" />
          </div>
          <div className="mt-4 space-y-2">
            {[
              ...context.timetableEvents.map(event => ({
                id: event.id,
                time: event.startTime,
                title: event.title,
                sub: event.subject || event.type,
              })),
              ...context.sessions.map(session => ({
                id: session.id,
                time: session.startTime,
                title: session.topic || session.subject,
                sub: `${session.subject} · ${session.duration} min`,
              })),
            ]
              .sort((a, b) => a.time.localeCompare(b.time))
              .slice(0, 5)
              .map(item => (
                <div
                  key={item.id}
                  className="flex gap-3 rounded-xl bg-muted/60 p-3"
                >
                  <span className="w-10 text-xs font-semibold text-primary">
                    {item.time}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {item.sub}
                    </p>
                  </div>
                </div>
              ))}
            {!context.timetableEvents.length && !context.sessions.length && (
              <p className="text-sm text-muted-foreground">
                No calendar or planned study sessions today.
              </p>
            )}
          </div>
          <Button
            asChild
            size="sm"
            variant="outline"
            className="mt-4 rounded-full bg-card"
          >
            <Link href="/timetable">Open timetable</Link>
          </Button>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">
              Due attention
            </h2>
            <BellRing className="h-5 w-5 text-primary" />
          </div>
          <div className="mt-4 space-y-2">
            {context.dueTasks.slice(0, 5).map(task => (
              <div key={task.id} className="rounded-xl bg-muted/60 p-3">
                <p className="text-sm font-medium">{task.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {task.subject || "General"} · due {task.dueDate}
                </p>
              </div>
            ))}
            {!context.dueTasks.length && (
              <p className="text-sm text-muted-foreground">
                No overdue or due-today tasks.
              </p>
            )}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            {context.remindersActive
              ? "Your selected reminder categories are active; settings control delivery timing and caps."
              : "Reminders are currently off or no reminder category is selected."}
          </p>
          <div className="mt-4 flex gap-2">
            <Button asChild size="sm" className="rounded-full">
              <Link href="/tasks">Open tasks</Link>
            </Button>
            <Button
              asChild
              size="sm"
              variant="outline"
              className="rounded-full bg-card"
            >
              <Link href="/settings">Notification settings</Link>
            </Button>
          </div>
        </Card>
      </section>
    </div>
  );
}

export function getTodayRecommendation(action: NextAction | undefined) {
  return action?.kind === "study" || action?.kind === "flashcards"
    ? action
    : null;
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock3;
  label: string;
  value: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-4 w-4 text-primary" />
        {label}
      </div>
      <p className="mt-2 font-display text-2xl font-bold">{value}</p>
    </Card>
  );
}

function LearningRecommendationCard({ action }: { action: NextAction }) {
  const isFlashcards = action.kind === "flashcards";
  return (
    <Card className="mt-5 overflow-hidden border-primary/30 bg-primary/[0.035] p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-primary">
            <Clock3 className="h-4 w-4" />
            <span className="text-xs font-bold uppercase tracking-[0.16em]">
              Daily execution coach
            </span>
          </div>
          <h2 className="mt-1 font-display text-xl font-bold">
            {action.title}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {action.subject || "Study"} · {action.detail} · about{" "}
            {action.duration} minutes
          </p>
          <div className="mt-3 rounded-xl bg-background/70 p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              Why this now
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {action.reason}
            </p>
          </div>
        </div>
        <Button asChild size="sm" className="shrink-0 rounded-full">
          <Link href={getNextActionHref(action)}>
            {isFlashcards ? "Open review" : "Plan revision"}
          </Link>
        </Button>
      </div>
    </Card>
  );
}

function TaskExecutionCard({
  taskId,
  title,
  subject,
  detail,
  reason,
}: {
  taskId: string;
  title: string;
  subject: string;
  detail: string;
  reason: string;
}) {
  const { state, recordTaskWork, completeTask, deferTask } = useStore();
  const task = state.tasks.find(candidate => candidate.id === taskId);
  if (!task) return null;
  const progress = getTaskProgress(task);
  return (
    <Card className="mt-5 overflow-hidden border-primary/30 bg-primary/[0.035] p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-primary">
            <CheckSquare className="h-4 w-4" />
            <span className="text-xs font-bold uppercase tracking-[0.16em]">
              Daily execution coach
            </span>
          </div>
          <h2 className="mt-1 font-display text-xl font-bold">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {subject || "General"} · {detail} · about{" "}
            {getRemainingTaskMinutes(task)} minutes left by your estimate
          </p>
          <div className="mt-3 rounded-xl bg-background/70 p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              Why this now
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{reason}</p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {progress}% learner-recorded progress; time does not finish the
              task automatically.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            size="sm"
            className="rounded-full"
            onClick={() => recordTaskWork(taskId, 15)}
          >
            <Clock3 className="mr-1 h-4 w-4" />
            Log 15m
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="rounded-full bg-card"
            onClick={() => completeTask(taskId)}
          >
            <CheckCircle2 className="mr-1 h-4 w-4" />
            Complete
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="rounded-full"
            onClick={() =>
              deferTask(taskId, addDays(todayStr(), 1), "Deferred from Today")
            }
          >
            <Forward className="mr-1 h-4 w-4" />
            Tomorrow
          </Button>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <Button
          asChild
          size="sm"
          variant="outline"
          className="rounded-full bg-card"
        >
          <Link href={`/focus?task=${encodeURIComponent(task.id)}`}>
            Focus on this
          </Link>
        </Button>
        <Button
          asChild
          size="sm"
          variant="outline"
          className="rounded-full bg-card"
        >
          <Link href="/tasks">Open task details</Link>
        </Button>
      </div>
    </Card>
  );
}

function ExecutionCoachCard({
  sessionId,
  title,
  subject,
  topic,
  duration,
  reason,
  detail,
  status,
  actualDuration,
}: {
  sessionId: string;
  title: string;
  subject: string;
  topic: string;
  duration: number;
  reason: string;
  detail: string;
  status:
    | "planned"
    | "in_progress"
    | "paused"
    | "completed"
    | "skipped"
    | "rescheduled";
  actualDuration?: number;
}) {
  const {
    startSession,
    pauseSession,
    resumeSession,
    completeSession,
    skipSession,
    rescheduleSession,
  } = useStore();
  const [showComplete, setShowComplete] = useState(false);
  const [showSkip, setShowSkip] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);
  const [minutes, setMinutes] = useState(String(actualDuration ?? duration));
  const [reflection, setReflection] = useState<
    "easy" | "okay" | "difficult" | "still_confused"
  >("okay");
  const [skipReason, setSkipReason] = useState<
    | "too_tired"
    | "no_time"
    | "higher_priority"
    | "missing_materials"
    | "not_ready"
    | "other"
  >("no_time");
  const [date, setDate] = useState(() => addDays(todayStr(), 1));
  const [time, setTime] = useState("18:00");
  const [rescheduleReason, setRescheduleReason] = useState("Needed more time");
  const complete = () => {
    completeSession(
      sessionId,
      Math.max(1, Math.min(1_440, Math.round(Number(minutes) || duration))),
      reflection
    );
    setShowComplete(false);
  };
  return (
    <Card className="mt-5 overflow-hidden border-primary/30 bg-primary/[0.035] p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-primary">
            <Play className="h-4 w-4" />
            <span className="text-xs font-bold uppercase tracking-[0.16em]">
              Daily execution coach
            </span>
          </div>
          <h2 className="mt-1 font-display text-xl font-bold">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {subject} · {topic} · {duration} minutes · {detail}
          </p>
          <div className="mt-3 rounded-xl bg-background/70 p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              Why this now
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{reason}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {status === "planned" && (
            <Button
              size="sm"
              className="rounded-full"
              onClick={() => startSession(sessionId)}
            >
              <Play className="mr-1 h-4 w-4" />
              Start
            </Button>
          )}
          {status === "in_progress" && (
            <Button
              size="sm"
              variant="outline"
              className="rounded-full bg-card"
              onClick={() => pauseSession(sessionId)}
            >
              <Pause className="mr-1 h-4 w-4" />
              Pause
            </Button>
          )}
          {status === "paused" && (
            <Button
              size="sm"
              className="rounded-full"
              onClick={() => resumeSession(sessionId)}
            >
              <Play className="mr-1 h-4 w-4" />
              Resume
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="rounded-full bg-card"
            onClick={() => setShowComplete(value => !value)}
          >
            <CheckCircle2 className="mr-1 h-4 w-4" />
            Complete
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="rounded-full bg-card"
            onClick={() => setShowReschedule(value => !value)}
          >
            <CalendarClock className="mr-1 h-4 w-4" />
            Reschedule
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="rounded-full"
            onClick={() => setShowSkip(value => !value)}
          >
            <SkipForward className="mr-1 h-4 w-4" />
            Skip
          </Button>
        </div>
      </div>
      {showComplete && (
        <div className="mt-4 grid gap-3 rounded-xl border bg-background p-4 sm:grid-cols-[140px_1fr_auto]">
          <label className="grid gap-1 text-sm font-medium">
            Actual minutes
            <input
              aria-label="Actual study minutes"
              type="number"
              min="1"
              max="1440"
              value={minutes}
              onChange={event => setMinutes(event.target.value)}
              className="h-9 rounded-md border bg-background px-2"
            />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            How did it go?
            <select
              aria-label="Session reflection"
              value={reflection}
              onChange={event =>
                setReflection(event.target.value as typeof reflection)
              }
              className="h-9 rounded-md border bg-background px-2"
            >
              <option value="easy">Easy</option>
              <option value="okay">Okay</option>
              <option value="difficult">Difficult</option>
              <option value="still_confused">Still confused</option>
            </select>
          </label>
          <Button className="self-end rounded-full" onClick={complete}>
            Save completion
          </Button>
        </div>
      )}
      {showSkip && (
        <div className="mt-4 flex flex-col gap-3 rounded-xl border bg-background p-4 sm:flex-row sm:items-end">
          <label className="grid flex-1 gap-1 text-sm font-medium">
            What got in the way?
            <select
              aria-label="Skip reason"
              value={skipReason}
              onChange={event =>
                setSkipReason(event.target.value as typeof skipReason)
              }
              className="h-9 rounded-md border bg-background px-2"
            >
              <option value="too_tired">Too tired</option>
              <option value="no_time">No time</option>
              <option value="higher_priority">Higher priority came up</option>
              <option value="missing_materials">Missing materials</option>
              <option value="not_ready">Not ready</option>
              <option value="other">Other</option>
            </select>
          </label>
          <Button
            variant="outline"
            className="rounded-full"
            onClick={() => {
              skipSession(sessionId, skipReason);
              setShowSkip(false);
            }}
          >
            Skip without penalty
          </Button>
        </div>
      )}
      {showReschedule && (
        <div className="mt-4 grid gap-3 rounded-xl border bg-background p-4 sm:grid-cols-4">
          <label className="grid gap-1 text-sm font-medium">
            Date
            <input
              aria-label="Reschedule date"
              type="date"
              min={todayStr()}
              value={date}
              onChange={event => setDate(event.target.value)}
              className="h-9 rounded-md border bg-background px-2"
            />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Time
            <input
              aria-label="Reschedule time"
              type="time"
              value={time}
              onChange={event => setTime(event.target.value)}
              className="h-9 rounded-md border bg-background px-2"
            />
          </label>
          <label className="grid gap-1 text-sm font-medium sm:col-span-2">
            Reason
            <input
              aria-label="Reschedule reason"
              maxLength={1000}
              value={rescheduleReason}
              onChange={event => setRescheduleReason(event.target.value)}
              className="h-9 rounded-md border bg-background px-2"
            />
          </label>
          <div className="sm:col-span-4">
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => {
                if (rescheduleSession(sessionId, date, time, rescheduleReason))
                  setShowReschedule(false);
              }}
            >
              Save new time
            </Button>
            <p className="mt-2 text-xs text-muted-foreground">
              Student OS will not overwrite a session already planned for the
              same time.
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}
