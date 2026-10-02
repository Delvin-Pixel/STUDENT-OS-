import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useStore } from "@/contexts/StoreContext";
import {
  ensureFoundationChecks,
  foundationAssessmentContext,
  foundationQuizMetadata,
  foundationRemediationContext,
  foundationRemediationQuizMetadata,
  selectFoundationTargets,
} from "@/lib/foundationMonitor";
import { trpc } from "@/lib/trpc";
import { Brain, CheckCircle2, RefreshCw, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";

type Draft = {
  title: string;
  instructions: string;
  questions: Array<{
    prompt: string;
    options: string[];
    correctOptionIndex: number;
    explanation: string;
    difficulty?: "easy" | "medium" | "hard";
    subtopic?: string;
  }>;
};

export default function Foundation() {
  const { state, createQuiz, notify } = useStore();
  const [, navigate] = useLocation();
  const [activeCheckId, setActiveCheckId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const generating = trpc.learningDrafts.quiz.useMutation();
  const requestRef = useRef<string | null>(null);
  const checks = useMemo(() => {
    if (!state.profile) return [];
    return ensureFoundationChecks(
      state.profile,
      state.foundationChecks ?? []
    ).map(check => {
      const targets = selectFoundationTargets(check, state);
      return {
        ...check,
        focusTopicIds: targets.map(target => target.topicId),
        focusConcepts: targets.map(target => target.concept),
      };
    });
  }, [state]);
  const due = checks.filter(check => check.status === "due");
  const active = checks.find(check => check.id === activeCheckId) ?? null;

  useEffect(() => {
    if (active && !draft && !generating.isPending) generate(active);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCheckId]);

  function generate(check: NonNullable<typeof active>) {
    if (!state.profile) return;
    const remediation = check.attentionStatus === "needs_remediation";
    requestRef.current = check.id;
    generating.mutate(
      {
        subject: check.subject,
        topic: remediation
          ? `${check.sourceClassLevel} foundation remediation`
          : `${check.sourceClassLevel} foundation check`,
        educationLevel: state.profile.educationLevel,
        learningContext: remediation
          ? foundationRemediationContext(check)
          : foundationAssessmentContext(check),
        assessmentFocus: remediation
          ? {
              mode: "remediation_verification",
              focusConcepts: check.weakConcepts?.length
                ? check.weakConcepts
                : (check.focusConcepts?.slice(0, 4) ?? [
                    check.sourceClassLevel,
                  ]),
              weakConcepts: check.weakConcepts?.length
                ? check.weakConcepts
                : (check.focusConcepts?.slice(0, 4) ?? []),
              recentMisses: check.weakConcepts?.length
                ? check.weakConcepts
                : [],
              excludeQuestionPrompts: [],
              difficultyGuidance: "foundation",
              rationale:
                "Repair a localized foundation weakness with a short fresh check, then reassess the foundation.",
            }
          : {
              mode: "fresh_recheck",
              focusConcepts: check.focusConcepts?.length
                ? check.focusConcepts
                : [check.sourceClassLevel, check.subject],
              weakConcepts:
                check.focusConcepts?.filter((_, index) => index < 3) ?? [],
              recentMisses: [],
              excludeQuestionPrompts: [],
              difficultyGuidance: "foundation",
              rationale:
                "Verify important prior-level prerequisites without treating the learner as a beginner.",
            },
      },
      {
        onSuccess: value => {
          if (requestRef.current === check.id) setDraft(value);
        },
      }
    );
  }

  function saveAndTake() {
    if (!active || !draft) return;
    const questions = draft.questions
      .slice(0, 10)
      .map(q => ({ ...q, type: "multiple_choice" as const }));
    const remediation = active.attentionStatus === "needs_remediation";
    const id = createQuiz({
      title: remediation
        ? `Foundation Repair · ${active.subject} · ${active.sourceClassLevel}`
        : `Foundation Check · ${active.subject} · ${active.sourceClassLevel}`,
      subject: active.subject,
      topic: remediation
        ? `${active.sourceClassLevel} foundation remediation`
        : `${active.sourceClassLevel} foundation check`,
      source: "ai_draft",
      assessmentKind: remediation ? "foundation_remediation" : "foundation",
      ...(remediation
        ? foundationRemediationQuizMetadata(active)
        : foundationQuizMetadata(active)),
      questions,
    });
    if (!id) return;
    setDraft(null);
    setActiveCheckId(null);
    notify(
      "Foundation check ready. Complete it to refresh your long-term knowledge signal.",
      "success"
    );
    navigate(`/quizzes?quizId=${encodeURIComponent(id)}`);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Card className="border-primary/20 p-5">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Brain className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
              Foundation Monitor
            </p>
            <h1 className="mt-1 font-display text-2xl font-bold">
              Keep old foundations strong.
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Student OS never pushes you back to an old class. It occasionally
              checks important past-level knowledge so hidden gaps do not
              quietly follow you forward.
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge variant="secondary">
            Current: {state.profile?.classLevel ?? "Not set"}
          </Badge>
          <Badge variant="outline">Checks are periodic</Badge>
          <Badge variant="outline">No automatic demotion</Badge>
        </div>
      </Card>

      <Card className="border-primary/15 p-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <p className="font-semibold">Why this exists</p>
        </div>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          A student can move from SHS 1 to SHS 2 and still have a weak algebra
          or chemistry foundation. These checks turn that uncertainty into fresh
          evidence instead of assuming progression means mastery.
        </p>
      </Card>

      {checks
        .filter(check => check.attentionStatus === "needs_remediation")
        .map(check => (
          <Card
            key={`repair-${check.id}`}
            className="border-destructive/20 p-4"
          >
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 text-destructive" />
              <div className="flex-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-destructive">
                  Foundation repair
                </p>
                <h2 className="mt-1 font-display font-bold">
                  {check.subject} · {check.sourceClassLevel}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Student OS found a weak foundation signal around{" "}
                  {(check.weakConcepts ?? []).slice(0, 3).join(", ") ||
                    "one or more checked concepts"}
                  . Take a short targeted repair check before relying on the
                  foundation again.
                </p>
                <Button
                  className="mt-4 rounded-xl"
                  onClick={() => {
                    setDraft(null);
                    setActiveCheckId(check.id);
                  }}
                  disabled={generating.isPending}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Start targeted repair
                </Button>
              </div>
            </div>
          </Card>
        ))}

      {due.length === 0 ? (
        <Card className="p-5">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <h2 className="font-semibold">
                No foundation checks are due right now.
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Student OS will resurface prior-level checks based on time and
                your previous results.
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {due.map(check => (
            <Card key={check.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                    {check.subject}
                  </p>
                  <h2 className="mt-1 font-display font-bold">
                    {check.sourceClassLevel} foundation
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    You're currently in {check.currentClassLevel}. This is a
                    quick foundation check, not a class-placement test.
                  </p>
                </div>
                <Badge variant="secondary">Due</Badge>
              </div>
              <Button
                className="mt-4 w-full rounded-xl"
                onClick={() => {
                  setDraft(null);
                  setActiveCheckId(check.id);
                }}
                disabled={generating.isPending && activeCheckId === check.id}
              >
                {generating.isPending && activeCheckId === check.id ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Preparing check…
                  </>
                ) : (
                  "Run foundation check"
                )}
              </Button>
            </Card>
          ))}
        </div>
      )}

      {active && draft ? (
        <Card className="border-primary/20 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            Review before saving
          </p>
          <h2 className="mt-1 font-display text-xl font-bold">{draft.title}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Student OS generated a larger draft but this foundation check will
            save only the first 10 questions for a focused review.
          </p>
          <div className="mt-4 space-y-2">
            {draft.questions.slice(0, 10).map((q, i) => (
              <div key={`${q.prompt}-${i}`} className="rounded-xl border p-3">
                <p className="text-sm font-medium">
                  {i + 1}. {q.prompt}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={saveAndTake} className="rounded-xl">
              Save & take check
            </Button>
            <Button
              variant="outline"
              className="rounded-xl bg-card"
              onClick={() => {
                setDraft(null);
                setActiveCheckId(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </Card>
      ) : null}

      <Card className="p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Foundation history</h2>
          <Link href="/mastery" className="text-sm font-medium text-primary">
            View mastery
          </Link>
        </div>
        <div className="mt-3 space-y-2">
          {checks.map(check => (
            <div
              key={check.id}
              className="flex items-center justify-between gap-3 rounded-xl border p-3"
            >
              <div>
                <p className="font-medium">
                  {check.subject} · {check.sourceClassLevel}
                </p>
                <p className="text-xs text-muted-foreground">
                  {check.lastScore !== undefined
                    ? `Last score: ${check.lastScore}%`
                    : "Not assessed yet"}{" "}
                  · {check.attemptCount} check
                  {check.attemptCount === 1 ? "" : "s"}
                </p>
              </div>
              <Badge variant={check.status === "due" ? "secondary" : "outline"}>
                {check.status === "due" ? "Due" : "Monitored"}
              </Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
