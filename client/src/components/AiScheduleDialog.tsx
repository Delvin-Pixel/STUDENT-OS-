import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useStore } from "@/contexts/StoreContext";
import { deadlineRiskWarnings } from "@/lib/scheduleRisk";
import { hasActiveSessionOverlap } from "@/lib/sessionScheduling";
import { trpc } from "@/lib/trpc";
import type { StudySession } from "@/lib/types";
import { todayStr } from "@/lib/utils";
import { Sparkles } from "lucide-react";
import { useMemo, useRef, useState } from "react";

type Draft = {
  title: string;
  instructions: string;
  sessions: Array<{
    date: string;
    startTime: string;
    duration: number;
    subject: string;
    topic: string;
    priority: "high" | "medium" | "low";
    reason: string;
    deadlineTitle: string;
  }>;
};
type RecurringBlock = { day: number; startTime: string; endTime: string };
const plusDays = (date: string, days: number) => {
  const result = new Date(`${date}T00:00:00.000Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
};
const minutesAt = (time: string) =>
  Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
const weekday = (date: string) =>
  (new Date(`${date}T12:00:00`).getDay() + 6) % 7;
const overlaps = (
  start: number,
  duration: number,
  otherStart: number,
  otherDuration: number
) => start < otherStart + otherDuration && otherStart < start + duration;

export function validateReviewedScheduleApplication(
  draft: Draft | null,
  reviewed: Record<number, boolean>,
  existing: StudySession[],
  availableMinutesPerDay: number,
  recurringBlocks: RecurringBlock[]
) {
  if (
    !draft ||
    !draft.sessions.length ||
    !draft.sessions.every((_, index) => reviewed[index])
  )
    return "Review every proposed session before adding it.";
  const valid = draft.sessions.every(
    session =>
      /^\d{4}-\d{2}-\d{2}$/.test(session.date) &&
      /^\d{2}:\d{2}$/.test(session.startTime) &&
      session.duration >= 15 &&
      session.duration <= 180 &&
      session.subject.trim() &&
      session.topic.trim()
  );
  if (!valid)
    return "Correct every subject, topic, date, time, and 15–180 minute duration before adding the schedule.";
  const minutesByDate = new Map<string, number>();
  existing
    .filter(session =>
      ["planned", "in_progress", "paused"].includes(session.status)
    )
    .forEach(session =>
      minutesByDate.set(
        session.date,
        (minutesByDate.get(session.date) ?? 0) + session.duration
      )
    );
  const combined = [...existing];
  for (const session of draft.sessions) {
    const candidate = {
      ...session,
      difficulty:
        session.priority === "high" ? ("hard" as const) : ("medium" as const),
      notes: `${session.reason} Deadline: ${session.deadlineTitle}.`,
      status: "planned" as const,
    };
    if (hasActiveSessionOverlap(combined, candidate))
      return "One edited proposal overlaps an active or planned Study Planner session. Adjust its date or time, then apply again.";
    const start = minutesAt(session.startTime);
    if (
      recurringBlocks.some(
        block =>
          block.day === weekday(session.date) &&
          overlaps(
            start,
            session.duration,
            minutesAt(block.startTime),
            minutesAt(block.endTime) - minutesAt(block.startTime)
          )
      )
    )
      return "One edited proposal overlaps a recurring timetable block. Adjust its date or time, then apply again.";
    const used = (minutesByDate.get(session.date) ?? 0) + session.duration;
    if (used > availableMinutesPerDay)
      return "One edited proposal exceeds your daily study capacity when existing sessions are included. Adjust its date, duration, or capacity before adding it.";
    minutesByDate.set(session.date, used);
    combined.push({ ...candidate, id: `preview-${combined.length}` });
  }
  return null;
}

export function AiScheduleDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { state, addSession, notify } = useStore();
  const [minutes, setMinutes] = useState(120);
  const [windowStart, setWindowStart] = useState("16:00");
  const [windowEnd, setWindowEnd] = useState("20:00");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [reviewed, setReviewed] = useState<Record<number, boolean>>({});
  const [error, setError] = useState("");
  const applyClaimRef = useRef(false);
  const today = todayStr();
  const horizonEnd = plusDays(today, 14);
  const activeSessions = useMemo(
    () =>
      state.sessions.filter(
        session =>
          ["planned", "in_progress", "paused"].includes(session.status) &&
          session.date >= today &&
          session.date <= horizonEnd
      ),
    [state.sessions, today, horizonEnd]
  );
  const deadlines = useMemo(
    () =>
      [
        ...state.tasks
          .filter(
            task =>
              task.status !== "completed" &&
              task.dueDate >= today &&
              task.dueDate <= horizonEnd
          )
          .map(task => ({
            kind: "task" as const,
            title: task.title,
            subject: task.subject || "General study",
            dueDate: task.dueDate,
            priority: task.priority,
            estimatedMinutes: Math.max(
              15,
              Math.min(360, task.estimatedMinutes ?? 60)
            ),
          })),
        ...state.exams
          .filter(exam => exam.date >= today && exam.date <= horizonEnd)
          .map(exam => ({
            kind: "exam" as const,
            title: exam.name,
            subject: exam.subject || "General study",
            dueDate: exam.date,
            priority: "high" as const,
            estimatedMinutes: Math.max(
              30,
              Math.min(360, exam.topics.length * 30 || 90)
            ),
          })),
      ]
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
        .slice(0, 20),
    [state.exams, state.tasks, today, horizonEnd]
  );
  const generate = trpc.scheduleDrafts.generate.useMutation({
    onSuccess: value => {
      applyClaimRef.current = false;
      setDraft(value);
      setReviewed({});
      setError("");
    },
    onError: failure => setError(failure.message),
  });
  const windowMinutes = Math.max(
    0,
    Number(windowEnd.slice(0, 2)) * 60 +
      Number(windowEnd.slice(3)) -
      (Number(windowStart.slice(0, 2)) * 60 + Number(windowStart.slice(3)))
  );
  const risks = deadlineRiskWarnings(
    deadlines,
    today,
    minutes,
    windowMinutes,
    activeSessions
  );
  const allReviewed =
    Boolean(draft?.sessions.length) &&
    draft!.sessions.every((_, index) => reviewed[index]);
  const request = () => {
    if (!deadlines.length)
      return setError(
        "Add an incomplete dated task or an upcoming exam in the next 14 days first."
      );
    if (windowEnd <= windowStart)
      return setError("Choose a productive window that ends after it starts.");
    generate.mutate({
      today,
      horizonEnd,
      availableMinutesPerDay: minutes,
      deadlines,
      existingSessions: activeSessions
        .slice(0, 60)
        .map(({ date, startTime, duration }) => ({
          date,
          startTime,
          duration,
        })),
      recurringBlocks: state.events
        .slice(0, 60)
        .map(({ day, startTime, endTime }) => ({ day, startTime, endTime })),
      preferredStudyWindow: { startTime: windowStart, endTime: windowEnd },
    });
  };
  const patchSession = (
    index: number,
    patch: Partial<Draft["sessions"][number]>
  ) =>
    setDraft(current =>
      current
        ? {
            ...current,
            sessions: current.sessions.map((session, itemIndex) =>
              itemIndex === index ? { ...session, ...patch } : session
            ),
          }
        : current
    );
  const apply = () => {
    const validationError = validateReviewedScheduleApplication(
      draft,
      reviewed,
      state.sessions,
      minutes,
      state.events
    );
    if (validationError) return setError(validationError);
    if (!draft) return;
    if (applyClaimRef.current) return;
    applyClaimRef.current = true;
    const proposed = draft.sessions.map(session => ({
      ...session,
      difficulty:
        session.priority === "high" ? ("hard" as const) : ("medium" as const),
      notes: `${session.reason} Deadline: ${session.deadlineTitle}.`,
      status: "planned" as const,
    }));
    const acceptedIndexes = proposed.flatMap((session, index) =>
      addSession(session) ? [index] : []
    );
    if (acceptedIndexes.length !== proposed.length) {
      const rejected = draft.sessions.filter(
        (_, index) => !acceptedIndexes.includes(index)
      );
      setDraft({ ...draft, sessions: rejected });
      setReviewed(
        Object.fromEntries(rejected.map((_, index) => [index, true]))
      );
      applyClaimRef.current = false;
      setError(
        `${acceptedIndexes.length} reviewed session${acceptedIndexes.length === 1 ? " was" : "s were"} added. ${rejected.length} proposal${rejected.length === 1 ? " remains" : "s remain"} for you to adjust and retry.`
      );
      return;
    }
    setDraft(null);
    setReviewed({});
    notify(
      `${proposed.length} reviewed AI session${proposed.length === 1 ? "" : "s"} added to your Study Planner.`,
      "success"
    );
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display">
            AI deadline-driven schedule
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="rounded-xl bg-primary/5 p-3 text-sm text-muted-foreground">
            <strong className="text-foreground">
              Explicit consent required.
            </strong>{" "}
            Student OS sends only upcoming incomplete task/exam deadlines,
            active session times, recurring timetable blocks, selected
            productive hours, and daily capacity to make this 14-day proposal.
            Nothing is saved until you review and apply it.
          </p>
          <div>
            <Label className="mb-1.5 block text-xs font-semibold">
              Available study time: {minutes} min/day
            </Label>
            <Slider
              value={[minutes]}
              onValueChange={value => setMinutes(value[0])}
              min={30}
              max={360}
              step={15}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1 block text-xs font-semibold">
                Productive hours start
              </Label>
              <Input
                type="time"
                value={windowStart}
                onChange={event => setWindowStart(event.target.value)}
              />
            </div>
            <div>
              <Label className="mb-1 block text-xs font-semibold">
                Productive hours end
              </Label>
              <Input
                type="time"
                value={windowEnd}
                onChange={event => setWindowEnd(event.target.value)}
              />
            </div>
          </div>
          {risks.length > 0 && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
              <strong>Deadline risk warning</strong>
              <p className="mt-1 text-xs text-muted-foreground">
                Your selected daily capacity and productive window provide at
                most {Math.min(minutes, windowMinutes)} minutes/day. Existing
                sessions and competing deadlines are included in these
                estimates:
              </p>
              <ul className="mt-2 list-disc pl-5 text-xs">
                {risks.map(risk => (
                  <li key={`${risk.title}-${risk.dueDate}`}>
                    {risk.title}: {risk.requiredMinutesThroughDeadline} min
                    total due by {risk.dueDate}, {risk.availableMinutes} min
                    available
                  </li>
                ))}
              </ul>
            </div>
          )}
          <Button
            onClick={request}
            disabled={generate.isPending || !deadlines.length}
            className="rounded-xl"
          >
            <Sparkles className="mr-1.5 h-4" />
            {generate.isPending
              ? "Creating schedule…"
              : "I consent — propose my schedule"}
          </Button>
          {error && (
            <p className="text-sm font-medium text-destructive" role="alert">
              {error}
            </p>
          )}
          {draft && (
            <div className="space-y-3">
              <div>
                <h3 className="font-semibold">{draft.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {draft.instructions}
                </p>
              </div>
              {draft.sessions.map((session, index) => (
                <div
                  key={`${session.date}-${session.startTime}-${index}`}
                  className="rounded-xl border p-3"
                >
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      value={session.subject}
                      onChange={event =>
                        patchSession(index, { subject: event.target.value })
                      }
                      aria-label="Session subject"
                    />
                    <Input
                      value={session.topic}
                      onChange={event =>
                        patchSession(index, { topic: event.target.value })
                      }
                      aria-label="Session topic"
                    />
                    <Input
                      type="date"
                      value={session.date}
                      onChange={event =>
                        patchSession(index, { date: event.target.value })
                      }
                      aria-label="Session date"
                    />
                    <Input
                      type="time"
                      value={session.startTime}
                      onChange={event =>
                        patchSession(index, { startTime: event.target.value })
                      }
                      aria-label="Session start time"
                    />
                    <Input
                      type="number"
                      min="15"
                      max="180"
                      value={session.duration}
                      onChange={event =>
                        patchSession(index, {
                          duration: Number(event.target.value),
                        })
                      }
                      aria-label="Session duration in minutes"
                    />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {session.reason} · supports {session.deadlineTitle}
                  </p>
                  <label className="mt-3 flex gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={Boolean(reviewed[index])}
                      onChange={event =>
                        setReviewed(current => ({
                          ...current,
                          [index]: event.target.checked,
                        }))
                      }
                    />
                    <span>
                      I reviewed and, if needed, edited this session before
                      adding it.
                    </span>
                  </label>
                </div>
              ))}
              <Button
                disabled={!allReviewed}
                onClick={apply}
                className="rounded-xl"
              >
                Add reviewed sessions to Study Planner
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
