/* STUDENT OS — Goals. Create goals with target/current/unit, bump progress,
   mark complete, track deadlines. */

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
import { validateNewGoal } from "@/lib/goalValidation";
import type { Goal } from "@/lib/types";
import { cn, daysFromNow } from "@/lib/utils";
import { CheckCircle2, Minus, Plus, Target, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
type GoalCategory = "study" | "tasks" | "flashcards" | "focus" | "custom";

const CATEGORIES: { value: GoalCategory; label: string; unit: string }[] = [
  { value: "study", label: "Study hours", unit: "hours" },
  { value: "flashcards", label: "Flashcards reviewed", unit: "cards" },
  { value: "focus", label: "Focus sessions", unit: "sessions" },
  { value: "tasks", label: "Tasks completed", unit: "tasks" },
  { value: "custom", label: "Custom", unit: "units" },
];

export default function Goals() {
  const { state, addGoal, updateGoal, deleteGoal, bumpGoal, completeGoal } =
    useStore();
  const [dialogOpen, setDialogOpen] = useState(false);

  const sorted = useMemo(
    () =>
      [...state.goals].sort(
        (a, b) => Number(a.completed) - Number(b.completed)
      ),
    [state.goals]
  );
  const completed = state.goals.filter(g => g.completed).length;
  const active = sorted.filter(g => !g.completed);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">
            Goals
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {completed} completed · {active.length} active
          </p>
        </div>
        <Button variant="sunrise" onClick={() => setDialogOpen(true)}>
          + New goal
        </Button>
      </div>

      <div className="mt-5 flex flex-col gap-3">
        {sorted.length === 0 ? (
          <BrandedEmpty
            icon={Target}
            title="No goals yet"
            text="Set a goal — even a small one — and watch yourself hit it."
            coach="Start with one goal you can finish this week. You've got this."
            actionLabel="+ New Goal"
            onAction={() => setDialogOpen(true)}
          />
        ) : (
          sorted.map(g => {
            const pct =
              g.target > 0 ? Math.min(100, (g.current / g.target) * 100) : 0;
            const daysLeft = g.deadline ? daysFromNow(g.deadline) : null;
            return (
              <div
                key={g.id}
                className={cn(
                  "rounded-2xl border bg-card p-5 shadow-sm lift-card",
                  g.completed && "opacity-75"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3
                        className={cn(
                          "text-sm font-semibold",
                          g.completed && "text-muted-foreground line-through"
                        )}
                      >
                        {g.name}
                      </h3>
                      {g.completed ? (
                        <Badge className="rounded-full bg-primary/10 text-primary text-[11px]">
                          Completed
                        </Badge>
                      ) : daysLeft !== null && daysLeft <= 7 ? (
                        <Badge className="rounded-full bg-destructive/10 text-destructive text-[11px]">
                          {daysLeft <= 0 ? "Overdue" : `${daysLeft} days left`}
                        </Badge>
                      ) : null}
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      <span className="font-display text-lg font-bold">
                        {Number.isInteger(g.current)
                          ? g.current
                          : g.current.toFixed(1)}{" "}
                        / {g.target}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {g.unit}
                      </span>
                      <span className="text-xs font-medium text-muted-foreground">
                        ({Math.round(pct)}%)
                      </span>
                    </div>
                    <ProgressBar value={pct} className="mt-2" />
                  </div>
                  <button
                    onClick={() => deleteGoal(g.id)}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Delete goal"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {!g.completed && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-full bg-card"
                        onClick={() => bumpGoal(g.id, -1)}
                        disabled={g.current <= 0}
                        aria-label="Decrease progress"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-full bg-card"
                        onClick={() => bumpGoal(g.id, 1)}
                      >
                        <Plus className="mr-1 h-3.5 w-3.5" /> Add progress
                      </Button>
                      <Button
                        size="sm"
                        className="rounded-full"
                        onClick={() => completeGoal(g.id)}
                      >
                        <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Mark done
                      </Button>
                    </>
                  )}
                  <div className="flex-1" />
                  {g.completed && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full bg-card text-muted-foreground"
                      onClick={() => updateGoal(g.id, { completed: false })}
                    >
                      Reopen
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <GoalDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={addGoal}
      />
    </div>
  );
}

function GoalDialog({
  open,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSave: (data: Omit<Goal, "id" | "completed">) => boolean;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<GoalCategory>("study");
  const [target, setTarget] = useState(10);
  const [deadline, setDeadline] = useState("");
  const [customUnit, setCustomUnit] = useState("");
  const [error, setError] = useState("");
  const saveClaimRef = useRef(false);

  useEffect(() => {
    if (open) saveClaimRef.current = false;
  }, [open]);

  const unit =
    category === "custom"
      ? customUnit.trim() || "units"
      : CATEGORIES.find(c => c.value === category)!.unit;

  const submit = () => {
    const goal = {
      name: name.trim(),
      category,
      target,
      current: 0,
      unit,
      deadline,
    };
    const validationError = validateNewGoal(goal);
    if (validationError) return setError(validationError);
    if (saveClaimRef.current) return;
    saveClaimRef.current = true;
    if (!onSave(goal)) {
      saveClaimRef.current = false;
      return setError(
        "Student OS could not save that goal. Review the details and try again."
      );
    }
    setName("");
    setCategory("study");
    setTarget(10);
    setDeadline("");
    setCustomUnit("");
    setError("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">New goal</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div>
            <Label className="mb-1.5 block text-xs font-semibold">
              What do you want to achieve?
            </Label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Study Physics for 10 hours"
              className="rounded-xl"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5 block text-xs font-semibold">
                Category
              </Label>
              <Select
                value={category}
                onValueChange={v => setCategory(v as GoalCategory)}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block text-xs font-semibold">
                Target
              </Label>
              <Input
                type="number"
                min={1}
                value={target}
                onChange={e => setTarget(Number(e.target.value))}
                className="rounded-xl"
              />
            </div>
          </div>
          {category === "custom" && (
            <div>
              <Label className="mb-1.5 block text-xs font-semibold">
                Unit name
              </Label>
              <Input
                value={customUnit}
                onChange={e => setCustomUnit(e.target.value)}
                placeholder="e.g. pages, chapters"
                className="rounded-xl"
              />
            </div>
          )}
          <div>
            <Label className="mb-1.5 block text-xs font-semibold">
              Deadline (optional)
            </Label>
            <Input
              type="date"
              value={deadline}
              onChange={e => setDeadline(e.target.value)}
              className="rounded-xl"
            />
          </div>
          {error && (
            <p className="text-xs font-medium text-destructive">{error}</p>
          )}
          <Button onClick={submit} variant="sunrise">
            Set goal
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
