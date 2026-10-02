/* STUDENT OS — recurring timetable with month, week, and focused day agendas. */

import { BrandedEmpty, SubjectBadge } from "@/components/AppBits";
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
import {
  agendaEventsForDate,
  agendaEventsForDay,
  buildCalendarMonth,
  shiftMonth,
  shiftWeekday,
  weekdayIndex,
  WEEKDAYS,
} from "@/lib/agenda";
import type { TimetableEvent } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  Calendar,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  LayoutGrid,
  List,
  Pencil,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

const TYPE_STYLES: Record<TimetableEvent["type"], string> = {
  class: "bg-primary",
  study: "bg-[oklch(0.62_0.11_195)]",
  exam: "bg-destructive",
  personal: "bg-muted-foreground/60",
};
type View = "month" | "week" | "day";

export default function Timetable() {
  const { state, addEvent, updateEvent, deleteEvent } = useStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TimetableEvent | null>(null);
  const [view, setView] = useState<View>("month");
  const [selectedDay, setSelectedDay] = useState(weekdayIndex);
  const [month, setMonth] = useState(() => new Date());
  const today = weekdayIndex();
  const dayMap = useMemo(
    () =>
      new Map(
        WEEKDAYS.map((_, day) => [day, agendaEventsForDay(state.events, day)])
      ),
    [state.events]
  );
  const edit = (event: TimetableEvent) => {
    setEditing(event);
    setDialogOpen(true);
  };
  const openDate = (date: Date) => {
    setSelectedDay(weekdayIndex(date));
    setView("day");
  };

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">
            Timetable
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {state.events.length} recurring event
            {state.events.length === 1 ? "" : "s"} in your study schedule
          </p>
        </div>
        <Button
          variant="sunrise"
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          + Add event
        </Button>
      </div>
      {!state.events.length ? (
        <div className="mt-5">
          <BrandedEmpty
            icon={CalendarDays}
            title="Your schedule is ready when you are"
            text="Add classes, study sessions, exams and personal plans. You can review them by month, week, or day."
            coach="Start with classes — they give your study plan its shape."
            actionLabel="+ Add Event"
            onAction={() => setDialogOpen(true)}
          />
        </div>
      ) : (
        <>
          <ViewToolbar
            view={view}
            setView={setView}
            selectedDay={selectedDay}
            setSelectedDay={setSelectedDay}
            month={month}
            setMonth={setMonth}
          />
          {view === "month" && (
            <MonthView
              month={month}
              events={state.events}
              onOpenDate={openDate}
            />
          )}
          {view === "week" && (
            <WeekView
              dayMap={dayMap}
              today={today}
              onOpenDay={day => {
                setSelectedDay(day);
                setView("day");
              }}
            />
          )}
          {view === "day" && (
            <DayView
              day={selectedDay}
              events={dayMap.get(selectedDay) ?? []}
              onPrevious={() => setSelectedDay(day => shiftWeekday(day, -1))}
              onNext={() => setSelectedDay(day => shiftWeekday(day, 1))}
              onEdit={edit}
              onDelete={deleteEvent}
            />
          )}
        </>
      )}
      <EventDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        onSave={data =>
          editing ? updateEvent(editing.id, data) : addEvent(data)
        }
      />
    </div>
  );
}

