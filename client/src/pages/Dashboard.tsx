/* STUDENT OS — Dashboard. Greeting, today's overview, today's schedule,
   quick actions, weekly chart, motivation, XP/streak. Daybreak style:
   soft cards, coral accents, asymmetric widget grid. */

import { ConfettiBurst } from "@/components/Confetti";
import DailyLesson from "@/components/DailyLesson";
import HabitsTracker from "@/components/HabitsTracker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useStore } from "@/contexts/StoreContext";
import { getDailyGoalProgress } from "@/lib/dailyGoal";
import { dueFoundationChecks } from "@/lib/foundationMonitor";
import {
  getNextActionHref,
  getRankedNextActions,
} from "@/lib/learningIntelligence";
import { appearanceToggleLabel } from "@/lib/presentationContracts";
import { quoteForToday } from "@/lib/quotes";
import {
  dayCountLabel,
  daysFromNow,
  formatTime,
  greeting,
  levelForXp,
  minutesToLabel,
  shortDay,
  streakLabel,
  subjectColor,
  todayStr,
  weekDays,
} from "@/lib/utils";
import {
  AlarmClock,
  ArrowRight,
  BookOpen,
  Brain,
  CalendarDays,
  ClipboardList,
  Flame,
  GraduationCap,
  Moon,
  Plus,
  Sparkles,
  Sun,
  Target,
  Timer,
  TrendingUp,
  Zap,
} from "lucide-react";
import { lazy, Suspense, useMemo, useState } from "react";
import { Link } from "wouter";

const WeeklyStudyChart = lazy(() => import("@/components/WeeklyStudyChart"));

