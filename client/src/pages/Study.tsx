/* STUDENT OS — Study Planner. Create/track study sessions + Smart Planner
   (rule-based weekly plan generator). */

import { AiScheduleDialog } from "@/components/AiScheduleDialog";
import {
  BrandedEmpty,
  PriorityChip,
  ProgressBar,
  minutesToLabel,
} from "@/components/AppBits";
import { Badge } from "@/components/ui/badge";
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
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useStore } from "@/contexts/StoreContext";
import { sessionDialogDefaults } from "@/lib/formDefaults";
import { createAdaptiveExamPlan } from "@/lib/learningIntelligence";
import { generateStudyPlan } from "@/lib/planner";
import type {
  Difficulty,
  Priority,
  SessionStatus,
  StudySession,
} from "@/lib/types";
import { formatDateHuman, subjectColor, todayStr } from "@/lib/utils";
import { BookOpen, CalendarClock, RefreshCw, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";

type FilterStatus = "all" | SessionStatus;
type RecommendedTopic = { id: string; subject: string; name: string };

export function getStudyRecommendationTopicId(location: string) {
  const queryIndex = location.indexOf("?");
  if (queryIndex < 0) return null;
  const topicId = new URLSearchParams(location.slice(queryIndex + 1))
    .get("topicId")
    ?.trim();
  return topicId || null;
}

export default function Study() {
  const {
    state,
    addSession,
    updateSession,
    deleteSession,
    completeSession,
    startSession,
    startStudyPlanItem,
    rebalanceStudyPlan,
  } = useStore();
  const [location] = useLocation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<StudySession | null>(null);
  const [dialogRecommendedTopic, setDialogRecommendedTopic] =
    useState<RecommendedTopic | null>(null);
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [smartOpen, setSmartOpen] = useState(false);
  const [aiScheduleOpen, setAiScheduleOpen] = useState(false);
  const autoOpenedRecommendationRef = useRef<string | null>(null);
  const recommendedTopicId = getStudyRecommendationTopicId(location);
  const incomingRecommendedTopic = useMemo<RecommendedTopic | null>(() => {
    if (!recommendedTopicId) return null;
    const directTopic = state.topics.find(
      topic => topic.id === recommendedTopicId
    );
    if (directTopic)
      return {
        id: directTopic.id,
        subject: directTopic.subject,
        name: directTopic.name,
      };
    for (const exam of state.exams) {
      const examTopic = exam.topics.find(
        topic => topic.id === recommendedTopicId
      );
      if (examTopic)
        return {
          id: examTopic.id,
          subject: exam.subject,
          name: examTopic.name,
        };
    }
    return null;
  }, [recommendedTopicId, state.exams, state.topics]);

  useEffect(() => {
    if (
      !incomingRecommendedTopic ||
      autoOpenedRecommendationRef.current === incomingRecommendedTopic.id
    )
      return;
    autoOpenedRecommendationRef.current = incomingRecommendedTopic.id;
    setDialogRecommendedTopic(incomingRecommendedTopic);
    setEditing(null);
    setDialogOpen(true);
  }, [incomingRecommendedTopic]);

  const filtered = useMemo(() => {
    const list = [...state.sessions].sort((a, b) => (a.date < b.date ? -1 : 1));
    return filter === "all" ? list : list.filter(s => s.status === filter);
  }, [state.sessions, filter]);

  const subjectCounts = useMemo(() => {
    const map = new Map<string, number>();
    state.sessions
      .filter(s => s.status === "completed")
      .forEach(s => {
        map.set(s.subject, (map.get(s.subject) ?? 0) + s.duration);
      });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [state.sessions]);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Study Planner
        </h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="rounded-full bg-card"
            onClick={() => setSmartOpen(true)}
          >
            ✨ Smart Planner
          </Button>
          <Button
            variant="outline"
            className="rounded-full bg-card"
            onClick={() => setAiScheduleOpen(true)}
          >
            <Sparkles className="mr-1.5 h-4 w-4" />
            AI schedule
          </Button>
          <Button
            variant="sunrise"
            onClick={() => {
              setDialogRecommendedTopic(null);
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            + New session
          </Button>
        </div>
      </div>

      {/* Subject time summary */}
      {subjectCounts.length > 0 && (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {subjectCounts.slice(0, 4).map(([subject, mins]) => (
            <div
              key={subject}
              className="rounded-xl border border-border bg-card p-3"
            >
              <div className="flex items-center justify-between text-sm font-medium">
                <span className={subjectColor(subject).text}>{subject}</span>
                <span className="text-xs text-muted-foreground">
                  {minutesToLabel(mins)}
                </span>
              </div>
              <ProgressBar
                value={Math.min(100, (mins / 3600) * 100)}
                className="mt-2"
              />
            </div>
          ))}
        </div>
      )}

      {state.studyPlans.length > 0 && (
        <section className="mt-5">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-semibold">
                Revision plans
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Plan items stay editable. Add one to your sessions when you are
                ready, or redistribute only missed items into real remaining
                capacity.
              </p>
            </div>
            <CalendarClock className="h-5 w-5 shrink-0 text-primary" />
          </div>
          <div className="flex flex-col gap-3">
            {[...state.studyPlans]
              .slice(-2)
              .reverse()
              .map(plan => {
                const planned = plan.items.filter(
                  item => item.status === "planned"
                );
                const completed = plan.items.filter(
                  item => item.status === "completed"
                ).length;
                return (
                  <div
                    key={plan.id}
                    className="rounded-2xl border border-primary/15 bg-primary/[0.025] p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-display text-base font-semibold">
                          {plan.title}
                        </h3>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {completed} complete · {planned.length} remaining ·{" "}
                          {plan.availableMinutesPerDay} min/day
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-full bg-card"
                        onClick={() => rebalanceStudyPlan(plan.id)}
                      >
                        <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Rebalance
                        missed
                      </Button>
                    </div>
                    {planned.slice(0, 4).map(item => {
                      const alreadyScheduled = state.sessions.some(
                        session => session.planItemId === item.id
                      );
                      return (
                        <div
                          key={item.id}
                          className="mt-3 flex items-center gap-3 rounded-xl bg-card p-3"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold">
                              {item.subject} — {item.topic}
                            </div>
                            <div className="truncate text-xs text-muted-foreground">
                              {formatDateHuman(item.date)} · {item.duration} min
                              · {item.reason}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant={alreadyScheduled ? "outline" : "default"}
                            className="shrink-0 rounded-full"
                            disabled={alreadyScheduled}
                            onClick={() => startStudyPlanItem(plan.id, item.id)}
                          >
                            {alreadyScheduled ? "Scheduled" : "Add session"}
                          </Button>
                        </div>
                      );
                    })}
                    {planned.length > 4 && (
                      <p className="mt-3 text-xs text-muted-foreground">
                        + {planned.length - 4} more planned item
                        {planned.length - 4 === 1 ? "" : "s"}
                      </p>
                    )}
                  </div>
                );
              })}
          </div>
        </section>
      )}

      <Tabs
        value={filter}
        onValueChange={v => setFilter(v as FilterStatus)}
        className="mt-5"
      >
        <TabsList className="rounded-full">
          <TabsTrigger value="all" className="rounded-full px-4">
            All
          </TabsTrigger>
          <TabsTrigger value="planned" className="rounded-full px-4">
            Planned
          </TabsTrigger>
          <TabsTrigger value="in_progress" className="rounded-full px-4">
            In progress
          </TabsTrigger>
          <TabsTrigger value="completed" className="rounded-full px-4">
            Completed
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="mt-4 flex flex-col gap-2.5">
        {filtered.length === 0 ? (
          <BrandedEmpty
            icon={BookOpen}
            title={
              filter === "all"
                ? "No study sessions yet"
                : `No ${filter.replace("_", " ")} sessions`
            }
            text="Plan your next study session — pick a subject, topic and time, and we'll track your progress automatically."
            coach={
              filter === "all"
                ? "One 25-minute session today builds the streak."
                : undefined
            }
            actionLabel="+ Add Session"
            onAction={() => {
              setDialogRecommendedTopic(null);
              setDialogOpen(true);
            }}
          />
        ) : (
          filtered.map(s => (
            <SessionCard
              key={s.id}
              session={s}
              onStart={() => startSession(s.id)}
              onComplete={() => completeSession(s.id)}
              onEdit={() => {
                setDialogRecommendedTopic(null);
                setEditing(s);
                setDialogOpen(true);
              }}
              onDelete={() => deleteSession(s.id)}
            />
          ))
        )}
      </div>

      <SessionDialog
        open={dialogOpen}
        onOpenChange={open => {
          setDialogOpen(open);
          if (!open) setDialogRecommendedTopic(null);
        }}
        editing={editing}
        recommendedTopic={dialogRecommendedTopic}
        onSave={data => {
          const accepted = editing
            ? updateSession(editing.id, data)
            : addSession(data);
          if (!accepted) return false;
          setDialogOpen(false);
          setEditing(null);
          setDialogRecommendedTopic(null);
          return true;
        }}
      />

      <SmartPlannerDialog open={smartOpen} onOpenChange={setSmartOpen} />
      <AiScheduleDialog
        open={aiScheduleOpen}
        onOpenChange={setAiScheduleOpen}
      />
    </div>
  );
}

function SessionCard({
  session: s,
  onStart,
  onComplete,
  onEdit,
  onDelete,
}: {
  session: StudySession;
  onStart: () => void;
  onComplete: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const done = s.status === "completed";
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm lift-card">
      <div className="flex items-start gap-3">
        <div
          className={`mt-1 h-10 w-1 shrink-0 rounded-full ${subjectColor(s.subject).bar}`}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3
              className={`font-display text-base font-semibold ${done ? "text-muted-foreground line-through" : ""}`}
            >
              {s.subject} — {s.topic || "Untitled topic"}
            </h3>
            <PriorityChip priority={s.priority} />
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {formatDateHuman(s.date)} · {s.duration} min · {s.difficulty}
          </div>
          {s.notes && (
            <p className="mt-1.5 text-sm text-muted-foreground">{s.notes}</p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {s.status === "planned" && (
              <Button size="sm" className="rounded-full" onClick={onStart}>
                Start session
              </Button>
            )}
            {s.status === "in_progress" && (
              <Button size="sm" className="rounded-full" onClick={onComplete}>
                Complete session
              </Button>
            )}
            {s.status === "completed" && (
              <Badge variant="secondary" className="rounded-full">
                Completed
              </Badge>
            )}
            {s.status === "skipped" && (
              <Badge variant="secondary" className="rounded-full">
                Skipped
              </Badge>
            )}
            {s.status === "rescheduled" && (
              <Badge variant="secondary" className="rounded-full">
                Rescheduled
              </Badge>
            )}
            {s.status === "paused" && (
              <Badge variant="secondary" className="rounded-full">
                Paused — continue in Today
              </Badge>
            )}
            <div className="flex-1" />
            <button
              onClick={onEdit}
              className="text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              Edit
            </button>
            <button
              onClick={onDelete}
              className="text-xs font-medium text-muted-foreground hover:text-destructive"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SessionDialog({
  open,
  onOpenChange,
  editing,
  recommendedTopic,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: StudySession | null;
  recommendedTopic: RecommendedTopic | null;
  onSave: (data: Omit<StudySession, "id">) => boolean;
}) {
  const { state } = useStore();
  const [subject, setSubject] = useState(editing?.subject ?? "");
  const [topic, setTopic] = useState(editing?.topic ?? "");
  const [topicId, setTopicId] = useState(editing?.topicId ?? "");
  const [date, setDate] = useState(editing?.date ?? "");
  const [startTime, setStartTime] = useState(editing?.startTime ?? "09:00");
  const [duration, setDuration] = useState(editing?.duration ?? 60);
  const [difficulty, setDifficulty] = useState<Difficulty>(
    editing?.difficulty ?? "medium"
  );
  const [priority, setPriority] = useState<Priority>(
    editing?.priority ?? "medium"
  );
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [customSubject, setCustomSubject] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [error, setError] = useState("");
  const saveClaimRef = useRef(false);
  const topicOptions = useMemo(
    () =>
      Array.from(
        new Map([
          ...state.topics.map(entry => [entry.id, entry] as const),
          ...state.exams.flatMap(exam =>
            exam.topics.map(
              entry =>
                [
                  entry.id,
                  { id: entry.id, subject: exam.subject, name: entry.name },
                ] as const
            )
          ),
        ]).values()
      ),
    [state.exams, state.topics]
  );
  const subjectOptions = useMemo(
    () =>
      Array.from(
        new Set(
          [
            ...(state.profile?.subjects ?? []),
            editing?.subject,
            recommendedTopic?.subject,
          ].filter((value): value is string => Boolean(value?.trim()))
        )
      ),
    [editing?.subject, recommendedTopic?.subject, state.profile?.subjects]
  );

  // Synchronise the reusable dialog every time it opens. This avoids carrying
  // values from a previously edited session into a new one.
  useEffect(() => {
    if (!open) return;
    saveClaimRef.current = false;
    const defaults = sessionDialogDefaults(editing);
    setSubject(recommendedTopic?.subject ?? defaults.subject);
    setTopic(recommendedTopic?.name ?? defaults.topic);
    setTopicId(recommendedTopic?.id ?? editing?.topicId ?? "");
    setDate(defaults.date);
    setStartTime(defaults.startTime);
    setDuration(defaults.duration);
    setDifficulty(defaults.difficulty);
    setPriority(defaults.priority);
    setNotes(defaults.notes);
    setCustomSubject("");
    setShowCustom(false);
    setError("");
  }, [editing, open, recommendedTopic]);

  const submit = () => {
    const subj = showCustom ? customSubject.trim() : subject;
    if (!subj) return setError("Pick a subject first.");
    if (!date) return setError("Choose a date.");
    if (duration < 10)
      return setError("Sessions should be at least 10 minutes.");
    if (saveClaimRef.current) return;
    saveClaimRef.current = true;
    const accepted = onSave({
      subject: subj,
      topic: topic.trim(),
      topicId: topicId || undefined,
      date,
      startTime,
      duration,
      difficulty,
      priority,
      notes: notes.trim(),
      status: editing?.status ?? "planned",
    });
    if (!accepted) {
      saveClaimRef.current = false;
      return setError(
        "That time conflicts with another session or timetable event. Your details are still here—choose another slot."
      );
    }
    setError("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">
            {editing ? "Edit session" : "New study session"}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div>
            <Label className="mb-1.5 block text-xs font-semibold">
              Subject
            </Label>
            {subjectOptions.length ? (
              <>
                <Select
                  value={showCustom ? "_custom" : subject}
                  onValueChange={v => {
                    if (v === "_custom") {
                      setShowCustom(true);
                      setSubject("");
                    } else {
                      setShowCustom(false);
                      setSubject(v);
                      setCustomSubject("");
                    }
                  }}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Choose subject" />
                  </SelectTrigger>
                  <SelectContent>
                    {subjectOptions.map(s => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                    <SelectItem value="_custom">+ Add another…</SelectItem>
                  </SelectContent>
                </Select>
                {showCustom && (
                  <Input
                    value={customSubject}
                    onChange={e => setCustomSubject(e.target.value)}
                    placeholder="Subject name"
                    className="mt-2 rounded-xl"
                  />
                )}
              </>
            ) : (
              <Input
                value={showCustom ? customSubject : subject}
                onChange={e => {
                  setShowCustom(true);
                  setCustomSubject(e.target.value);
                  setSubject("");
                }}
                placeholder="Subject name"
                className="rounded-xl"
              />
            )}
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-semibold">
              Link a topic{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </Label>
            <Select
              value={topicId || "_none"}
              onValueChange={value => {
                const next = value === "_none" ? "" : value;
                setTopicId(next);
                const selected = topicOptions.find(item => item.id === next);
                if (selected) {
                  setTopic(selected.name);
                  setSubject(selected.subject);
                  setShowCustom(false);
                }
              }}
            >
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">No linked topic</SelectItem>
                {topicOptions.map(item => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.subject} — {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-semibold">Topic</Label>
            <Input
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder="e.g. Electromagnetic fields"
              className="rounded-xl"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5 block text-xs font-semibold">Date</Label>
              <Input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs font-semibold">
                Start time
              </Label>
              <Input
                type="time"
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
                className="rounded-xl"
              />
            </div>
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-semibold">
              Duration: {duration} minutes
            </Label>
            <Slider
              value={[duration]}
              onValueChange={v => setDuration(v[0])}
              min={10}
              max={240}
              step={5}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5 block text-xs font-semibold">
                Difficulty
              </Label>
              <Select
                value={difficulty}
                onValueChange={v => setDifficulty(v as Difficulty)}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block text-xs font-semibold">
                Priority
              </Label>
              <Select
                value={priority}
                onValueChange={v => setPriority(v as Priority)}
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
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-semibold">Notes</Label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="What do you want to cover?"
              className="rounded-xl"
              rows={2}
            />
          </div>
          {error && (
            <p className="text-xs font-medium text-destructive">{error}</p>
          )}
          <Button onClick={submit} className="rounded-xl">
            {editing ? "Save changes" : "Add session"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SmartPlannerDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { state, createStudyPlan } = useStore();
  const subjects = useMemo(
    () => state.profile?.subjects ?? [],
    [state.profile?.subjects]
  );
  const [availHours, setAvailHours] = useState(2);
  const [examId, setExamId] = useState("");
  const [difficulties, setDifficulties] = useState<
    Record<string, "easy" | "medium" | "hard">
  >({});
  const [confidences, setConfidences] = useState<
    Record<string, 1 | 2 | 3 | 4 | 5>
  >({});
  const [examDates, setExamDates] = useState<Record<string, string>>({});
  const [plan, setPlan] = useState<ReturnType<typeof generateStudyPlan> | null>(
    null
  );
  const [adaptivePlan, setAdaptivePlan] = useState<ReturnType<
    typeof createAdaptiveExamPlan
  > | null>(null);
  const adaptivePlanSaveClaimRef = useRef(false);

  useEffect(() => {
    subjects.forEach(s => {
      if (!(s in difficulties)) {
        setDifficulties(d => ({ ...d, [s]: "medium" }));
        setConfidences(c => ({ ...c, [s]: 3 }));
        setExamDates(e => ({ ...e, [s]: "" }));
      }
    });
  }, [subjects, difficulties]);

  const generate = () => {
    if (examId) {
      adaptivePlanSaveClaimRef.current = false;
      setAdaptivePlan(
        createAdaptiveExamPlan(state, examId, Math.round(availHours * 60))
      );
      setPlan(null);
      return;
    }
    const nextExam = (s: string) => {
      const related = state.exams
        .filter(e => e.subject.toLowerCase() === s.toLowerCase())
        .map(e => e.date)
        .sort();
      return related[0] ?? "";
    };
    const result = generateStudyPlan({
      subjects: subjects.map(s => ({
        name: s,
        difficulty: difficulties[s] ?? "medium",
        confidence: confidences[s] ?? 3,
        lastStudied: lastStudiedFor(s),
        examDate: examDates[s] || nextExam(s),
      })),
      availableHoursPerDay: availHours,
      preferredTimes: ["Morning", "Afternoon", "Evening"],
      startDate: todayStr(),
    });
    setPlan(result);
    setAdaptivePlan(null);
  };

  const lastStudiedFor = (subject: string) => {
    const completed = state.sessions
      .filter(
        s =>
          s.subject.toLowerCase() === subject.toLowerCase() &&
          s.status === "completed"
      )
      .sort((a, b) => (a.date < b.date ? 1 : -1));
    return completed[0]?.date ?? "";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">
            ✨ Generate My Study Plan
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div>
            <Label className="mb-1.5 block text-xs font-semibold">
              Available hours per day: {availHours}h
            </Label>
            <Slider
              value={[availHours]}
              onValueChange={v => setAvailHours(v[0])}
              min={1}
              max={6}
              step={0.5}
            />
          </div>
          {state.exams.length > 0 && (
            <div>
              <Label className="mb-1.5 block text-xs font-semibold">
                Build an adaptive exam plan{" "}
                <span className="font-normal text-muted-foreground">
                  (optional)
                </span>
              </Label>
              <Select
                value={examId || "_general"}
                onValueChange={value =>
                  setExamId(value === "_general" ? "" : value)
                }
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_general">General weekly plan</SelectItem>
                  {state.exams.map(exam => (
                    <SelectItem key={exam.id} value={exam.id}>
                      {exam.subject} — {exam.name} ({exam.date})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1.5 text-[11px] leading-4 text-muted-foreground">
                Exam plans prioritise weaker topics, respect remaining daily
                capacity, and stop before the exam instead of creating an
                impossible backlog.
              </p>
            </div>
          )}
          {subjects.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
              Add subjects in Settings first, then come back here.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {subjects.map(s => (
                <div
                  key={s}
                  className="rounded-xl border border-border bg-card p-3"
                >
                  <div className="mb-2 text-sm font-semibold">{s}</div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="mb-1 block text-[11px] text-muted-foreground">
                        Difficulty
                      </Label>
                      <Select
                        value={difficulties[s] ?? "medium"}
                        onValueChange={v =>
                          setDifficulties(d => ({
                            ...d,
                            [s]: v as "easy" | "medium" | "hard",
                          }))
                        }
                      >
                        <SelectTrigger className="h-8 rounded-lg text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="easy">Easy</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="hard">Hard</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="mb-1 block text-[11px] text-muted-foreground">
                        Confidence
                      </Label>
                      <Select
                        value={String(confidences[s] ?? 3)}
                        onValueChange={v =>
                          setConfidences(c => ({
                            ...c,
                            [s]: Number(v) as 1 | 2 | 3 | 4 | 5,
                          }))
                        }
                      >
                        <SelectTrigger className="h-8 rounded-lg text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5].map(n => (
                            <SelectItem key={n} value={String(n)}>
                              {n} / 5
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="mb-1 block text-[11px] text-muted-foreground">
                        Exam date
                      </Label>
                      <Input
                        type="date"
                        value={examDates[s] ?? ""}
                        onChange={e =>
                          setExamDates(d => ({ ...d, [s]: e.target.value }))
                        }
                        className="h-8 rounded-lg text-xs"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {subjects.length > 0 && (
            <Button onClick={generate} className="rounded-xl">
              Generate plan
            </Button>
          )}
          {plan && (
            <div className="flex flex-col gap-2">
              {plan.notes.map((n, i) => (
                <div
                  key={i}
                  className="rounded-lg bg-accent/50 p-2.5 text-xs text-accent-foreground"
                >
                  {n}
                </div>
              ))}
              {plan.days.map(day => (
                <div
                  key={day.date}
                  className="rounded-xl border border-border bg-card p-3"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-semibold">{day.label}</span>
                    <Badge variant="secondary">
                      {minutesToLabel(day.totalMinutes)}
                    </Badge>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {day.slots.map((slot, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span
                          className={`inline-block h-2 w-2 rounded-full ${subjectColor(slot.subject).bar}`}
                        />
                        <span className="font-medium">{slot.subject}</span>
                        <span className="text-muted-foreground">
                          {slot.minutes} min · {slot.reason}
                        </span>
                      </div>
                    ))}
                    {day.slots.length === 0 && (
                      <span className="text-xs text-muted-foreground">
                        Rest day — well earned.
                      </span>
                    )}
                  </div>
                </div>
              ))}
              <p className="text-[11px] text-muted-foreground">
                Tip: turn plan slots into sessions in the planner, or jump to
                the Focus timer.
              </p>
            </div>
          )}
          {adaptivePlan && (
            <div className="flex flex-col gap-2">
              {adaptivePlan.notes.map((note, index) => (
                <div
                  key={index}
                  className="rounded-lg bg-accent/50 p-2.5 text-xs text-accent-foreground"
                >
                  {note}
                </div>
              ))}
              {adaptivePlan.items.length > 0 ? (
                <>
                  <div className="rounded-xl border border-primary/20 bg-primary/[0.035] p-3 text-xs text-muted-foreground">
                    Review the plan below before saving. You can still edit
                    individual sessions after it is added to your workspace.
                  </div>
                  {adaptivePlan.items.map((item, index) => (
                    <div
                      key={`${item.date}-${item.topicId}-${index}`}
                      className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">
                          {item.subject} — {item.topic}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatDateHuman(item.date)} · {item.duration} min ·{" "}
                          {item.reason}
                        </div>
                      </div>
                    </div>
                  ))}
                  <Button
                    className="rounded-xl"
                    onClick={() => {
                      if (adaptivePlanSaveClaimRef.current) return;
                      adaptivePlanSaveClaimRef.current = true;
                      createStudyPlan({
                        title: adaptivePlan.title,
                        startDate: adaptivePlan.startDate,
                        endDate: adaptivePlan.endDate,
                        availableMinutesPerDay:
                          adaptivePlan.availableMinutesPerDay,
                        items: adaptivePlan.items,
                      });
                      onOpenChange(false);
                      setAdaptivePlan(null);
                    }}
                  >
                    Save revision plan
                  </Button>
                </>
              ) : null}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
