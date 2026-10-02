import {
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  GraduationCap,
  Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";

const BUILD_STEPS: Array<{
  label: string;
  icon: typeof CheckCircle2;
  duration: number;
}> = [
  { label: "Saving your profile", icon: GraduationCap, duration: 550 },
  { label: "Setting up your study planner", icon: CalendarDays, duration: 650 },
  { label: "Preparing your Daily Lessons", icon: BookOpenCheck, duration: 750 },
];

/**
 * Animated "building your workspace" screen shown after onboarding completes.
 * Each step pulses in with a shimmer badge and check animation, then hands off
 * to the dashboard. The shimmer respects reduced motion preferences.
 */
export default function WorkspaceBuilding({
  subjects,
  level,
  onDone,
}: {
  subjects: string[];
  level: string;
  onDone: () => void;
}) {
  const [startedAt] = useState(() => Date.now());
  const elapsed = Date.now() - startedAt;

  // Hand off to the dashboard after the full animation completes.
  useEffect(() => {
    const total =
      BUILD_STEPS.reduce((sum, step) => sum + step.duration, 0) + 400;
    const id = setTimeout(onDone, total);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-6 py-10 text-center">
      <div className="gentle-bob mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-primary/10 text-primary">
        <Sparkles className="h-9 w-9" />
      </div>
      <h1 className="mt-6 font-display text-3xl font-bold">
        Building your workspace
      </h1>
      <p className="mt-3 max-w-xs text-sm text-muted-foreground">
        Daily Lessons for{" "}
        <strong className="text-foreground">{subjects.join(", ")}</strong> at{" "}
        <strong className="text-foreground">{level}</strong> level.
      </p>

      <div className="mt-8 w-full max-w-xs space-y-3">
        {BUILD_STEPS.map((step, index) => (
          <StepCard
            key={step.label}
            step={step}
            index={index}
            elapsed={elapsed}
          />
        ))}
      </div>
    </div>
  );
}

function StepCard({
  step,
  index,
  elapsed,
}: {
  step: { label: string; icon: typeof CheckCircle2; duration: number };
  index: number;
  elapsed: number;
}) {
  // Steps appear staggered (150ms apart); each checks off after its own duration.
  const showAt = index * 150;
  const doneAt = showAt + step.duration;
  const [shown, setShown] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const showId = setTimeout(
      () => setShown(true),
      Math.max(0, showAt - elapsed)
    );
    const doneId = setTimeout(
      () => setDone(true),
      Math.max(0, doneAt - elapsed)
    );
    return () => {
      clearTimeout(showId);
      clearTimeout(doneId);
    };
  }, [showAt, doneAt, elapsed]);

  const Icon = step.icon;
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border bg-card px-4 py-3 text-left text-sm font-medium transition-all duration-300 ${
        shown
          ? "scale-100 opacity-100"
          : "pointer-events-none scale-95 opacity-0"
      } ${done ? "border-primary/25 bg-primary/8" : "border-border"}`}
      style={{ transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)" }}
    >
      {done ? (
        <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
      ) : (
        <Icon
          className={`h-5 w-5 shrink-0 ${shown ? "skeleton-shimmer text-primary/60" : "bg-accent text-transparent"}`}
        />
      )}
      <span className={done ? "text-foreground" : "text-muted-foreground"}>
        {step.label}
      </span>
      {done && (
        <span className="ml-auto text-xs text-muted-foreground">Done</span>
      )}
    </div>
  );
}