export default function Dashboard() {
  const { state, completeTask, setTheme } = useStore();
  const foundationDueCount = dueFoundationChecks(state).length;
  const theme =
    state.settings.theme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : state.settings.theme;
  const profile = state.profile;
  const [burst, setBurst] = useState(0);

  const today = todayStr();
  const g = greeting();
  const quote = quoteForToday();

  const todaysTasks = state.tasks.filter(
    t => t.dueDate === today || (!t.dueDate && t.status !== "completed")
  );
  const tasksRemaining = todaysTasks.filter(
    t => t.status !== "completed"
  ).length;

  const todaysSessions = state.sessions.filter(
    s =>
      s.date === today &&
      ["planned", "in_progress", "paused", "completed"].includes(s.status)
  );
  const plannedMinutes = todaysSessions.reduce((a, s) => a + s.duration, 0);
  const completedMinutes = todaysSessions
    .filter(s => s.status === "completed")
    .reduce((a, s) => a + (s.actualDuration ?? s.duration), 0);
  const focusTodayMinutes = state.focusSessions
    .filter(f => f.date === today)
    .reduce((a, f) => a + f.duration, 0);
  const dailyGoal = getDailyGoalProgress(state, today);
  const recommendedActions = useMemo(
    () => getRankedNextActions(state, today),
    [state, today]
  );
  const nextAction = recommendedActions[0];

  const nextExam = useMemo(
    () =>
      [...state.exams]
        .map(e => ({ e, days: daysFromNow(e.date) }))
        .filter(x => x.days >= 0)
        .sort((a, b) => a.days - b.days)[0],
    [state.exams]
  );

  if (!profile) return null;

  const level = levelForXp(state.xp);

  /* weekly chart */
  const week = weekDays();
  const weekData = week.map(d => {
    const sess = state.sessions
      .filter(s => s.date === d && s.status === "completed")
      .reduce((a, s) => a + (s.actualDuration ?? s.duration), 0);
    const focus = state.focusSessions
      .filter(f => f.date === d)
      .reduce((a, f) => a + f.duration, 0);
    return {
      day: shortDay(d),
      minutes: Math.round(((sess + focus) / 60) * 10) / 10,
    };
  });

  const quickActions = [
    {
      label: "Start Focus",
      icon: Timer,
      route: "/focus",
      color: "bg-primary text-primary-foreground hover:bg-primary/90",
    },
    {
      label: "Add Task",
      icon: Plus,
      route: "/tasks",
      color: "bg-card text-foreground border border-border hover:bg-accent",
    },
    {
      label: "Study Now",
      icon: BookOpen,
      route: "/study",
      color: "bg-card text-foreground border border-border hover:bg-accent",
    },
    {
      label: "Add Flashcard",
      icon: Brain,
      route: "/flashcards",
      color: "bg-card text-foreground border border-border hover:bg-accent",
    },
    {
      label: "View Timetable",
      icon: CalendarDays,
      route: "/timetable",
      color: "bg-card text-foreground border border-border hover:bg-accent",
    },
  ];

  return (
    <div className="mx-auto max-w-4xl">
      {/* Greeting hero */}
      <div className="sunrise-sweep relative overflow-hidden rounded-3xl p-5 pr-24 text-primary-foreground shadow-lg sm:p-6 sm:pr-28">
        <button
          type="button"
          aria-label={appearanceToggleLabel(theme)}
          title={appearanceToggleLabel(theme)}
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="absolute right-4 top-4 z-20 flex items-center gap-1 rounded-full border border-white/30 bg-black/10 p-1 shadow-sm backdrop-blur-sm transition-transform duration-150 hover:bg-black/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white active:scale-95 sm:right-5 sm:top-5"
        >
          <span
            className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors ${theme === "light" ? "bg-white text-primary shadow-sm" : "text-white/75"}`}
          >
            <Sun className="h-4 w-4" aria-hidden="true" />
          </span>
          <span
            className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors ${theme === "dark" ? "bg-white text-primary shadow-sm" : "text-white/75"}`}
          >
            <Moon className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="sr-only">Light mode and dark mode</span>
        </button>
        <div className="relative z-10">
          <p className="text-xs font-semibold uppercase tracking-widest opacity-80">
            {g.sub}
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold sm:text-3xl">
            {g.text}, {profile.name} 👋
          </h1>
          <p className="mt-2 max-w-md text-sm opacity-90">
            “{quote.text}” —{" "}
            <span className="font-semibold">{quote.author}</span>
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div className="glass rounded-full px-3 py-1.5 text-sm font-semibold text-foreground shadow-sm">
              <Flame className="mr-1 inline h-4 w-4 text-primary flame-pulse" />
              {streakLabel(state.streakDays)}
            </div>
            <div className="glass rounded-full px-3 py-1.5 text-sm font-semibold text-foreground shadow-sm">
              <Zap className="mr-1 inline h-4 w-4 text-primary" />
              {state.xp} XP · Lv {level.current.level}
            </div>
          </div>
        </div>
        {/* decorative rings */}
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/15 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-14 -left-6 h-36 w-36 rounded-full bg-white/10 blur-2xl" />
      </div>

      {state.academicJourney &&
      (state.academicJourney.current.status === "awaiting_confirmation" ||
        state.academicJourney.current.status === "approaching_graduation") ? (
        <Card className="mt-4 overflow-hidden border-primary/25 bg-primary/[0.03] shadow-sm">
          <div className="flex items-start gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <GraduationCap className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
                Academic journey
              </p>
              <h2 className="mt-0.5 font-display text-base font-bold">
                A transition is approaching.
              </h2>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Student OS is preparing your next academic chapter. Your current
                level will not change until you confirm it.
              </p>
            </div>
            <Button asChild size="sm" className="shrink-0 rounded-full">
              <Link href="/journey">
                Open <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </Card>
      ) : null}

      {foundationDueCount > 0 ? (
        <Card className="mt-4 overflow-hidden border-primary/20 bg-primary/[0.03] shadow-sm">
          <div className="flex items-start gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Brain className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
                Foundation Monitor
              </p>
              <h2 className="mt-0.5 font-display text-base font-bold">
                {foundationDueCount} prior-level check
                {foundationDueCount === 1 ? " is" : "s are"} due.
              </h2>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Check an earlier class once in a while so hidden gaps do not
                follow you forward.
              </p>
            </div>
            <Button asChild size="sm" className="shrink-0 rounded-full">
              <Link href="/foundation">
                Review <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </Card>
      ) : null}

      {nextAction ? (
        <Card className="mt-4 overflow-hidden border-primary/25 bg-card shadow-md">
          <div className="flex items-start gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
                Recommended next step
              </p>
              <h2 className="mt-0.5 truncate font-display text-base font-bold">
                {nextAction.title}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {nextAction.detail} · {nextAction.duration} min
              </p>
              <p className="mt-2 text-xs leading-5 text-foreground/80">
                {nextAction.reason}
              </p>
            </div>
            <Button asChild size="sm" className="shrink-0 rounded-full">
              <Link href={getNextActionHref(nextAction)}>
                Start <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="mt-4 border-dashed p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-sm font-bold">
                Build your first recommendation
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Add an exam, task, session, or flashcard deck and Student OS
                will prioritise what matters today.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Persistent exam countdown widget */}
      {nextExam ? (
        <Link href="/exams" className="mt-4 block">
          <Card
            className={`lift-card flex items-center gap-3.5 overflow-hidden border-0 p-4 shadow-md ${nextExam.days <= 2 ? "bg-destructive/10 ring-1 ring-destructive/25" : "bg-card ring-1 ring-primary/15"}`}
          >
            <div
              className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-2xl ${nextExam.days <= 2 ? "bg-destructive text-destructive-foreground" : "sunrise-sweep text-primary-foreground"}`}
            >
              <GraduationCap className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <AlarmClock className="h-3 w-3" /> Exam countdown
              </div>
              <div className="truncate font-display text-base font-bold">
                {nextExam.e.subject} — {nextExam.e.name}
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {nextExam.e.date}
                {nextExam.days === 0
                  ? " — it's today, you've got this!"
                  : nextExam.days === 1
                    ? " — tomorrow!"
                    : ` — ${nextExam.days} days to go`}
              </div>
            </div>
            <div className="shrink-0 text-center">
              <div
                className={`font-display text-3xl font-black leading-none ${nextExam.days <= 2 ? "text-destructive" : "text-primary"}`}
              >
                {nextExam.days}
              </div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                days
              </div>
            </div>
          </Card>
        </Link>
      ) : (
        <Card className="mt-4 flex items-center gap-3 bg-card p-4 ring-1 ring-dashed ring-border">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-muted">
            <GraduationCap className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold">No exams yet</div>
            <div className="text-xs text-muted-foreground">
              Add one to unlock the live countdown.
            </div>
          </div>
          <Button
            asChild
            size="sm"
            variant="outline"
            className="rounded-full bg-card"
          >
            <Link href="/exams">Add exam</Link>
          </Button>
        </Card>
      )}

      <DailyLesson />

      <Card className="mt-4 overflow-hidden border-primary/15 bg-card p-4 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Target className="h-4 w-4 text-primary" /> Daily learning goal
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {dailyGoal.complete
                ? "Goal reached — excellent work today."
                : `${dailyGoal.remainingMinutes} minutes to go. Every focused block counts.`}
            </p>
          </div>
          <div className="text-right">
            <div className="font-display text-lg font-bold text-primary">
              {dailyGoal.completedMinutes}/{dailyGoal.targetMinutes}
            </div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              minutes
            </div>
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300"
            style={{ width: `${dailyGoal.percent}%` }}
          />
        </div>
        <div className="mt-3 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            Longest streak:{" "}
            <strong className="text-foreground">
              {dayCountLabel(state.longestStreak)}
            </strong>
          </span>
          <Link href="/focus" className="font-medium text-primary">
            Study now
          </Link>
        </div>
      </Card>

      {/* Today's overview */}
      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <OverviewTile
          icon={ClipboardList}
          label="Tasks remaining"
          value={String(tasksRemaining)}
        />
        <OverviewTile
          icon={Timer}
          label="Study planned"
          value={minutesToLabel(plannedMinutes)}
        />
        <OverviewTile
          icon={TrendingUp}
          label="Study completed"
          value={minutesToLabel(completedMinutes)}
        />
        <OverviewTile
          icon={Zap}
          label="Focus today"
          value={minutesToLabel(focusTodayMinutes)}
        />
        <OverviewTile
          icon={Target}
          label="Next exam"
          value={nextExam ? `in ${nextExam.days}d` : "None"}
        />
        <OverviewTile
          icon={Flame}
          label="Current streak"
          value={dayCountLabel(state.streakDays)}
          highlight={state.streakDays >= 3}
        />
      </section>

      {/* Today's schedule */}
      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold">Today’s Plan</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Your scheduled work and highest-value next actions.
            </p>
          </div>
          <Link href="/timetable" className="text-xs font-medium text-primary">
            View week
          </Link>
        </div>
        {todaysSessions.length === 0 &&
        todaysTasks.length === 0 &&
        recommendedActions.length === 0 ? (
          <Card className="p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Nothing scheduled for today. Plan a study session or add a task to
              get started.
            </p>
            <div className="mt-3 flex justify-center gap-2">
              <Button asChild size="sm" className="rounded-full">
                <Link href="/study">Plan session</Link>
              </Button>
              <Button
                asChild
                size="sm"
                variant="outline"
                className="rounded-full bg-card"
              >
                <Link href="/tasks">Add task</Link>
              </Button>
            </div>
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            {recommendedActions.slice(0, 3).map((action, index) => (
              <Link
                key={action.id}
                href={getNextActionHref(action)}
                className="block"
              >
                <Card className="flex items-center gap-3 border-primary/15 bg-primary/[0.035] p-3.5 lift-card">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-xs font-bold text-primary">
                    {index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">
                      {action.title}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {action.detail} · {action.duration} min
                    </div>
                  </div>
                  <ArrowRight
                    className="h-4 w-4 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                </Card>
              </Link>
            ))}
            {todaysSessions.map(s => (
              <Card
                key={s.id}
                className="flex items-center gap-3 p-3.5 lift-card"
              >
                <div
                  className={`h-10 w-1 shrink-0 rounded-full ${subjectColor(s.subject).bar}`}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">
                    {formatTime(s.startTime)} — {s.subject}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {s.topic} · {s.duration} min
                  </div>
                </div>
                <Badge
                  variant={s.status === "completed" ? "secondary" : "outline"}
                  className="shrink-0 capitalize"
                >
                  {s.status.replace("_", " ")}
                </Badge>
              </Card>
            ))}
            {todaysTasks.map(t => (
              <Card
                key={t.id}
                className="flex items-center gap-3 p-3.5 lift-card"
              >
                <button
                  onClick={() => {
                    if (t.status !== "completed" && completeTask(t.id)) {
                      setBurst(b => b + 1);
                    }
                  }}
                  aria-label={
                    t.status === "completed"
                      ? "Task complete"
                      : "Mark task complete"
                  }
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                    t.status === "completed"
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-muted-foreground/40"
                  }`}
                >
                  {t.status === "completed" && (
                    <ClipboardList className="h-3 w-3" />
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <div
                    className={`truncate text-sm font-medium ${t.status === "completed" ? "text-muted-foreground line-through" : ""}`}
                  >
                    {t.title}
                  </div>
                  {t.subject && (
                    <div className="truncate text-xs text-muted-foreground">
                      {t.subject}
                    </div>
                  )}
                </div>
                {t.priority === "high" && t.status !== "completed" && (
                  <Badge className="bg-destructive/10 text-destructive shrink-0">
                    High
                  </Badge>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Habits */}
      <section className="relative mt-6">
        <HabitsTracker />
        <ConfettiBurst trigger={burst} />
      </section>

      {/* Quick actions */}
      <section className="mt-6">
        <h2 className="mb-3 font-display text-lg font-semibold">
          Quick actions
        </h2>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
          {quickActions.map(a => (
            <Button
              key={a.label}
              asChild
              variant="outline"
              className={`h-16 flex-col gap-1 rounded-xl ${a.color}`}
            >
              <Link href={a.route} className="flex flex-col items-center gap-1">
                <a.icon className="h-4.5 w-4.5" />
                <span className="text-xs font-medium">{a.label}</span>
              </Link>
            </Button>
          ))}
        </div>
      </section>

      {/* Weekly chart + motivation */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="p-4 lg:col-span-2">
          <h3 className="font-display text-sm font-semibold">
            Study this week (hours)
          </h3>
          <div className="mt-2 h-44">
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                  Loading study chart…
                </div>
              }
            >
              <WeeklyStudyChart data={weekData} />
            </Suspense>
          </div>
        </Card>

        <Card className="flex flex-col justify-between bg-gradient-to-br from-primary/10 via-accent/40 to-card p-5">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-primary">
              Today's motivation
            </div>
            <p className="mt-2 font-display text-lg font-semibold leading-snug">
              “{quote.text}”
            </p>
          </div>
          <div className="mt-4 text-xs text-muted-foreground">
            Level {level.current.level} · {level.current.name}
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${Math.round(level.progress * 100)}%` }}
              />
            </div>
            {level.next && (
              <div className="mt-1">
                {level.nextMin - state.xp} XP to Level {level.next.level}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Recently unlocked achievements */}
      {state.achievements.filter(a => a.unlocked).length > 0 && (
        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Achievements</h2>
            <Link href="/progress" className="text-xs font-medium text-primary">
              View all
            </Link>
          </div>
          <div className="flex flex-wrap gap-2">
            {state.achievements
              .filter(a => a.unlocked)
              .slice(0, 4)
              .map(a => (
                <Badge
                  key={a.id}
                  variant="secondary"
                  className="rounded-full px-3 py-1.5 text-xs font-medium"
                >
                  {a.name}
                </Badge>
              ))}
          </div>
        </section>
      )}
    </div>
  );
}

function OverviewTile({
  icon: Icon,
  label,
  value,
  highlight,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <Card className={`p-3.5 ${highlight ? "ring-1 ring-primary/30" : ""}`}>
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="mt-1 font-display text-xl font-bold">{value}</div>
    </Card>
  );
}
