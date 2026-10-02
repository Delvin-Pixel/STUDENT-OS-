import type { MediaAttachment, Message } from "@/components/AIChatBox";
import { AIChatBox as LessonChat } from "@/components/AIChatBox";
import DailyLessonSkeleton from "@/components/DailyLessonSkeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useStore } from "@/contexts/StoreContext";
import {
  academicEnvironmentKey,
  getAcademicEnvironment,
} from "@/lib/academicEnvironment";
import { chooseDailyTopic } from "@/lib/curriculum";
import { dailyLessonCacheKey } from "@/lib/dailyLessonCache";
import { dailyLessonAnswerSourceLabel } from "@/lib/presentationContracts";
import { trpc } from "@/lib/trpc";
import { todayStr } from "@/lib/utils";
import {
  BookMarked,
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Lightbulb,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { DailyLesson as DailyLessonData } from "../../../server/lessons";

type CachedLesson = { lesson: DailyLessonData; savedAt: string };

function readCachedLesson(
  accountCacheScope: string,
  key: string
): DailyLessonData | null {
  try {
    const all = JSON.parse(
      localStorage.getItem(dailyLessonCacheKey(accountCacheScope)) ?? "{}"
    ) as Record<string, CachedLesson>;
    return all[key]?.lesson ?? null;
  } catch {
    return null;
  }
}

function cacheLesson(
  accountCacheScope: string,
  key: string,
  lesson: DailyLessonData
) {
  try {
    const cacheKey = dailyLessonCacheKey(accountCacheScope);
    const all = JSON.parse(localStorage.getItem(cacheKey) ?? "{}") as Record<
      string,
      CachedLesson
    >;
    localStorage.setItem(
      cacheKey,
      JSON.stringify({
        ...all,
        [key]: { lesson, savedAt: new Date().toISOString() },
      })
    );
  } catch {
    // A cache miss is harmless: the lesson still remains visible for this visit.
  }
}

export default function DailyLesson() {
  const {
    state,
    accountCacheScope,
    completeDailyLesson,
    saveSavedLesson,
    removeSavedLesson,
    rateAiAnswer,
  } = useStore();
  const profile = state.profile;
  const environment = useMemo(
    () => (profile ? getAcademicEnvironment(profile) : null),
    [profile]
  );
  const selection = useMemo(
    () =>
      profile
        ? chooseDailyTopic(
            profile.subjects,
            profile.educationLevel,
            todayStr(),
            academicEnvironmentKey(profile)
          )
        : null,
    [profile]
  );
  const [lesson, setLesson] = useState<DailyLessonData | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const requestRef = useRef("");
  const lessonMutation = trpc.dailyLessons.generate.useMutation();
  const questionMutation = trpc.dailyLessons.ask.useMutation();

  /* ── bookmark handling ──────────────────────────────────────────── */
  const savedEntry = useMemo(
    () =>
      lesson && selection
        ? state.savedLessons.find(s => s.selectionKey === selection.key)
        : undefined,
    [state.savedLessons, lesson, selection]
  );

  const toggleSaveLesson = () => {
    if (!lesson || !selection) return;
    if (savedEntry) {
      removeSavedLesson(savedEntry.id);
      return;
    }
    saveSavedLesson({
      selectionKey: selection.key,
      dateStr: todayStr(),
      subject: selection.subject,
      branch: selection.branch,
      topic: selection.topic,
      title: lesson.title,
      strapline: lesson.strapline,
      learningGoals: lesson.learningGoals,
      recap: lesson.sections
        .slice(0, 3)
        .map(s => s.explanation)
        .join("\n\n")
        .slice(0, 1400),
    });
  };

  const fetchLesson = () => {
    if (!selection || !profile) return;
    const requestKey = `${accountCacheScope}:${selection.key}`;
    requestRef.current = requestKey;
    lessonMutation.mutate(
      {
        subject: selection.subject,
        branch: selection.branch,
        topic: selection.topic,
        educationLevel: profile.educationLevel,
        age: profile.age,
        ...(profile.classLevel ? { classLevel: profile.classLevel } : {}),
        ...(profile.academicTrack
          ? { academicTrack: profile.academicTrack }
          : {}),
      },
      {
        onSuccess: result => {
          if (requestRef.current !== requestKey) return;
          cacheLesson(accountCacheScope, selection.key, result);
          setLesson(result);
        },
        onError: () => {
          if (requestRef.current === requestKey)
            toast.error(
              "We could not prepare today's lesson. Please try again."
            );
        },
      }
    );
  };

  useEffect(() => {
    if (!selection) return;
    const lessonScope = `${accountCacheScope}:${selection.key}`;
    // Invalidate both lesson and question callbacks from the prior account/topic,
    // including when the new account already has a cached lesson.
    requestRef.current = lessonScope;
    setMessages([]);
    const cached = readCachedLesson(accountCacheScope, selection.key);
    if (cached) {
      setLesson(cached);
      return;
    }
    setLesson(null);
    fetchLesson();
    // The deterministic selection key is the only value that should generate a new daily lesson.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection?.key, accountCacheScope]);

  if (!selection || !profile) return null;
  const completed = state.dailyLessonCompletions.includes(selection.key);
  const lessonContext = lesson
    ? `${lesson.title}. ${lesson.strapline}\n${lesson.sections.map(section => `${section.heading}: ${section.explanation}`).join("\n")}`.slice(
        0,
        5000
      )
    : "";

  const askQuestion = (question: string) => {
    if (!lesson) return;
    const questionScope = `${accountCacheScope}:${selection.key}`;
    const questionId = crypto.randomUUID();
    setMessages(previous => [
      ...previous,
      { id: questionId, role: "user", content: question },
    ]);
    questionMutation.mutate(
      {
        question,
        subject: selection.subject,
        topic: selection.topic,
        educationLevel: profile.educationLevel,
        lessonContext,
      },
      {
        onSuccess: result => {
          if (requestRef.current !== questionScope) return;
          const source = `**Answer source:** ${dailyLessonAnswerSourceLabel(result.source)}`;
          const body = `${result.answerMarkdown}\n\n${source}\n\n**Check your thinking:** ${result.checkYourThinking}`;
          const media = result.source === "openai" ? result.media : undefined;
          setMessages(previous => [
            ...previous,
            {
              id: crypto.randomUUID(),
              role: "assistant",
              content: body,
              ...(media ? { media } : {}),
            },
          ]);
        },
        onError: () => {
          if (requestRef.current !== questionScope) return;
          toast.error(
            "Your question could not be answered just now. Please try again."
          );
          setMessages(previous =>
            previous.filter(entry => entry.id !== questionId)
          );
        },
      }
    );
  };

  return (
    <section className="mt-6" aria-labelledby="daily-lesson-heading">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.15em] text-primary">
            <Sparkles className="h-3.5 w-3.5" /> Daily Lessons
          </div>
          <h2
            id="daily-lesson-heading"
            className="mt-1 font-display text-xl font-bold"
          >
            Today&apos;s tailored study session
          </h2>
          {environment ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {environment.focus}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs">
            {selection.subject}
          </Badge>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={
              savedEntry
                ? "Remove from saved lessons"
                : "Save this lesson for later"
            }
            className={
              savedEntry
                ? "rounded-full border-primary/40 bg-primary/10 text-primary"
                : "rounded-full"
            }
            onClick={toggleSaveLesson}
          >
            {savedEntry ? (
              <BookmarkCheck className="h-4 w-4" />
            ) : (
              <Bookmark className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {lessonMutation.isPending && !lesson && (
        <div>
          <p className="mb-3 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />{" "}
            Generating today&apos;s lesson — matching {selection.topic} to your{" "}
            {environment?.label ?? profile.educationLevel} context…
          </p>
          <DailyLessonSkeleton topic={selection.topic} />
        </div>
      )}

      {!lessonMutation.isPending && !lesson && (
        <Card className="border-dashed p-6 text-center">
          <BookMarked className="mx-auto h-6 w-6 text-primary" />
          <p className="mt-3 text-sm font-semibold">
            Today&apos;s lesson is ready to prepare.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Topic: {selection.branch} · {selection.topic}
          </p>
          <Button
            variant="sunrise"
            className="mt-4 rounded-xl"
            onClick={fetchLesson}
          >
            <RefreshCw className="mr-2 h-4 w-4" /> Prepare lesson
          </Button>
        </Card>
      )}

      {lesson && (
        <Card className="overflow-hidden border-primary/15 bg-card p-0 shadow-sm">
          <div className="sunrise-sweep relative overflow-hidden px-5 py-5 text-primary-foreground">
            <div className="relative z-10">
              <p className="text-[11px] font-bold uppercase tracking-[0.15em] opacity-80">
                {selection.branch}
              </p>
              <h3 className="mt-1 font-display text-2xl font-bold">
                {lesson.title}
              </h3>
              <p className="mt-1.5 max-w-xl text-sm opacity-90">
                {lesson.strapline}
              </p>
            </div>
            <div className="absolute -right-5 -top-8 h-28 w-28 rounded-full bg-white/15 blur-xl" />
          </div>
          <div className="p-5">
            <div className="grid gap-5 lg:grid-cols-[1.35fr_.65fr]">
              <div>
                <div className="rounded-2xl bg-accent/50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-primary">
                    By the end, you can…
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {lesson.learningGoals.map(goal => (
                      <li key={goal} className="flex gap-2 text-sm">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        {goal}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="mt-5 space-y-5">
                  {lesson.sections.map(section => (
                    <div key={section.heading}>
                      <h4 className="font-display text-base font-bold">
                        {section.heading}
                      </h4>
                      <LessonText className="mt-1.5 text-sm leading-6 text-foreground/85">
                        {section.explanation}
                      </LessonText>
                    </div>
                  ))}
                </div>
              </div>
              <aside className="space-y-4">
                <div className="rounded-2xl border border-border bg-background p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Key terms
                  </p>
                  <dl className="mt-3 space-y-3">
                    {lesson.keyTerms.map(item => (
                      <div key={item.term}>
                        <dt className="text-sm font-semibold text-primary">
                          {item.term}
                        </dt>
                        <dd className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                          {item.definition}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
                {lesson.diagram.nodes.length >= 2 && (
                  <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-primary">
                      {lesson.diagram.title}
                    </p>
                    <div className="mt-3 space-y-2">
                      {lesson.diagram.nodes.map((node, index) => (
                        <div key={`${node}-${index}`}>
                          <div className="rounded-xl bg-card px-3 py-2 text-center text-xs font-semibold shadow-sm">
                            {node}
                          </div>
                          {index < lesson.diagram.nodes.length - 1 && (
                            <div className="my-1 flex items-center justify-center gap-1 text-center text-[10px] text-primary">
                              <span className="h-3 border-l border-primary" />
                              {lesson.diagram.connectors[index] ?? "leads to"}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {lesson.illustration?.requested && lesson.illustration?.url ? (
                  <figure className="rounded-2xl border border-border overflow-hidden bg-background">
                    <img
                      src={lesson.illustration.url}
                      alt={lesson.illustration.caption ?? lesson.title}
                      className="max-h-80 w-full object-contain"
                      loading="lazy"
                    />
                    {lesson.illustration.caption && (
                      <figcaption className="px-3 py-2 text-[11px] text-muted-foreground">
                        {lesson.illustration.caption}
                      </figcaption>
                    )}
                  </figure>
                ) : null}
              </aside>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-border bg-background p-4">
                <p className="flex items-center gap-2 text-sm font-bold">
                  <Lightbulb className="h-4 w-4 text-primary" />{" "}
                  {lesson.workedExample.title}
                </p>
                <p className="mt-2 text-sm font-medium">
                  {lesson.workedExample.prompt}
                </p>
                <LessonText className="mt-2 text-sm leading-6 text-muted-foreground">
                  {lesson.workedExample.solution}
                </LessonText>
              </div>
              <div className="rounded-2xl border border-border bg-background p-4">
                <p className="flex items-center gap-2 text-sm font-bold">
                  <CircleHelp className="h-4 w-4 text-primary" /> Quick check
                </p>
                <p className="mt-2 text-sm">{lesson.quickCheck.question}</p>
                <details className="mt-3 text-sm">
                  <summary className="cursor-pointer font-semibold text-primary">
                    Reveal answer
                  </summary>
                  <p className="mt-2 text-muted-foreground">
                    {lesson.quickCheck.answer}
                  </p>
                </details>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
              <p className="text-xs text-muted-foreground">
                Today&apos;s {selection.subject} lesson is saved on this device.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="ghost"
                  className={
                    savedEntry
                      ? "rounded-xl text-primary hover:bg-primary/10"
                      : "rounded-xl text-muted-foreground hover:text-foreground"
                  }
                  onClick={toggleSaveLesson}
                >
                  {savedEntry ? (
                    <>
                      <BookmarkCheck className="mr-2 h-4 w-4" /> Saved — remove
                    </>
                  ) : (
                    <>
                      <Bookmark className="mr-2 h-4 w-4" /> Save for review
                    </>
                  )}
                </Button>
                <Button
                  variant={completed ? "outline" : "sunrise"}
                  className="rounded-xl"
                  disabled={completed}
                  onClick={() =>
                    completeDailyLesson(selection.key, lesson.title)
                  }
                >
                  {completed ? (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" /> Completed
                    </>
                  ) : (
                    <>
                      Mark lesson complete{" "}
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
          <div className="border-t border-border bg-accent/30 p-5">
            <div className="mb-3">
              <p className="font-display text-base font-bold">
                Ask about this lesson
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Ask a follow-up question and get a clear, level-appropriate
                explanation.
              </p>
            </div>
            <Suspense
              fallback={
                <div className="flex h-40 items-center justify-center rounded-2xl border border-border bg-card text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Opening your question space…
                </div>
              }
            >
              <LessonChat
                messages={messages}
                onSendMessage={askQuestion}
                isLoading={questionMutation.isPending}
                placeholder={`Ask about ${selection.topic}…`}
                height="310px"
                emptyStateMessage="Ask anything about today’s topic."
                suggestedPrompts={[
                  "Can you explain that more simply?",
                  "Give me another example",
                  "What is a common mistake here?",
                  "Create a diagram for this topic",
                ]}
                renderMedia={renderLessonMedia}
                onRateAnswer={(message, rating, reason) => {
                  if (!message.id) return;
                  rateAiAnswer(
                    message.id,
                    "lesson",
                    rating,
                    message.content,
                    reason
                  );
                  setMessages(previous =>
                    previous.map(entry =>
                      entry.id === message.id
                        ? {
                            ...entry,
                            rating,
                            ...(rating === "down" && reason
                              ? { reason }
                              : { reason: undefined }),
                          }
                        : entry
                    )
                  );
                  toast.success(
                    rating === "up"
                      ? "Thanks — glad that helped."
                      : reason
                        ? "Thanks — your reason is saved privately on this device."
                        : "Thanks — your feedback is saved privately on this device."
                  );
                }}
              />
            </Suspense>
          </div>
        </Card>
      )}
    </section>
  );
}

/** Keeps lesson copy fast to load while preserving readable paragraphs and list-style steps. */
export function LessonText({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  const blocks = children.split(/\n{2,}/).filter(Boolean);
  return (
    <div className={className}>
      {blocks.map((block, index) => {
        const lines = block.split("\n").filter(Boolean);
        const isList = lines.every(line => /^[-*]\s+/.test(line.trim()));
        if (isList)
          return (
            <ul className="my-2 list-disc space-y-1 pl-5" key={index}>
              {lines.map((line, itemIndex) => (
                <li key={itemIndex}>
                  {formatInlineText(line.replace(/^[-*]\s+/, ""))}
                </li>
              ))}
            </ul>
          );
        return (
          <p className="mb-2 last:mb-0 whitespace-pre-wrap" key={index}>
            {formatInlineText(block)}
          </p>
        );
      })}
    </div>
  );
}

function renderLessonMedia(attachment: MediaAttachment) {
  return (
    <figure className="my-2 overflow-hidden rounded-2xl border border-border bg-card">
      <img
        src={attachment.url}
        alt={attachment.caption}
        className="w-full object-contain"
        loading="lazy"
      />
      <figcaption className="px-3 py-2 text-[11px] text-muted-foreground">
        {attachment.caption}
      </figcaption>
    </figure>
  );
}

function formatInlineText(value: string) {
  return value
    .split(/(\*\*[^*]+\*\*)/g)
    .map((part, index) =>
      part.startsWith("**") && part.endsWith("**") ? (
        <strong key={index}>{part.slice(2, -2)}</strong>
      ) : (
        part
      )
    );
}
