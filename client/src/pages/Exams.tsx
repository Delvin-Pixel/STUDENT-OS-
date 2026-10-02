/* STUDENT OS — Exam Center. Exam CRUD, countdown, topic revision tracker,
   readiness meter. */

import { BrandedEmpty, ProgressBar } from "@/components/AppBits";
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
import { useStore } from "@/contexts/StoreContext";
import { validateNewExam, type NewExam } from "@/lib/examValidation";
import { examDialogDefaults } from "@/lib/formDefaults";
import { getExamReadiness } from "@/lib/learningIntelligence";
import type { Exam } from "@/lib/types";
import {
  cn,
  daysFromNow,
  formatDateHuman,
  relativeDayLabel,
} from "@/lib/utils";
import {
  CalendarDays,
  Clock,
  FileText,
  MapPin,
  Pencil,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

const STATUS_STYLES: Record<string, { label: string; cls: string }> = {
  not_started: {
    label: "Not started",
    cls: "bg-muted-foreground/10 text-muted-foreground",
  },
  learning: {
    label: "Learning",
    cls: "bg-[oklch(0.62_0.11_195)]/15 text-[oklch(0.5_0.1_195)]",
  },
  revised: { label: "Revised", cls: "bg-amber-500/15 text-amber-600" },
  mastered: { label: "Mastered", cls: "bg-primary/15 text-primary" },
};

const STATUS_ORDER = [
  "not_started",
  "learning",
  "revised",
  "mastered",
] as const;

export default function Exams() {
  const {
    state,
    addExam,
    updateExam,
    deleteExam,
    addExamTopic,
    deleteExamTopic,
    setTopicStatus,
  } = useStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Exam | null>(null);
  const [newTopic, setNewTopic] = useState<Record<string, string>>({});
  const topicCreationClaimsRef = useRef(new Set<string>());

  const submitTopic = (examId: string) => {
    const name = newTopic[examId]?.trim();
    if (!name || topicCreationClaimsRef.current.has(examId)) return;
    topicCreationClaimsRef.current.add(examId);
    const accepted = addExamTopic(examId, name);
    if (!accepted) {
      topicCreationClaimsRef.current.delete(examId);
      return;
    }
    setNewTopic(current => ({ ...current, [examId]: "" }));
  };

  const sorted = useMemo(
    () => [...state.exams].sort((a, b) => a.date.localeCompare(b.date)),
    [state.exams]
  );

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">
            Exam Center
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Track countdowns and revision progress for every topic.
          </p>
        </div>
        <Button
          variant="sunrise"
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          + Add exam
        </Button>
      </div>

      <div className="mt-5 flex flex-col gap-4">
        {sorted.length === 0 ? (
          <BrandedEmpty
            icon={FileText}
            title="No exams on the calendar"
            text="Add your first exam and we'll count down the days while you tick off topics one by one."
            coach="Future you is already grateful — one exam added beats zero prepared."
            actionLabel="+ Add Exam"
            onAction={() => setDialogOpen(true)}
          />
        ) : (
          sorted.map(e => {
            const days = daysFromNow(e.date);
            const total = e.topics.length;
            const briefing = getExamReadiness(state, e.id);
            const allTopicsHaveDirectEvidence = Boolean(
              total > 0 && briefing?.evidenceBackedTopics === total
            );
            return (
              <div
                key={e.id}
                className="rounded-2xl border border-border bg-card p-5 shadow-sm lift-card"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-display text-lg font-bold">
                        {e.subject} — {e.name}
                      </h2>
                      <Badge
                        variant="outline"
                        className="rounded-full text-xs font-semibold"
                      >
                        {relativeDayLabel(e.date)}
                      </Badge>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" />{" "}
                        {formatDateHuman(e.date)}
                      </span>
                      {e.time && (
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {e.time}
                        </span>
                      )}
                      {e.location && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {e.location}
                        </span>
                      )}
                    </div>
                    {e.notes && (
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        {e.notes}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => {
                        setEditing(e);
                        setDialogOpen(true);
                      }}
                      className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent"
                      aria-label="Edit exam"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => deleteExam(e.id)}
                      className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      aria-label="Delete exam"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
                  <span className="font-semibold">
                    {allTopicsHaveDirectEvidence
                      ? "Direct-evidence readiness"
                      : "Readiness estimate"}
                  </span>
                  <ProgressBar
                    value={briefing?.readiness ?? 0}
                    className="w-40"
                  />
                  <span className="text-muted-foreground">
                    {briefing?.readiness ?? 0}% readiness ·{" "}
                    {briefing?.coverage ?? 0}% coverage
                  </span>
                  {days >= 0 && days < 14 && (
                    <span className="font-medium text-destructive">
                      Less than 2 weeks!
                    </span>
                  )}
                  {days < 0 && (
                    <span className="font-medium text-muted-foreground">
                      Past exam
                    </span>
                  )}
                </div>

                {briefing && total > 0 && (
                  <div className="mt-3 grid gap-2 rounded-xl bg-muted/60 p-3 text-xs sm:grid-cols-3">
                    <div>
                      <p className="font-semibold text-primary">Strong</p>
                      <p className="mt-1 text-muted-foreground">
                        {briefing.strongTopics.length
                          ? briefing.strongTopics.join(", ")
                          : "Keep gathering direct evidence."}
                      </p>
                    </div>
                    <div>
                      <p className="font-semibold text-primary">
                        Needs attention
                      </p>
                      <p className="mt-1 text-muted-foreground">
                        {briefing.needsAttentionTopics.length
                          ? briefing.needsAttentionTopics.join(", ")
                          : "No lower-scoring topic identified yet."}
                      </p>
                    </div>
                    <div>
                      <p className="font-semibold text-primary">Recommended</p>
                      <p className="mt-1 text-muted-foreground">
                        {briefing.recommendedSessions} focused session
                        {briefing.recommendedSessions === 1
                          ? ""
                          : "s"} next.{" "}
                        {briefing.evidenceBackedTopics
                          ? `${briefing.evidenceBackedTopics}/${total} topics have direct evidence.`
                          : "Add a quiz or practice check to replace estimates."}
                      </p>
                    </div>
                  </div>
                )}

                <div className="mt-3 flex flex-col gap-1.5">
                  {e.topics.map(t => {
                    const idx = STATUS_ORDER.indexOf(t.status);
                    return (
                      <div
                        key={t.id}
                        className="flex items-center gap-2 rounded-lg bg-background/60 p-2"
                      >
                        <button
                          onClick={() => {
                            const next = STATUS_ORDER[(idx + 1) % 4];
                            setTopicStatus(e.id, t.id, next);
                          }}
                          title="Update checklist status; practice and quizzes provide learning evidence"
                          className="shrink-0"
                          aria-label={`Change ${t.name} status`}
                        >
                          <Badge
                            variant="outline"
                            className={cn(
                              "rounded-full px-2.5 py-1 text-[11px] font-medium cursor-pointer",
                              STATUS_STYLES[t.status].cls
                            )}
                          >
                            {STATUS_STYLES[t.status].label}
                          </Badge>
                        </button>
                        <span className="min-w-0 flex-1 truncate text-sm">
                          {t.name}
                        </span>
                        <button
                          onClick={() => deleteExamTopic(e.id, t.id)}
                          className="shrink-0 rounded p-1 text-muted-foreground hover:text-destructive"
                          aria-label={`Delete topic ${t.name}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  })}
                  {e.topics.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      No topics yet — add what you need to revise.
                    </p>
                  )}
                  <div className="mt-1 flex gap-2">
                    <Input
                      value={newTopic[e.id] ?? ""}
                      onChange={ev => {
                        topicCreationClaimsRef.current.delete(e.id);
                        setNewTopic(n => ({ ...n, [e.id]: ev.target.value }));
                      }}
                      placeholder="Add a topic…"
                      className="h-8 rounded-lg bg-background text-xs"
                      onKeyDown={ev => {
                        if (ev.key === "Enter" && newTopic[e.id]?.trim()) {
                          submitTopic(e.id);
                        }
                      }}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 rounded-lg bg-background text-xs"
                      onClick={() => {
                        if (newTopic[e.id]?.trim()) {
                          submitTopic(e.id);
                        }
                      }}
                    >
                      Add
                    </Button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <ExamDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        onSave={data =>
          editing ? updateExam(editing.id, data) : addExam(data)
        }
      />
    </div>
  );
}

function ExamDialog({
  open,
  onOpenChange,
  editing,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: Exam | null;
  onSave: (data: NewExam) => boolean;
}) {
  const { state } = useStore();
  const [subject, setSubject] = useState("");
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [customSubject, setCustomSubject] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const saveClaimRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    saveClaimRef.current = false;
    const defaults = examDialogDefaults(editing);
    setSubject(defaults.subject);
    setName(defaults.name);
    setDate(defaults.date);
    setTime(defaults.time);
    setLocation(defaults.location);
    setNotes(defaults.notes);
    setError("");
    setShowCustom(false);
    setCustomSubject("");
  }, [editing, open]);

  const submit = () => {
    const subj = showCustom ? customSubject.trim() : subject;
    const exam = {
      subject: subj,
      name: name.trim(),
      date,
      time: time.trim(),
      location: location.trim(),
      notes: notes.trim(),
    };
    const validationError = validateNewExam(exam);
    if (validationError) return setError(validationError);
    if (saveClaimRef.current) return;
    saveClaimRef.current = true;
    const accepted = onSave(exam);
    if (!accepted) {
      saveClaimRef.current = false;
      return setError(
        "We could not save that exam. Your details are still here."
      );
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">
            {editing ? "Edit exam" : "Add exam"}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div>
            <Label className="mb-1.5 block text-xs font-semibold">
              Subject
            </Label>
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
                {(state.profile?.subjects ?? []).map(s => (
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
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-semibold">
              Exam name
            </Label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. End of term exam"
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
              <Label className="mb-1.5 block text-xs font-semibold">Time</Label>
              <Input
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
                className="rounded-xl"
              />
            </div>
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-semibold">
              Location
            </Label>
            <Input
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="e.g. Hall B"
              className="rounded-xl"
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-semibold">Notes</Label>
            <Input
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Bring scientific calculator"
              className="rounded-xl"
            />
          </div>
          {error && (
            <p className="text-xs font-medium text-destructive">{error}</p>
          )}
          <Button onClick={submit} variant="sunrise">
            {editing ? "Save changes" : "Add exam"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
