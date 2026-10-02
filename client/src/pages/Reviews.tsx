import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useStore } from "@/contexts/StoreContext";
import {
  getDueReviewQueue,
  getNextActionHref,
} from "@/lib/learningIntelligence";
import { buildDailyReview, buildWeeklyReview } from "@/lib/reviewInsights";
import { minutesToLabel } from "@/lib/utils";
import {
  CalendarCheck2,
  CheckCircle2,
  Clock3,
  RotateCw,
  Sparkles,
  Target,
} from "lucide-react";
import { Link } from "wouter";

export default function Reviews() {
  const { state } = useStore();
  const daily = buildDailyReview(state);
  const weekly = buildWeeklyReview(state);
  const reviewQueue = getDueReviewQueue(state);
  return (
    <div className="mx-auto max-w-4xl">
      <header>
        <div className="flex items-center gap-2 text-primary">
          <CalendarCheck2 className="h-5 w-5" />
          <span className="text-xs font-bold uppercase tracking-[0.16em]">
            Reflection loop
          </span>
        </div>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">
          Daily & weekly review
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Review real completed work and direct checks, then choose the next
          worthwhile action. Student OS distinguishes plans from completed
          evidence.
        </p>
      </header>
      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          icon={Clock3}
          label="Planner minutes"
          value={minutesToLabel(daily.completedPlannerMinutes)}
        />
        <Metric
          icon={Clock3}
          label="Focus minutes"
          value={minutesToLabel(daily.focusMinutes)}
        />
        <Metric
          icon={CheckCircle2}
          label="Tasks completed"
          value={String(daily.completedTasks)}
        />
        <Metric
          icon={Target}
          label="Direct checks"
          value={String(daily.quizAttempts.length)}
        />
      </section>
      <Card className="mt-5 border-primary/20 bg-primary/[0.035] p-5">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              Next best action
            </p>
            {daily.nextAction ? (
              <>
                <h2 className="mt-1 font-display text-lg font-bold">
                  {daily.nextAction.title}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {daily.nextAction.reason} Allow about{" "}
                  {daily.nextAction.duration} minutes.
                </p>
              </>
            ) : (
              <>
                <h2 className="mt-1 font-display text-lg font-bold">
                  You are clear for now
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Add an exam, task, session, or flashcard deck to make the next
                  recommendation more specific.
                </p>
              </>
            )}
          </div>
          {daily.nextAction && (
            <Button asChild size="sm" className="shrink-0 rounded-full">
              <Link href={getNextActionHref(daily.nextAction)}>Open</Link>
            </Button>
          )}
        </div>
      </Card>
      <Card className="mt-5 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <RotateCw className="h-5 w-5 text-primary" />
              <h2 className="font-display text-lg font-semibold">
                Today’s reviews
              </h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {reviewQueue.total
                ? `${reviewQueue.total} card${reviewQueue.total === 1 ? "" : "s"} are due under your existing recall schedule.`
                : "No cards are due right now. New cards will appear here naturally when you start reviewing."}
            </p>
          </div>
          <Button
            asChild
            size="sm"
            variant="outline"
            className="shrink-0 rounded-full bg-card"
          >
            <Link href="/flashcards">Open reviews</Link>
          </Button>
        </div>
        {reviewQueue.subjects.length > 0 && (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {reviewQueue.subjects.map(entry => (
              <div key={entry.subject} className="rounded-xl bg-muted/60 p-3">
                <p className="text-sm font-medium">{entry.subject}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {entry.count} card{entry.count === 1 ? "" : "s"} due
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>
      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <h2 className="font-display text-lg font-semibold">
            Today’s reflection
          </h2>
          <div className="mt-4 space-y-3 text-sm">
            <p>
              <strong>{daily.completedSessions}</strong> completed planner
              session{daily.completedSessions === 1 ? "" : "s"}, with{" "}
              <strong>{minutesToLabel(daily.completedPlannerMinutes)}</strong>{" "}
              confirmed planner time and{" "}
              <strong>{minutesToLabel(daily.focusMinutes)}</strong> recorded
              separately by Focus.
            </p>
            <p>
              {daily.quizAttempts.length
                ? `You completed ${daily.quizAttempts.length} direct knowledge check${daily.quizAttempts.length === 1 ? "" : "s"}.`
                : "No direct knowledge check yet today — a short quiz can replace estimates with stronger evidence."}
            </p>
            {daily.weakTopic && (
              <p className="rounded-xl bg-muted/60 p-3 text-muted-foreground">
                Lowest current topic estimate:{" "}
                <strong className="text-foreground">
                  {daily.weakTopic.subject} — {daily.weakTopic.topic} (
                  {daily.weakTopic.score}%)
                </strong>
                {daily.weakTopic.estimated
                  ? ". This is still an estimate; use practice to confirm it."
                  : "."}
              </p>
            )}
          </div>
        </Card>
        <Card className="p-5">
          <h2 className="font-display text-lg font-semibold">This week</h2>
          <div className="mt-4 space-y-3 text-sm">
            <p>
              <strong>{minutesToLabel(weekly.completedPlannerMinutes)}</strong>{" "}
              completed planner time across{" "}
              <strong>{weekly.completedSessions}</strong> session
              {weekly.completedSessions === 1 ? "" : "s"}; Focus adds{" "}
              <strong>{minutesToLabel(weekly.focusMinutes)}</strong> as a
              separate signal.
            </p>
            <p>
              <strong>{minutesToLabel(weekly.scheduledMinutes)}</strong> remains
              scheduled and is not counted as completed.
            </p>
            <p>
              <strong>{weekly.completedTasks}</strong> task
              {weekly.completedTasks === 1 ? "" : "s"} completed.
            </p>
            <p>
              {weekly.averageQuizScore === null
                ? "No weekly quiz average yet. A direct check gives the review a clearer signal."
                : `Average direct quiz score: ${weekly.averageQuizScore}%.`}
            </p>
            <Button
              asChild
              variant="outline"
              className="mt-2 rounded-full bg-card"
            >
              <Link href="/mastery">Review mastery</Link>
            </Button>
          </div>
        </Card>
      </section>
    </div>
  );
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