function ViewToolbar({
  view,
  setView,
  selectedDay,
  setSelectedDay,
  month,
  setMonth,
}: {
  view: View;
  setView: (view: View) => void;
  selectedDay: number;
  setSelectedDay: (day: number | ((day: number) => number)) => void;
  month: Date;
  setMonth: (month: Date | ((month: Date) => Date)) => void;
}) {
  const label = month.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
  return (
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-2 shadow-sm">
      <div
        className="flex rounded-xl bg-muted p-1"
        role="tablist"
        aria-label="Timetable view"
      >
        {(
          [
            { id: "month", icon: Calendar, label: "Month" },
            { id: "week", icon: LayoutGrid, label: "Week" },
            { id: "day", icon: List, label: "Day" },
          ] as const
        ).map(({ id, icon: Icon, label: text }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={view === id}
            onClick={() => setView(id)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold",
              view === id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {text}
          </button>
        ))}
      </div>
      {view === "month" ? (
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded-lg p-2 hover:bg-accent"
            aria-label="Previous month"
            onClick={() => setMonth(current => shiftMonth(current, -1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-28 text-center text-xs font-semibold">
            {label}
          </span>
          <button
            type="button"
            className="rounded-lg p-2 hover:bg-accent"
            aria-label="Next month"
            onClick={() => setMonth(current => shiftMonth(current, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      ) : view === "day" ? (
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded-lg p-2 hover:bg-accent"
            aria-label="Previous day"
            onClick={() => setSelectedDay(day => shiftWeekday(day, -1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-24 text-center text-xs font-semibold">
            {WEEKDAYS[selectedDay]}
          </span>
          <button
            type="button"
            className="rounded-lg p-2 hover:bg-accent"
            aria-label="Next day"
            onClick={() => setSelectedDay(day => shiftWeekday(day, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

function MonthView({
  month,
  events,
  onOpenDate,
}: {
  month: Date;
  events: TimetableEvent[];
  onOpenDate: (date: Date) => void;
}) {
  const days = buildCalendarMonth(month);
  const today = new Date();
  return (
    <div className="mt-4 overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
      <div className="min-w-[720px]">
        <div className="grid grid-cols-7 border-b border-border bg-muted/40">
          {WEEKDAYS.map(day => (
            <div
              key={day}
              className="px-2 py-2 text-center text-[11px] font-semibold text-muted-foreground"
            >
              {day.slice(0, 3)}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map(({ date, inMonth }) => {
            const scheduled = agendaEventsForDate(events, date);
            const isToday = date.toDateString() === today.toDateString();
            return (
              <button
                key={date.toISOString()}
                type="button"
                onClick={() => onOpenDate(date)}
                className={cn(
                  "min-h-28 border-b border-r border-border p-2 text-left transition-colors hover:bg-accent/50",
                  !inMonth && "bg-muted/30 text-muted-foreground",
                  isToday && "bg-primary/5"
                )}
                aria-label={`Open ${date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })} agenda`}
              >
                <span
                  className={cn(
                    "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                    isToday && "bg-primary text-primary-foreground"
                  )}
                >
                  {date.getDate()}
                </span>
                <div className="mt-1 space-y-1">
                  {scheduled.slice(0, 3).map(event => (
                    <span
                      key={`${date.toDateString()}-${event.id}`}
                      className={cn(
                        "block truncate rounded px-1 py-0.5 text-[10px] font-medium text-white",
                        TYPE_STYLES[event.type]
                      )}
                    >
                      {event.startTime} {event.title}
                    </span>
                  ))}
                  {scheduled.length > 3 && (
                    <span className="block text-[10px] text-muted-foreground">
                      +{scheduled.length - 3} more
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function WeekView({
  dayMap,
  today,
  onOpenDay,
}: {
  dayMap: Map<number, TimetableEvent[]>;
  today: number;
  onOpenDay: (day: number) => void;
}) {
  return (
    <div className="mt-4 overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
      <div className="grid min-w-[780px] grid-cols-7 divide-x divide-border">
        {WEEKDAYS.map((day, index) => {
          const events = dayMap.get(index) ?? [];
          return (
            <div key={day} className="min-h-72 p-3">
              <button
                type="button"
                onClick={() => onOpenDay(index)}
                className="mb-3 w-full text-left"
              >
                <span
                  className={cn(
                    "inline-flex rounded-full px-2 py-1 text-xs font-semibold",
                    index === today
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground"
                  )}
                >
                  {day.slice(0, 3)}
                </span>
                <span className="ml-1 text-[11px] text-muted-foreground">
                  {events.length}
                </span>
              </button>
              <div className="space-y-2">
                {events.map(event => (
                  <MiniEvent key={event.id} event={event} />
                ))}
                {!events.length && (
                  <p className="pt-5 text-center text-[11px] text-muted-foreground">
                    Free
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DayView({
  day,
  events,
  onPrevious,
  onNext,
  onEdit,
  onDelete,
}: {
  day: number;
  events: TimetableEvent[];
  onPrevious: () => void;
  onNext: () => void;
  onEdit: (event: TimetableEvent) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="mt-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-lg font-bold">{WEEKDAYS[day]}</h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded-lg p-2 hover:bg-accent"
            onClick={onPrevious}
            aria-label="Previous day"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-xs text-muted-foreground">
            {events.length} event{events.length === 1 ? "" : "s"}
          </span>
          <button
            type="button"
            className="rounded-lg p-2 hover:bg-accent"
            onClick={onNext}
            aria-label="Next day"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      {events.length ? (
        <div className="space-y-3">
          {events.map(event => (
            <AgendaEvent
              key={event.id}
              event={event}
              onEdit={() => onEdit(event)}
              onDelete={() => onDelete(event.id)}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Nothing planned for {WEEKDAYS[day]}. Choose another day or add an
          event.
        </div>
      )}
    </div>
  );
}

function MiniEvent({ event }: { event: TimetableEvent }) {
  return (
    <div className="rounded-xl border border-border bg-background/60 p-2">
      <div
        className={cn(
          "mb-2 h-1.5 w-full rounded-full",
          TYPE_STYLES[event.type]
        )}
      />
      <div className="truncate text-xs font-semibold">{event.title}</div>
      <div className="mt-0.5 text-[11px] text-muted-foreground">
        {event.startTime} – {event.endTime}
      </div>
    </div>
  );
}
function AgendaEvent({
  event,
  onEdit,
  onDelete,
}: {
  event: TimetableEvent;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-background/60 p-3">
      <div
        className={cn(
          "h-10 w-1.5 shrink-0 rounded-full",
          TYPE_STYLES[event.type]
        )}
      />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold">{event.title}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {event.startTime} – {event.endTime}
          </span>
          {event.subject && <SubjectBadge subject={event.subject} />}
          {event.location && <span>{event.location}</span>}
        </div>
      </div>
      <div className="flex gap-1">
        <button
          onClick={onEdit}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent"
          aria-label={`Edit ${event.title}`}
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onDelete}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          aria-label={`Delete ${event.title}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function EventDialog({
  open,
  onOpenChange,
  editing,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: TimetableEvent | null;
  onSave: (data: Omit<TimetableEvent, "id">) => boolean;
}) {
  const { state } = useStore();
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [day, setDay] = useState(0);
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("09:00");
  const [type, setType] = useState<TimetableEvent["type"]>("class");
  const [location, setLocation] = useState("");
  const [error, setError] = useState("");
  const saveClaimRef = useRef(false);
  useEffect(() => {
    if (editing) {
      setTitle(editing.title);
      setSubject(editing.subject);
      setDay(editing.day);
      setStartTime(editing.startTime);
      setEndTime(editing.endTime);
      setType(editing.type);
      setLocation(editing.location);
    } else {
      setTitle("");
      setSubject("");
      setDay(0);
      setStartTime("08:00");
      setEndTime("09:00");
      setType("class");
      setLocation("");
    }
    setError("");
    if (open) saveClaimRef.current = false;
  }, [editing, open]);
  const submit = () => {
    if (!title.trim()) return setError("Give your event a name.");
    if (endTime <= startTime)
      return setError("End time must be after start time.");
    if (!editing && saveClaimRef.current) return;
    if (!editing) saveClaimRef.current = true;
    const accepted = onSave({
      title: title.trim(),
      subject,
      day,
      startTime,
      endTime,
      type,
      location: location.trim(),
      notes: "",
    });
    if (!accepted) {
      if (!editing) saveClaimRef.current = false;
      return setError(
        "That time conflicts with another event. Your details are still here—choose another slot."
      );
    }
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">
            {editing ? "Edit event" : "Add event"}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div>
            <Label className="mb-1.5 block text-xs font-semibold">Title</Label>
            <Input
              value={title}
              onChange={event => setTitle(event.target.value)}
              placeholder="e.g. Physics class"
              className="rounded-xl"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5 block text-xs font-semibold">Day</Label>
              <Select
                value={String(day)}
                onValueChange={value => setDay(Number(value))}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WEEKDAYS.map((name, index) => (
                    <SelectItem key={name} value={String(index)}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block text-xs font-semibold">Type</Label>
              <Select
                value={type}
                onValueChange={value =>
                  setType(value as TimetableEvent["type"])
                }
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="class">Class</SelectItem>
                  <SelectItem value="study">Study</SelectItem>
                  <SelectItem value="exam">Exam</SelectItem>
                  <SelectItem value="personal">Personal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5 block text-xs font-semibold">
                Start
              </Label>
              <Input
                type="time"
                value={startTime}
                onChange={event => setStartTime(event.target.value)}
                className="rounded-xl"
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs font-semibold">End</Label>
              <Input
                type="time"
                value={endTime}
                onChange={event => setEndTime(event.target.value)}
                className="rounded-xl"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5 block text-xs font-semibold">
                Subject
              </Label>
              <Select
                value={subject || "_none"}
                onValueChange={value =>
                  setSubject(value === "_none" ? "" : value)
                }
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">None</SelectItem>
                  {(state.profile?.subjects ?? []).map(name => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block text-xs font-semibold">
                Location
              </Label>
              <Input
                value={location}
                onChange={event => setLocation(event.target.value)}
                placeholder="e.g. Room 7"
                className="rounded-xl"
              />
            </div>
          </div>
          {error && (
            <p className="text-xs font-medium text-destructive">{error}</p>
          )}
          <Button onClick={submit} className="rounded-xl">
            {editing ? "Save changes" : "Add event"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
