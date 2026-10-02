/* STUDENT OS — Habit tracker (Daybreak Workspace style).
   Daily check-off grid with streak heat, glass card, pop-in animation. */

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useStore } from "@/contexts/StoreContext";
import { isoDate, todayStr } from "@/lib/utils";
import { Check, Plus, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

const EMOJIS = ["📖", "💧", "🏃", "🧘", "✍️", "🎧", "🧮", "🌙", "🍎", "💤"];
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function dateOfOffset(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return isoDate(d);
}

function dayOfWeekLabel(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  // JS: 0 = Sunday ... 6 = Saturday; convert to Mon-first index
  const idx = (d.getDay() + 6) % 7;
  return DAY_LABELS[idx];
}

export default function HabitsTracker() {
  const { state, addHabit, deleteHabit, toggleHabit } = useStore();
  const today = todayStr();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(EMOJIS[0]);
  const createClaimRef = useRef(false);

  useEffect(() => {
    if (open) createClaimRef.current = false;
  }, [open]);

  const window = useMemo(
    () => Array.from({ length: 7 }, (_, i) => dateOfOffset(i - 6)),
    []
  );

  const streakOf = (habitId: string) => {
    let streak = 0;
    for (let i = 0; i < 365; i++) {
      const d = dateOfOffset(-i);
      const done = state.habitLog[d]?.includes(habitId) ?? false;
      if (!done) break;
      streak += 1;
    }
    return streak;
  };

  const submit = () => {
    const n = name.trim();
    if (!n) return toast.error("Give your habit a name.");
    if (createClaimRef.current) return;
    createClaimRef.current = true;
    if (!addHabit(n, emoji)) {
      createClaimRef.current = false;
      return;
    }
    setName("");
    setOpen(false);
  };

  if (state.habits.length === 0) {
    return (
      <section className="glass rounded-2xl border border-border p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold">Daily habits</h2>
          <Button
            variant="sunrise"
            size="sm"
            className="px-4"
            onClick={() => setOpen(true)}
          >
            <Plus className="h-4 w-4" /> Add habit
          </Button>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Stack small wins every day — hydration, reading, sleep, revision.
          Every check earns +5 XP and builds your streak.
        </p>
        <div className="mt-4 flex gap-2">
          {["📖 Read 20 min", "💧 2L water", "🌙 Sleep by 11"].map((s, i) => (
            <span
              key={s}
              className="float-up rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              {s}
            </span>
          ))}
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="glass rounded-2xl border border-border p-5 pop-in">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold">Daily habits</h2>
          <Button
            variant="sunrise"
            size="sm"
            className="px-4"
            onClick={() => setOpen(true)}
          >
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>

        <div className="mt-4 space-y-2">
          {state.habits.map(habit => {
            const streak = streakOf(habit.id);
            return (
              <div
                key={habit.id}
                className="rounded-xl border border-border bg-card/80 px-3 py-2.5"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-lg leading-none">{habit.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium">{habit.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {streak > 0
                        ? `🔥 ${streak}-day streak · +5 XP per check`
                        : "Check it today · +5 XP"}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteHabit(habit.id)}
                    aria-label={`Remove ${habit.name}`}
                    className="rounded-full p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="mt-2 flex gap-1.5">
                  {window.map(d => {
                    const done = state.habitLog[d]?.includes(habit.id) ?? false;
                    const isToday = d === today;
                    return (
                      <button
                        key={d}
                        onClick={() => toggleHabit(habit.id, d)}
                        className={`flex h-8 flex-1 flex-col items-center justify-center rounded-lg text-[9px] font-semibold transition-all duration-150 ${
                          done
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : isToday
                              ? "border-2 border-primary/40 bg-accent text-accent-foreground hover:bg-primary/10"
                              : "border border-border bg-secondary/60 text-muted-foreground hover:bg-secondary"
                        } ${done && isToday ? "wiggle" : ""}`}
                      >
                        <span>{dayOfWeekLabel(d)}</span>
                        {done && <Check className="h-2.5 w-2.5 mt-0.5" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>New daily habit</DialogTitle>
          </DialogHeader>
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Read for 20 minutes"
            className="rounded-xl"
            onKeyDown={e => e.key === "Enter" && submit()}
          />
          <div className="flex flex-wrap gap-2">
            {EMOJIS.map(em => (
              <button
                key={em}
                onClick={() => setEmoji(em)}
                className={`text-xl rounded-lg border p-2 transition-transform ${
                  emoji === em
                    ? "border-primary bg-accent scale-110"
                    : "border-border"
                }`}
              >
                {em}
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="sunrise" onClick={submit}>
              Add habit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
