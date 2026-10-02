import { useAuth } from "@/_core/hooks/useAuth";
import { BrandedEmpty } from "@/components/AppBits";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { useStore } from "@/contexts/StoreContext";
import { scoreQuiz } from "@/lib/quizAssessment";
import { validateNewQuiz } from "@/lib/quizValidation";
import { trpc } from "@/lib/trpc";
import type { StudyQuiz } from "@/lib/types";
import {
  BrainCircuit,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Plus,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";

export function getQuizRecommendationTopicId(location: string) {
  const queryIndex = location.indexOf("?");
  if (queryIndex < 0) return null;
  const topicId = new URLSearchParams(location.slice(queryIndex + 1))
    .get("topicId")
    ?.trim();
  return topicId || null;
}

export function getQuizIdFromLocation(location: string) {
  const queryIndex = location.indexOf("?");
  if (queryIndex < 0) return null;
  const quizId = new URLSearchParams(location.slice(queryIndex + 1))
    .get("quizId")
    ?.trim();
  return quizId || null;
}

export function trustedAssessmentStorageKey(
  quizId: string,
  accountScope = "anonymous"
) {
  const safeScope =
    accountScope.trim().replace(/[^a-zA-Z0-9._:-]/g, "_") || "anonymous";
  return `student-os:trusted-assessment:${safeScope}:${quizId}`;
}

export default function Quizzes() {
  const { state } = useStore();
  const [location] = useLocation();
  const [builderOpen, setBuilderOpen] = useState(false);
  const [builderRecommendedTopicId, setBuilderRecommendedTopicId] = useState<
    string | null
  >(null);
  const [activeQuizId, setActiveQuizId] = useState<string | null>(null);
  const [trustedQuizId, setTrustedQuizId] = useState<string | null>(null);
  const autoOpenedRecommendationRef = useRef<string | null>(null);
  const recommendedTopicId = getQuizRecommendationTopicId(location);
  const requestedQuizId = getQuizIdFromLocation(location);
  const isAiQuizLibrary = location.startsWith("/ai-quiz");
  const displayedQuizzes = isAiQuizLibrary
    ? state.quizzes.filter(quiz => quiz.source === "ai_draft")
    : state.quizzes;
  const hasRecommendedTopic = Boolean(
    recommendedTopicId &&
    [
      ...state.topics.map(topic => topic.id),
      ...state.exams.flatMap(exam => exam.topics.map(topic => topic.id)),
    ].includes(recommendedTopicId)
  );

  useEffect(() => {
    if (
      !recommendedTopicId ||
      !hasRecommendedTopic ||
      autoOpenedRecommendationRef.current === recommendedTopicId
    )
      return;
    autoOpenedRecommendationRef.current = recommendedTopicId;
    setBuilderRecommendedTopicId(recommendedTopicId);
    setBuilderOpen(true);
  }, [hasRecommendedTopic, recommendedTopicId]);
  useEffect(() => {
    if (
      !requestedQuizId ||
      !displayedQuizzes.some(quiz => quiz.id === requestedQuizId)
    )
      return;
    setActiveQuizId(requestedQuizId);
  }, [displayedQuizzes, requestedQuizId]);
  const quiz =
    state.quizzes.find(candidate => candidate.id === activeQuizId) ?? null;
  const trustedQuiz =
    state.quizzes.find(candidate => candidate.id === trustedQuizId) ?? null;

  if (quiz)
    return <QuizRunner quiz={quiz} onExit={() => setActiveQuizId(null)} />;
  if (trustedQuiz)
    return (
      <TrustedAssessmentRunner
        quiz={trustedQuiz}
        onExit={() => setTrustedQuizId(null)}
      />
    );

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">
            {isAiQuizLibrary ? "My AI Quizzes" : "Practice Quizzes"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Test understanding, not just study time. Results update connected
            topic evidence when a quiz is linked to an exam topic.
          </p>
        </div>
        {isAiQuizLibrary ? (
          <Button asChild variant="sunrise" className="shrink-0">
            <Link href="/ai-quiz">
              <Sparkles className="mr-1.5 h-4 w-4" /> Generate AI Quiz
            </Link>
          </Button>
        ) : (
          <Button
            variant="sunrise"
            className="shrink-0"
            onClick={() => {
              setBuilderRecommendedTopicId(null);
              setBuilderOpen(true);
            }}
          >
            <Plus className="mr-1.5 h-4 w-4" /> New quiz
          </Button>
        )}
      </div>

      {displayedQuizzes.length === 0 ? (
        <div className="mt-6">
          <BrandedEmpty
            icon={BrainCircuit}
            title={
              isAiQuizLibrary ? "No AI Quizzes yet" : "No practice quizzes yet"
            }
            text={
              isAiQuizLibrary
                ? "Generate a reviewed AI Quiz from one of your saved subjects or courses, then answer and grade it here."
                : "Create a short quiz for an exam topic."
            }
            actionLabel={isAiQuizLibrary ? "Generate AI Quiz" : "Create quiz"}
            onAction={() => {
              if (isAiQuizLibrary) window.location.assign("/ai-quiz");
              else {
                setBuilderRecommendedTopicId(null);
                setBuilderOpen(true);
              }
            }}
          />
        </div>
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {displayedQuizzes.map(item => {
            const attempts = state.quizAttempts.filter(
              attempt => attempt.quizId === item.id
            );
            const last = attempts.at(-1);
            return (
              <Card key={item.id} className="p-4 lift-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                      {item.subject}
                      {item.topic ? ` · ${item.topic}` : ""}
                    </p>
                    <h2 className="mt-1 truncate font-display text-base font-bold">
                      {item.title}
                    </h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.questions.length} question
                      {item.questions.length === 1 ? "" : "s"} ·{" "}
                      {item.source === "manual"
                        ? "Learner-created"
                        : "Reviewable AI draft"}
                    </p>
                  </div>
                  <BrainCircuit className="h-5 w-5 shrink-0 text-primary" />
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">
                    {last
                      ? `Last practice score: ${last.score}%`
                      : "Not attempted"}
                  </span>
                  <div className="flex gap-2">
                    {item.questions.length === 50 ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-full"
                        onClick={() => setTrustedQuizId(item.id)}
                      >
                        Timed assessment
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      className="rounded-full"
                      onClick={() => setActiveQuizId(item.id)}
                    >
                      Practice
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      {!isAiQuizLibrary ? (
        <QuizBuilder
          open={builderOpen}
          recommendedTopicId={builderRecommendedTopicId}
          onOpenChange={open => {
            setBuilderOpen(open);
            if (!open) setBuilderRecommendedTopicId(null);
          }}
        />
      ) : null}
    </div>
  );
}

function QuizBuilder({
  open,
  recommendedTopicId,
  onOpenChange,
}: {
  open: boolean;
  recommendedTopicId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { state, createQuiz } = useStore();
  const topicOptions = useMemo(
    () =>
      Array.from(
        new Map([
          ...state.topics.map(
            topic =>
              [
                topic.id,
                { id: topic.id, name: topic.name, subject: topic.subject },
              ] as const
          ),
          ...state.exams.flatMap(exam =>
            exam.topics.map(
              topic =>
                [
                  topic.id,
                  { id: topic.id, name: topic.name, subject: exam.subject },
                ] as const
            )
          ),
        ]).values()
      ),
    [state.exams, state.topics]
  );
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [topicId, setTopicId] = useState("");
  const [prompt, setPrompt] = useState("");
  const [optionA, setOptionA] = useState("");
  const [optionB, setOptionB] = useState("");
  const [correct, setCorrect] = useState("0");
  const [explanation, setExplanation] = useState("");
  const [error, setError] = useState("");
  const saveClaimRef = useRef(false);
  const selectedTopic = topicOptions.find(topic => topic.id === topicId);

  useEffect(() => {
    if (!open) saveClaimRef.current = false;
    else if (
      recommendedTopicId &&
      topicOptions.some(topic => topic.id === recommendedTopicId)
    )
      setTopicId(recommendedTopicId);
  }, [open, recommendedTopicId, topicOptions]);

  const save = () => {
    const chosenSubject = selectedTopic?.subject ?? subject.trim();
    const quiz = {
      title: title.trim(),
      subject: chosenSubject,
      topic: selectedTopic?.name ?? "",
      ...(selectedTopic ? { topicId: selectedTopic.id } : {}),
      source: "manual" as const,
      questions: [
        {
          prompt: prompt.trim(),
          type: "multiple_choice" as const,
          options: [optionA.trim(), optionB.trim()],
          correctOptionIndex: Number(correct),
          explanation: explanation.trim(),
        },
      ],
    };
    const validationError = validateNewQuiz(quiz);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (saveClaimRef.current) return;
    saveClaimRef.current = true;
    const accepted = createQuiz(quiz);
    if (!accepted) {
      saveClaimRef.current = false;
      setError("We could not save that quiz. Your details are still here.");
      return;
    }
    setTitle("");
    setSubject("");
    setTopicId("");
    setPrompt("");
    setOptionA("");
    setOptionB("");
    setCorrect("0");
    setExplanation("");
    setError("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">
            Create a practice quiz
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <p className="rounded-xl bg-primary/5 p-3 text-xs leading-5 text-muted-foreground">
            Start with one well-written question. You can create several focused
            quizzes, and an upcoming AI workflow will always present drafts for
            your review before saving.
          </p>
          <div>
            <Label className="mb-1.5 block text-xs font-semibold">
              Quiz title
            </Label>
            <Input
              value={title}
              onChange={event => setTitle(event.target.value)}
              placeholder="e.g. Waves quick check"
              className="rounded-xl"
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-semibold">
              Link to an exam topic{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </Label>
            <Select
              value={topicId || "_none"}
              onValueChange={value =>
                setTopicId(value === "_none" ? "" : value)
              }
            >
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">No linked exam topic</SelectItem>
                {topicOptions.map(topic => (
                  <SelectItem key={topic.id} value={topic.id}>
                    {topic.subject} — {topic.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {!selectedTopic && (
            <div>
              <Label className="mb-1.5 block text-xs font-semibold">
                Subject
              </Label>
              <Input
                value={subject}
                onChange={event => setSubject(event.target.value)}
                placeholder="e.g. Physics"
                className="rounded-xl"
              />
            </div>
          )}
          <div>
            <Label className="mb-1.5 block text-xs font-semibold">
              Question
            </Label>
            <Input
              value={prompt}
              onChange={event => setPrompt(event.target.value)}
              placeholder="What happens when…"
              className="rounded-xl"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="mb-1.5 block text-xs font-semibold">
                Option A
              </Label>
              <Input
                value={optionA}
                onChange={event => setOptionA(event.target.value)}
                className="rounded-xl"
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs font-semibold">
                Option B
              </Label>
              <Input
                value={optionB}
                onChange={event => setOptionB(event.target.value)}
                className="rounded-xl"
              />
            </div>
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-semibold">
              Correct option
            </Label>
            <Select value={correct} onValueChange={setCorrect}>
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Option A</SelectItem>
                <SelectItem value="1">Option B</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-semibold">
              Explanation{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </Label>
            <Input
              value={explanation}
              onChange={event => setExplanation(event.target.value)}
              placeholder="Why is this correct?"
              className="rounded-xl"
            />
          </div>
          {error && (
            <p className="text-xs font-medium text-destructive">{error}</p>
          )}
          <Button variant="sunrise" onClick={save}>
            Save quiz
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TrustedAssessmentRunner({
  quiz,
  onExit,
}: {
  quiz: StudyQuiz;
  onExit: () => void;
}) {
  const { user } = useAuth();
  const start = trpc.assessments.start.useMutation();
  const saveResponse = trpc.assessments.saveResponse.useMutation();
  const submit = trpc.assessments.submit.useMutation();
  const storageKey = trustedAssessmentStorageKey(
    quiz.id,
    user?.openId ?? "anonymous"
  );
  const [resumedSessionId, setResumedSessionId] = useState<number | null>(
    () => {
      const parsed = Number(window.sessionStorage.getItem(storageKey));
      return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
    }
  );
  const resumed = trpc.assessments.read.useQuery(
    { sessionId: resumedSessionId ?? 1 },
    { enabled: resumedSessionId !== null, retry: false }
  );
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    score: number;
    correctCount: number;
    questionCount: number;
    grade: string;
    performance: string;
  } | null>(null);
  const startClaimRef = useRef(false);

  useEffect(() => {
    if (!resumed.data) return;
    setAnswers(
      Object.fromEntries(
        resumed.data.responses.map(response => [
          response.questionOrdinal,
          response.selectedOptionIndex,
        ])
      )
    );
    if (resumed.data.result) setResult(resumed.data.result);
  }, [resumed.data]);

  useEffect(() => {
    if (!resumed.isError || resumedSessionId === null) return;
    window.sessionStorage.removeItem(storageKey);
    setResumedSessionId(null);
    setError(
      "Your saved assessment could not be resumed in this account. You can safely start a new timed assessment."
    );
  }, [resumed.isError, resumedSessionId, storageKey]);

  const session =
    start.data ??
    (resumed.data
      ? {
          sessionId: resumed.data.sessionId,
          status: resumed.data.status,
          expiresAt: resumed.data.expiresAt,
          questions: resumed.data.questions,
        }
      : undefined);
  const question = session?.questions[index];
  const begin = async () => {
    if (startClaimRef.current) return;
    startClaimRef.current = true;
    setError("");
    try {
      const started = await start.mutateAsync({
        quizId: quiz.id,
        clientStartKey: crypto.randomUUID(),
      });
      window.sessionStorage.setItem(storageKey, String(started.sessionId));
      setResumedSessionId(started.sessionId);
    } catch (startError) {
      startClaimRef.current = false;
      setError(
        startError instanceof Error
          ? startError.message
          : "We could not start the timed assessment. Your practice quiz is still available."
      );
    }
  };
  const chooseAnswer = async (ordinal: number, selectedOptionIndex: number) => {
    if (!session || saveResponse.isPending) return;
    setError("");
    try {
      await saveResponse.mutateAsync({
        sessionId: session.sessionId,
        questionOrdinal: ordinal,
        selectedOptionIndex,
      });
      setAnswers(current => ({ ...current, [ordinal]: selectedOptionIndex }));
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "We could not save that answer. Please try again."
      );
    }
  };
  const finish = async () => {
    if (
      !session ||
      submit.isPending ||
      Object.keys(answers).length !== session.questions.length
    )
      return;
    setError("");
    try {
      const accepted = await submit.mutateAsync({
        sessionId: session.sessionId,
        clientSubmitKey: crypto.randomUUID(),
      });
      setResult(accepted);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "We could not finalize the assessment. Your saved answers remain available."
      );
    }
  };

  if (result)
    return (
      <div className="mx-auto max-w-xl">
        <Button variant="ghost" className="mb-4 rounded-full" onClick={onExit}>
          <ChevronLeft className="mr-1 h-4 w-4" /> Back to quizzes
        </Button>
        <Card className="p-6">
          <div className="text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
            <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-primary">
              Trusted assessment finalized
            </p>
            <h1 className="mt-1 font-display text-4xl font-bold">
              {result.score}%
            </h1>
            <p className="mt-2 font-semibold text-foreground">
              Grade: {result.grade}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {result.performance}
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              {result.correctCount} of {result.questionCount} answers were
              correct. This server-finalized result is separate from local
              practice evidence.
            </p>
          </div>
          <div className="mt-5 flex justify-center">
            <Button className="rounded-full" onClick={onExit}>
              Review my quizzes
            </Button>
          </div>
        </Card>
      </div>
    );

  if (!session)
    return (
      <div className="mx-auto max-w-xl">
        <Button variant="ghost" className="mb-4 rounded-full" onClick={onExit}>
          <ChevronLeft className="mr-1 h-4 w-4" /> Back to quizzes
        </Button>
        <Card className="p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            Timed assessment
          </p>
          <h1 className="mt-2 font-display text-2xl font-bold">{quiz.title}</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Student OS will create an immutable server snapshot of these{" "}
            {quiz.questions.length} questions. Your answers are saved to that
            assessment session, and its final score does not alter local
            practice evidence.
          </p>
          {resumed.isPending ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Restoring your saved assessment…
            </p>
          ) : null}
          {error ? (
            <p
              className="mt-4 text-sm font-medium text-destructive"
              role="alert"
            >
              {error}
            </p>
          ) : null}
          <Button
            className="mt-5 rounded-full"
            disabled={start.isPending || resumed.isPending}
            onClick={begin}
          >
            {start.isPending
              ? "Preparing assessment…"
              : "Start timed assessment"}
          </Button>
        </Card>
      </div>
    );

  if (!question) return null;
  return (
    <div className="mx-auto max-w-xl">
      <Button variant="ghost" className="mb-4 rounded-full" onClick={onExit}>
        <ChevronLeft className="mr-1 h-4 w-4" /> Exit assessment
      </Button>
      <Card className="p-5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Server-saved assessment</span>
          <span>
            {index + 1} / {session.questions.length}
          </span>
        </div>
        <h1 className="mt-4 font-display text-xl font-bold">
          {question.prompt}
        </h1>
        <div
          className="mt-5 flex flex-col gap-2"
          role="group"
          aria-label="Assessment answer options"
        >
          {question.options.map((option, optionIndex) => (
            <button
              type="button"
              key={option}
              aria-pressed={answers[question.ordinal] === optionIndex}
              disabled={saveResponse.isPending}
              onClick={() => void chooseAnswer(question.ordinal, optionIndex)}
              className={`rounded-xl border p-3 text-left text-sm transition-colors ${answers[question.ordinal] === optionIndex ? "border-primary bg-primary/10" : "border-border hover:bg-accent"}`}
            >
              {option}
            </button>
          ))}
        </div>
        {error ? (
          <p className="mt-4 text-sm font-medium text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mt-5 flex items-center justify-between">
          <Button
            variant="outline"
            className="rounded-full bg-card"
            disabled={index === 0}
            onClick={() => setIndex(current => current - 1)}
          >
            Previous
          </Button>
          {index === session.questions.length - 1 ? (
            <Button
              className="rounded-full"
              disabled={
                Object.keys(answers).length < session.questions.length ||
                submit.isPending
              }
              onClick={() => void finish()}
            >
              {submit.isPending ? "Finalizing…" : "Submit assessment"}
            </Button>
          ) : (
            <Button
              className="rounded-full"
              disabled={
                answers[question.ordinal] === undefined ||
                saveResponse.isPending
              }
              onClick={() => setIndex(current => current + 1)}
            >
              Next <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}

function QuizRunner({ quiz, onExit }: { quiz: StudyQuiz; onExit: () => void }) {
  const { recordQuizAttempt } = useStore();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<ReturnType<typeof scoreQuiz> | null>(
    null
  );
  const [completionError, setCompletionError] = useState("");
  const completingRef = useRef(false);
  const question = quiz.questions[index];
  const complete = () => {
    if (completingRef.current || result !== null) return;
    completingRef.current = true;
    const outcome = scoreQuiz(quiz, answers);
    if (!recordQuizAttempt(quiz.id, answers)) {
      completingRef.current = false;
      setCompletionError(
        "This quiz was removed before your result could be recorded. Return to your quiz list and choose an available quiz."
      );
      return;
    }
    setResult(outcome);
  };
  if (result !== null) {
    const missed = quiz.questions.filter(candidate =>
      result.missedQuestionIds.includes(candidate.id)
    );
    return (
      <div className="mx-auto max-w-xl">
        <Button variant="ghost" className="mb-4 rounded-full" onClick={onExit}>
          <ChevronLeft className="mr-1 h-4 w-4" /> Back to quizzes
        </Button>
        <Card className="p-6">
          <div className="text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
            <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-primary">
              Quiz complete
            </p>
            <h1 className="mt-1 font-display text-4xl font-bold">
              {result.score}%
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {result.score >= 70
                ? "A solid result. Keep the topic active with recall practice."
                : "This result is evidence for a targeted review recommendation, not a label on your ability."}
            </p>
          </div>
          {missed.length > 0 && (
            <section className="mt-6 rounded-xl bg-muted/60 p-4">
              <h2 className="font-display text-base font-bold">
                Review before your next attempt
              </h2>
              <div className="mt-3 space-y-3">
                {missed.map(question => (
                  <div
                    key={question.id}
                    className="rounded-lg border bg-background p-3"
                  >
                    <p className="text-sm font-medium">{question.prompt}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Correct answer:{" "}
                      {question.options[question.correctOptionIndex]}
                    </p>
                    {question.explanation && (
                      <p className="mt-2 text-xs leading-5 text-muted-foreground">
                        {question.explanation}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
          <div className="mt-5 flex justify-center">
            <Button className="rounded-full" onClick={onExit}>
              Review my quizzes
            </Button>
          </div>
        </Card>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-xl">
      <Button variant="ghost" className="mb-4 rounded-full" onClick={onExit}>
        <ChevronLeft className="mr-1 h-4 w-4" /> Back to quizzes
      </Button>
      <Card className="p-5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {quiz.subject}
            {quiz.topic ? ` · ${quiz.topic}` : ""}
          </span>
          <span>
            {index + 1} / {quiz.questions.length}
          </span>
        </div>
        <h1 className="mt-4 font-display text-xl font-bold">
          {question.prompt}
        </h1>
        <div
          className="mt-5 flex flex-col gap-2"
          role="group"
          aria-label="Answer options"
        >
          {question.options.map((option, optionIndex) => (
            <button
              type="button"
              key={option}
              aria-pressed={answers[question.id] === optionIndex}
              onClick={() =>
                setAnswers(current => ({
                  ...current,
                  [question.id]: optionIndex,
                }))
              }
              className={`rounded-xl border p-3 text-left text-sm transition-colors ${answers[question.id] === optionIndex ? "border-primary bg-primary/10" : "border-border hover:bg-accent"}`}
            >
              {option}
            </button>
          ))}
        </div>
        {completionError ? (
          <p className="mt-4 text-sm font-medium text-destructive" role="alert">
            {completionError}
          </p>
        ) : null}
        <div className="mt-5 flex items-center justify-between">
          <Button
            variant="outline"
            className="rounded-full bg-card"
            disabled={index === 0}
            onClick={() => setIndex(current => current - 1)}
          >
            Previous
          </Button>
          {index === quiz.questions.length - 1 ? (
            <Button
              className="rounded-full"
              disabled={Object.keys(answers).length < quiz.questions.length}
              onClick={complete}
            >
              Finish quiz
            </Button>
          ) : (
            <Button
              className="rounded-full"
              disabled={answers[question.id] === undefined}
              onClick={() => setIndex(current => current + 1)}
            >
              Next <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
