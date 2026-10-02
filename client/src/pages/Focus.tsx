/* STUDENT OS — Focus Timer. Pomodoro with presets (15/5, 25/5, 50/10, custom),
   start/pause/resume/reset/skip, subject association, stats + streak. */

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useStore } from "@/contexts/StoreContext";
import { sendNotification } from "@/lib/browserNotif";
import {
  currentDevicePushSubscription,
  limitPlannedPushReminders,
  planDevicePushReminders,
  planFocusCompletionReminder,
  saveActiveFocusReminder,
} from "@/lib/devicePush";
import {
  clearActiveFocusTimer,
  focusTimerForPrefs,
  loadActiveFocusTimer,
  remainingFromAnchor,
  saveActiveFocusTimer,
  type PersistedFocusTimer,
} from "@/lib/focusPersistence";
import { idleTimerSeconds } from "@/lib/focusTimer";
import { trpc } from "@/lib/trpc";
import {
  cn,
  isoDate,
  minutesToLabel,
  streakLabel,
  todayStr,
} from "@/lib/utils";
import {
  Flame,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  Timer as TimerIcon,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";

type Phase = "focus" | "break";

const PRESETS: Record<string, { focus: number; breakLen: number }> = {
  "15/5": { focus: 15, breakLen: 5 },
  "25/5": { focus: 25, breakLen: 5 },
  "50/10": { focus: 50, breakLen: 10 },
  custom: { focus: 25, breakLen: 5 },
};

export default function Focus() {
  const { state, accountCacheScope, addFocusSession, setTimerPrefs, notify } =
    useStore();
  const [location] = useLocation();
  const routedTaskId = new URLSearchParams(location.split("?")[1] ?? "").get(
    "task"
  );
  const prefs = state.settings.timerPrefs;
  const timerRef = useRef<PersistedFocusTimer | null>(
    loadActiveFocusTimer(accountCacheScope)
  );
  const restoredTimer = timerRef.current;
  const [phase, setPhase] = useState<Phase>(restoredTimer?.phase ?? "focus");
  const [secondsLeft, setSecondsLeft] = useState(
    restoredTimer ? remainingFromAnchor(restoredTimer) : prefs.focus * 60
  );
  const [running, setRunning] = useState(restoredTimer?.running ?? false);
  const [subject, setSubject] = useState("");
  const [taskId, setTaskId] = useState("");
  const [topicId, setTopicId] = useState("");
  const [objective, setObjective] = useState("");
  const [customFocus, setCustomFocus] = useState(prefs.focus);
  const [customBreak, setCustomBreak] = useState(prefs.breakLen);
  const topicOptions = useMemo(
    () =>
      Array.from(
        new Map([
          ...state.topics.map(
            topic =>
              [
                topic.id,
                { id: topic.id, subject: topic.subject, name: topic.name },
              ] as const
          ),
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
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const latestFocusReminderRef =
    useRef<ReturnType<typeof planFocusCompletionReminder>>(null);
  const requestedFocusReminderSyncRef = useRef(0);
  const completedFocusReminderSyncRef = useRef(0);
  const focusReminderSyncRunningRef = useRef(false);
  const appliedRoutedTaskRef = useRef<string | null>(null);
  const syncDeviceReminders = trpc.push.syncReminders.useMutation();

  useEffect(() => {
    if (
      !routedTaskId ||
      running ||
      appliedRoutedTaskRef.current === routedTaskId
    )
      return;
    appliedRoutedTaskRef.current = routedTaskId;
    const task = state.tasks.find(
      candidate =>
        candidate.id === routedTaskId && candidate.status !== "completed"
    );
    if (!task) return;
    setTaskId(task.id);
    setSubject(task.subject);
    setTopicId(task.topicId ?? "");
    setObjective(task.title);
  }, [routedTaskId, running, state.tasks]);

  const totalSeconds =
    timerRef.current?.phase === phase
      ? timerRef.current.durationSeconds
      : (phase === "focus" ? prefs.focus : prefs.breakLen) * 60;
  const progress = Math.min(1, Math.max(0, 1 - secondsLeft / totalSeconds));

  const persistTimer = (timer: PersistedFocusTimer | null) => {
    timerRef.current = timer;
    if (timer) saveActiveFocusTimer(accountCacheScope, timer);
    else clearActiveFocusTimer(accountCacheScope);
  };

  const syncFocusReminder = (
    focusReminder: ReturnType<typeof planFocusCompletionReminder>
  ) => {
    latestFocusReminderRef.current = focusReminder;
    requestedFocusReminderSyncRef.current += 1;
    if (focusReminderSyncRunningRef.current) return;
    focusReminderSyncRunningRef.current = true;
    void (async () => {
      try {
        while (
          completedFocusReminderSyncRef.current <
          requestedFocusReminderSyncRef.current
        ) {
          const syncVersion = requestedFocusReminderSyncRef.current;
          const reminderToSync = latestFocusReminderRef.current;
          try {
            if (state.settings.notifications) {
              const subscription = await currentDevicePushSubscription();
              if (subscription)
                await syncDeviceReminders.mutateAsync({
                  subscription,
                  reminders: limitPlannedPushReminders(
                    [
                      ...planDevicePushReminders(state),
                      ...(reminderToSync ? [reminderToSync] : []),
                    ],
                    state
                  ),
                });
            }
          } finally {
            completedFocusReminderSyncRef.current = syncVersion;
          }
        }
      } finally {
        focusReminderSyncRunningRef.current = false;
        if (
          completedFocusReminderSyncRef.current <
          requestedFocusReminderSyncRef.current
        ) {
          syncFocusReminder(latestFocusReminderRef.current);
        }
      }
    })();
  };

  // Keep timer in sync when preferences change while idle. This must be an
  // effect rather than render-time memoization because it updates component
  // state.
  useEffect(() => {
    if (!running) {
      setSecondsLeft(
        timerRef.current?.phase === phase
          ? timerRef.current.remainingSeconds
          : idleTimerSeconds(phase, prefs)
      );
    }
  }, [phase, prefs.breakLen, prefs.focus, running, prefs]);

  useEffect(() => {
    if (running) {
      const tick = () => {
        const timer = timerRef.current;
        if (timer) setSecondsLeft(remainingFromAnchor(timer));
      };
      tick();
      intervalRef.current = setInterval(tick, 1000);
      const onVisibility = () => {
        if (document.visibilityState === "visible") tick();
      };
      document.addEventListener("visibilitychange", onVisibility);
      return () => {
        document.removeEventListener("visibilitychange", onVisibility);
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running]);

  // phase transitions
  useEffect(() => {
    if (secondsLeft <= 0 && running) {
      if (phase === "focus") {
        const completedTimer = timerRef.current;
        const duration = Math.max(
          1,
          Math.round((completedTimer?.durationSeconds ?? prefs.focus * 60) / 60)
        );
        saveActiveFocusReminder(accountCacheScope, null);
        void syncFocusReminder(null);
        const accepted = addFocusSession(subject, duration, {
          ...(taskId ? { taskId } : {}),
          ...(topicId ? { topicId } : {}),
          ...(objective.trim() ? { objective: objective.trim() } : {}),
        });
        const nextPhase: Phase = "break";
        const nextTimer = {
          ...focusTimerForPrefs(accountCacheScope, prefs),
          phase: nextPhase,
          durationSeconds: prefs.breakLen * 60,
          remainingSeconds: prefs.breakLen * 60,
          running: true,
          startedAt: Date.now(),
          endsAt: Date.now() + prefs.breakLen * 60 * 1_000,
          subject: "",
          taskId: "",
          topicId: "",
          objective: "",
        } satisfies PersistedFocusTimer;
        persistTimer(nextTimer);
        setPhase(nextPhase);
        setSecondsLeft(nextTimer.remainingSeconds);
        notify(
          accepted
            ? `Focus session done! ${minutesToLabel(duration)} recorded. Time for a ${prefs.breakLen}-min break.`
            : `Focus timer finished, but Student OS could not record this session. Your break still begins now.`,
          accepted ? "success" : "warning"
        );
        sendNotification(
          "🎯 Focus session done!",
          accepted
            ? `${minutesToLabel(duration)} recorded${subject ? ` for ${subject}` : ""}. Take a ${prefs.breakLen}-min break.`
            : `Your timer finished. Student OS could not record the session, but your break has started.`
        );
      } else {
        const nextTimer = {
          ...focusTimerForPrefs(accountCacheScope, prefs),
          phase: "focus" as const,
          durationSeconds: prefs.focus * 60,
          remainingSeconds: prefs.focus * 60,
          running: true,
          startedAt: Date.now(),
          endsAt: Date.now() + prefs.focus * 60 * 1_000,
          subject,
          taskId,
          topicId,
          objective,
        } satisfies PersistedFocusTimer;
        persistTimer(nextTimer);
        setPhase("focus");
        setSecondsLeft(nextTimer.remainingSeconds);
        notify("Break's over — ready for another round?", "info");
        sendNotification(
          "☕ Break's over!",
          "Rest up — another focus round is waiting. Let's go!"
        );
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, running]);

  const skipBreak = () => {
    saveActiveFocusReminder(accountCacheScope, null);
    void syncFocusReminder(null);
    persistTimer(null);
    setPhase("focus");
    setSecondsLeft(prefs.focus * 60);
    setRunning(false);
  };

  const reset = () => {
    saveActiveFocusReminder(accountCacheScope, null);
    void syncFocusReminder(null);
    persistTimer(null);
    setRunning(false);
    setPhase("focus");
    setSecondsLeft(prefs.focus * 60);
  };

  const applyPreset = (key: string) => {
    const p =
      key === "custom"
        ? { focus: customFocus, breakLen: customBreak }
        : PRESETS[key];
    saveActiveFocusReminder(accountCacheScope, null);
    void syncFocusReminder(null);
    persistTimer(null);
    setTimerPrefs({ focus: p.focus, breakLen: p.breakLen, preset: key });
    setRunning(false);
    setPhase("focus");
    setSecondsLeft(p.focus * 60);
  };

  const toggleTimer = () => {
    if (running) {
      const current = timerRef.current;
      const remaining = current ? remainingFromAnchor(current) : secondsLeft;
      if (current)
        persistTimer({
          ...current,
          remainingSeconds: remaining,
          running: false,
          endsAt: undefined,
        });
      saveActiveFocusReminder(accountCacheScope, null);
      void syncFocusReminder(null);
      setSecondsLeft(remaining);
      setRunning(false);
      return;
    }
    const focusReminder =
      phase === "focus" && state.settings.notificationPreferences.focus
        ? planFocusCompletionReminder(
            secondsLeft,
            subject,
            new Date(),
            state.settings.notificationPreferences.categoryVibrationPatterns
              ?.focus ?? state.settings.notificationPreferences.vibrationPattern
          )
        : null;
    const base =
      timerRef.current?.phase === phase
        ? timerRef.current
        : ({
            ...focusTimerForPrefs(accountCacheScope, prefs),
            phase,
            durationSeconds: secondsLeft,
            remainingSeconds: secondsLeft,
            subject,
            taskId,
            topicId,
            objective,
          } satisfies PersistedFocusTimer);
    const startedAt = base.startedAt ?? Date.now();
    persistTimer({
      ...base,
      phase,
      durationSeconds: secondsLeft,
      remainingSeconds: secondsLeft,
      running: true,
      startedAt,
      endsAt: Date.now() + secondsLeft * 1_000,
      subject,
      taskId,
      topicId,
      objective,
    });
    saveActiveFocusReminder(accountCacheScope, focusReminder);
    void syncFocusReminder(focusReminder);
    setRunning(true);
  };

  /* stats */
  const today = todayStr();
  const todaySessions = state.focusSessions.filter(f => f.date === today);
  const todayMinutes = todaySessions.reduce((a, f) => a + f.duration, 0);
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return isoDate(d);
  });
  const weekMinutes = state.focusSessions
    .filter(f => week.includes(f.date))
    .reduce((a, f) => a + f.duration, 0);

  const mm = Math.floor(secondsLeft / 60);
  const ss = secondsLeft % 60;
  const r = 92;
  const circumference = 2 * Math.PI * r;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-3xl font-bold tracking-tight">
        Focus Timer
      </h1>
      <p className="mt-1 text-xs text-muted-foreground">
        Deep work is a muscle — twenty-five focused minutes train it daily.
      </p>

      <div className="mt-5 grid gap-4 lg:grid-cols-5">
        {/* Timer */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm lg:col-span-3">
          <div className="flex justify-center gap-2">
            {Object.keys(PRESETS).map(key => (
              <button
                key={key}
                onClick={() => applyPreset(key)}
                disabled={running}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-xs font-medium capitalize transition-colors disabled:opacity-60",
                  prefs.preset === key
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-accent"
                )}
              >
                {key === "custom" ? "Custom" : key}
              </button>
            ))}
          </div>

          {/* ring */}
          <div className="relative mx-auto mt-6 h-64 w-64">
            <svg viewBox="0 0 200 200" className="timer-ring h-full w-full">
              <circle
                cx="100"
                cy="100"
                r={r}
                fill="none"
                stroke="var(--muted)"
                strokeWidth="10"
              />
              <circle
                cx="100"
                cy="100"
                r={r}
                fill="none"
                stroke={
                  phase === "focus"
                    ? "oklch(0.65 0.19 35)"
                    : "oklch(0.62 0.11 195)"
                }
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - progress)}
                className="progress"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                {phase === "focus" ? "Focus" : "Break"}
              </span>
              <span className="font-display text-6xl font-bold tabular-nums">
                {String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}
              </span>
              <span className="mt-1 text-xs text-muted-foreground">
                {minutesToLabel(prefs.focus)} / {prefs.breakLen} min
              </span>
            </div>
          </div>

          {/* objective */}
          <div className="mx-auto mt-4 grid max-w-md gap-3 sm:grid-cols-2">
            <div>
              <Label className="mb-1 block text-xs font-semibold">
                Studying (optional)
              </Label>
              <Select
                value={subject || "_none"}
                onValueChange={v => {
                  setSubject(v === "_none" ? "" : v);
                  if (v === "_none") setTopicId("");
                }}
                disabled={running}
              >
                <SelectTrigger className="w-full rounded-xl">
                  <SelectValue placeholder="Pick a subject" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">No subject</SelectItem>
                  {(state.profile?.subjects ?? []).map(s => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-xs font-semibold">
                Task objective
              </Label>
              <Select
                value={taskId || "_none"}
                onValueChange={value => {
                  const nextId = value === "_none" ? "" : value;
                  setTaskId(nextId);
                  const task = state.tasks.find(
                    candidate => candidate.id === nextId
                  );
                  if (task) {
                    setSubject(task.subject);
                    setTopicId(task.topicId ?? "");
                    setObjective(task.title);
                  }
                }}
                disabled={running}
              >
                <SelectTrigger className="w-full rounded-xl">
                  <SelectValue placeholder="Optional task" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">General focus</SelectItem>
                  {state.tasks
                    .filter(task => task.status !== "completed")
                    .map(task => (
                      <SelectItem key={task.id} value={task.id}>
                        {task.title}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-xs font-semibold">
                Topic link
              </Label>
              <Select
                value={topicId || "_none"}
                onValueChange={value => {
                  const nextId = value === "_none" ? "" : value;
                  setTopicId(nextId);
                  const topic = topicOptions.find(
                    candidate => candidate.id === nextId
                  );
                  if (topic) setSubject(topic.subject);
                }}
                disabled={running}
              >
                <SelectTrigger className="w-full rounded-xl">
                  <SelectValue placeholder="Optional topic" />
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
              <Label className="mb-1 block text-xs font-semibold">
                Round intention
              </Label>
              <input
                value={objective}
                onChange={event =>
                  setObjective(event.target.value.slice(0, 1000))
                }
                disabled={running}
                placeholder="e.g. Draft the introduction"
                className="h-10 w-full rounded-xl border bg-background px-3 text-sm"
              />
            </div>
            <p className="text-[11px] text-muted-foreground sm:col-span-2">
              A completed round records effort for its selected task and topic.
              It does not automatically mark work done or prove mastery.
            </p>
          </div>

          {/* controls */}
          <div className="mt-5 flex justify-center gap-3">
            <Button
              variant="outline"
              size="icon"
              className="h-12 w-12 rounded-full bg-card"
              onClick={reset}
              aria-label="Reset"
            >
              <RotateCcw className="h-4.5 w-4.5" />
            </Button>
            <Button
              size="lg"
              className="h-14 rounded-full px-10 text-base"
              onClick={toggleTimer}
            >
              {running ? (
                <Pause className="mr-1 h-4 w-4" />
              ) : (
                <Play className="mr-1 h-4 w-4" />
              )}
              {running
                ? "Pause"
                : phase === "focus"
                  ? "Start focus"
                  : "Start break"}
            </Button>
            {phase === "break" && (
              <Button
                variant="outline"
                size="icon"
                className="h-12 w-12 rounded-full bg-card"
                onClick={skipBreak}
                aria-label="Skip break"
              >
                <SkipForward className="h-4.5 w-4.5" />
              </Button>
            )}
          </div>

          {/* custom preset editor */}
          {prefs.preset === "custom" && !running && (
            <div className="mt-5 rounded-xl bg-muted/50 p-4">
              <div className="mb-2 text-xs font-semibold text-muted-foreground">
                Custom preset
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="mb-1 block text-[11px]">
                    Focus: {customFocus} min
                  </Label>
                  <Slider
                    value={[customFocus]}
                    onValueChange={v => setCustomFocus(v[0])}
                    min={5}
                    max={120}
                    step={5}
                  />
                </div>
                <div>
                  <Label className="mb-1 block text-[11px]">
                    Break: {customBreak} min
                  </Label>
                  <Slider
                    value={[customBreak]}
                    onValueChange={v => setCustomBreak(v[0])}
                    min={1}
                    max={30}
                    step={1}
                  />
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 rounded-full bg-card"
                onClick={() => applyPreset("custom")}
              >
                Apply custom
              </Button>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="flex flex-col gap-3 lg:col-span-2">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <TimerIcon className="h-3.5 w-3.5" /> Today
            </div>
            <div className="mt-1 font-display text-2xl font-bold">
              {minutesToLabel(todayMinutes)}
            </div>
            <div className="text-xs text-muted-foreground">
              {todaySessions.length} session
              {todaySessions.length === 1 ? "" : "s"}
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Zap className="h-3.5 w-3.5" /> This week
            </div>
            <div className="mt-1 font-display text-2xl font-bold">
              {minutesToLabel(weekMinutes)}
            </div>
            <div className="text-xs text-muted-foreground">
              across all subjects
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/10 to-accent/30 p-4">
            <div className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-primary flame-pulse" />
              <span className="text-sm font-semibold">
                {streakLabel(state.streakDays)}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {state.streakDays === 0
                ? "Complete a focus session today to start your streak."
                : state.streakDays < 7
                  ? "Keep going — every session counts toward your streak."
                  : "You're on fire! Don't break the chain."}
            </p>
          </div>
          {todaySessions.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Today's sessions
              </div>
              <div className="flex flex-col gap-1.5">
                {todaySessions.map(f => (
                  <div
                    key={f.id}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="truncate">
                      {f.objective || f.subject || "General focus"}
                    </span>
                    <span className="font-medium">{f.duration} min</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
