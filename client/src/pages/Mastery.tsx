import { ProgressBar } from "@/components/AppBits";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useStore } from "@/contexts/StoreContext";
import { getAssessmentIntelligence } from "@/lib/assessmentIntelligence";
import { getEvidenceQualitySummary } from "@/lib/assessmentTrust";
import {
  getTopicMastery,
  getTopicRecommendationHref,
} from "@/lib/learningIntelligence";
import {
  BrainCircuit,
  CircleAlert,
  ClipboardCheck,
  GraduationCap,
} from "lucide-react";
import { useMemo } from "react";
import { Link } from "wouter";

export default function Mastery() {
  const { state } = useStore();
  const mastery = useMemo(
    () => getTopicMastery(state).sort((a, b) => a.score - b.score),
    [state]
  );
  const weak = mastery.filter(item => item.score < 60);
  const subjectSummary = useMemo(() => {
    const groups = new Map<string, typeof mastery>();
    mastery.forEach(item =>
      groups.set(item.subject, [...(groups.get(item.subject) ?? []), item])
    );
    return Array.from(groups.entries()).map(([subject, items]) => ({
      subject,
      score: Math.round(
        items.reduce((sum, item) => sum + item.score, 0) / items.length
      ),
      items,
    }));
  }, [mastery]);
  const attemptsByTopic = useMemo(() => {
    const result = new Map<string, typeof state.quizAttempts>();
    state.quizAttempts.forEach(attempt => {
      if (attempt.topicId)
        result.set(attempt.topicId, [
          ...(result.get(attempt.topicId) ?? []),
          attempt,
        ]);
    });
    return result;
  }, [state]);
  const evidenceQuality = useMemo(
    () => getEvidenceQualitySummary(state.learningEvidence),
    [state.learningEvidence]
  );
  const assessmentByTopic = useMemo(
    () =>
      new Map(
        mastery.map(item => [
          item.topicId,
          getAssessmentIntelligence(state, item.topicId),
        ])
      ),
    [mastery, state]
  );

  return (
    <div className="mx-auto max-w-4xl">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-primary">
            <BrainCircuit className="h-5 w-5" />
            <span className="text-xs font-bold uppercase tracking-[0.16em]">
              Evidence-based learning
            </span>
          </div>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">
            Mastery & weak topics
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Scores prioritise recent quiz and practice outcomes, then flashcard
            recall. Study time adds only small supporting credit, so time alone
            never looks like mastery.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" className="rounded-full bg-card">
            <Link href="/quizzes">Take a quiz</Link>
          </Button>
          <Button asChild className="rounded-full">
            <Link href="/quiz-drafts">Generate draft</Link>
          </Button>
        </div>
      </header>
      {mastery.length === 0 ? (
        <Card className="mt-6 p-7 text-center">
          <GraduationCap className="mx-auto h-8 w-8 text-primary" />
          <h2 className="mt-3 font-display text-lg font-bold">
            Build your first evidence trail
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Add an exam topic, then link a quiz, deck, or session to it. Student
            OS will show a transparent estimate rather than inventing a score.
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Button asChild className="rounded-full">
              <Link href="/exams">Add exam</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full bg-card">
              <Link href="/quizzes">Create quiz</Link>
            </Button>
          </div>
        </Card>
      ) : (
        <>
          <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Topics tracked
              </p>
              <p className="mt-1 font-display text-3xl font-bold">
                {mastery.length}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Need focused review
              </p>
              <p className="mt-1 font-display text-3xl font-bold text-primary">
                {weak.length}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Trusted direct checks
              </p>
              <p className="mt-1 font-display text-3xl font-bold">
                {mastery.reduce(
                  (sum, item) => sum + item.directEvidenceCount,
                  0
                )}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Evidence trust
              </p>
              <p className="mt-1 font-display text-3xl font-bold">
                {evidenceQuality.trustScore}%
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {evidenceQuality.rejected} rejected · {evidenceQuality.weak}{" "}
                weak
              </p>
            </Card>
          </section>
          {weak.length > 0 && (
            <Card className="mt-5 border-primary/20 bg-primary/[0.035] p-4">
              <div className="flex items-start gap-3">
                <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <h2 className="font-display text-base font-bold">
                    Highest-value review
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {weak[0].subject} — {weak[0].topic} is the lowest current
                    estimate.{" "}
                    {weak[0].estimated
                      ? "Use a short quiz or practice check to replace this estimate with direct evidence."
                      : "A focused session followed by a short quiz can improve retention."}
                  </p>
                </div>
                <Button asChild size="sm" className="shrink-0 rounded-full">
                  <Link
                    href={getTopicRecommendationHref(
                      weak[0].estimated ? "/quizzes" : "/study",
                      weak[0].topicId
                    )}
                  >
                    {weak[0].estimated ? "Check understanding" : "Plan review"}
                  </Link>
                </Button>
              </div>
            </Card>
          )}
          <section className="mt-6">
            <h2 className="font-display text-lg font-semibold">By subject</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {subjectSummary.map(summary => (
                <Card key={summary.subject} className="p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">{summary.subject}</h3>
                    <span className="font-display text-lg font-bold text-primary">
                      {summary.score}%
                    </span>
                  </div>
                  <ProgressBar value={summary.score} className="mt-3" />
                  <p className="mt-2 text-xs text-muted-foreground">
                    {summary.items.length} linked topic
                    {summary.items.length === 1 ? "" : "s"}
                  </p>
                </Card>
              ))}
            </div>
          </section>
          <section className="mt-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">
                Topic detail
              </h2>
              <span className="text-xs text-muted-foreground">
                Lowest estimate first
              </span>
            </div>
            <div className="mt-3 flex flex-col gap-2">
              {mastery.map(item => {
                const attempts = (attemptsByTopic.get(item.topicId) ?? [])
                  .slice(-3)
                  .reverse();
                const last = attempts[0];
                const action =
                  item.estimated || !last
                    ? { route: "/quizzes" as const, label: "Run a check" }
                    : item.score < 60
                      ? { route: "/quizzes" as const, label: "Review & retry" }
                      : { route: "/study" as const, label: "Plan retention" };
                return (
                  <Card key={item.topicId} className="p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">
                          {item.subject} — {item.topic}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {item.directEvidenceCount
                            ? `${item.directEvidenceCount} direct check${item.directEvidenceCount === 1 ? "" : "s"}`
                            : "No direct check yet"}{" "}
                          · {item.evidenceCount} total signal
                          {item.evidenceCount === 1 ? "" : "s"} ·{" "}
                          {item.confidence}% confidence · {item.freshness}%
                          fresh
                        </p>
                      </div>
                      <Badge
                        variant={
                          item.score < 60
                            ? "destructive"
                            : item.score < 75
                              ? "secondary"
                              : "default"
                        }
                      >
                        {item.score}%
                      </Badge>
                      {item.estimated && (
                        <Badge variant="outline">Estimate</Badge>
                      )}
                    </div>
                    <ProgressBar value={item.score} className="mt-3" />
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Readiness {item.readiness}% · exam pressure{" "}
                      {item.examPressure}%
                    </p>
                    {assessmentByTopic.get(item.topicId)?.primarySignal && (
                      <div className="mt-2 rounded-xl border bg-card p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold">
                            Assessment signal:{" "}
                            {
                              assessmentByTopic.get(item.topicId)?.primarySignal
                                ?.label
                            }
                          </span>
                          <Badge
                            variant={
                              assessmentByTopic.get(item.topicId)?.primarySignal
                                ?.severity === "high"
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            {
                              assessmentByTopic.get(item.topicId)?.primarySignal
                                ?.severity
                            }
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {assessmentByTopic.get(item.topicId)?.remediation}
                        </p>
                      </div>
                    )}
                    <div className="mt-3 flex flex-col gap-2 rounded-xl bg-muted/50 p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                        <ClipboardCheck className="h-3.5 w-3.5 shrink-0 text-primary" />
                        {last ? (
                          <span>
                            Latest direct check:{" "}
                            <strong className="text-foreground">
                              {last.score}%
                            </strong>{" "}
                            · {last.correctCount}/{last.questionCount} correct
                          </span>
                        ) : (
                          <span>
                            No direct quiz evidence yet. This remains an
                            estimate, not a verdict.
                          </span>
                        )}
                      </div>
                      <Button
                        asChild
                        size="sm"
                        variant="outline"
                        className="shrink-0 rounded-full bg-card"
                      >
                        <Link
                          href={getTopicRecommendationHref(
                            action.route,
                            item.topicId
                          )}
                        >
                          {action.label}
                        </Link>
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
