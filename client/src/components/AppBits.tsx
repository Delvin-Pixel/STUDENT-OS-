/* STUDENT OS — shared UI bits used across pages.
   Daybreak style: soft shadow cards, 1rem radius, coral accents, pill chips. */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  PRIORITY_STYLES,
  STATUS_LABELS,
  cn,
  minutesToLabel,
  subjectColor,
} from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { Link } from "wouter";

export function EmptyState({
  title,
  text,
  actionLabel,
  onAction,
  route,
}: {
  title: string;
  text: string;
  actionLabel?: string;
  onAction?: () => void;
  route?: string;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-card/50 px-6 py-12 text-center">
      <img src="/logo.svg" alt="" className="h-14 w-14 opacity-70" />
      <h3 className="mt-4 font-display text-base font-semibold">{title}</h3>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">{text}</p>
      {actionLabel &&
        (route ? (
          <Button asChild className="mt-4">
            <Link href={route}>{actionLabel}</Link>
          </Button>
        ) : (
          <Button className="mt-4" onClick={onAction}>
            {actionLabel}
          </Button>
        ))}
    </div>
  );
}

/* Branded empty state — Daybreak sunrise gradient with a route-specific icon,
   warm coach microcopy and an optional CTA. Used on every "nothing here yet" surface. */
export function BrandedEmpty({
  icon: Icon,
  title,
  text,
  coach,
  actionLabel,
  onAction,
}: {
  icon: LucideIcon;
  title: string;
  text: string;
  coach?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="relative flex h-44 items-center justify-center bg-[linear-gradient(135deg,hsl(25_84%_62%)0%,#f0a954_45%,#b28ae8_100%)]">
        <div className="absolute inset-x-0 bottom-0 h-10 bg-[linear-gradient(180deg,transparent,hsl(25_84%_62%/15%))]" />
        <span className="absolute left-6 top-5 h-6 w-6 rounded-full bg-white/25" />
        <span className="absolute right-10 top-8 h-3.5 w-3.5 rounded-full bg-white/30" />
        <span className="absolute bottom-6 right-6 h-5 w-5 rounded-full bg-white/20" />
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/95 shadow-lg backdrop-blur">
          <Icon className="h-8 w-8 text-primary" />
        </span>
      </div>
      <div className="px-6 pb-6 pt-5 text-center">
        <h3 className="font-display text-lg font-bold">{title}</h3>
        <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted-foreground">
          {text}
        </p>
        {coach && (
          <p className="mx-auto mt-3 max-w-xs rounded-full bg-primary/8 px-3 py-1.5 text-xs font-medium text-primary">
            {coach}
          </p>
        )}
        {actionLabel && (
          <Button className="mt-4" onClick={onAction}>
            {actionLabel}
          </Button>
        )}
      </div>
    </div>
  );
}

export function SubjectBadge({
  subject,
  size = "sm",
}: {
  subject: string;
  size?: "sm" | "md";
}) {
  const c = subjectColor(subject);
  return (
    <span
      className={cn(
        c.soft,
        c.text,
        "inline-flex items-center rounded-full font-medium",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"
      )}
    >
      {subject}
    </span>
  );
}

export function PriorityChip({
  priority,
}: {
  priority: "high" | "medium" | "low";
}) {
  const s = PRIORITY_STYLES[priority];
  return (
    <span
      className={cn(
        s.chip,
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium capitalize"
      )}
    >
      <span className={cn(s.dot, "h-1.5 w-1.5 rounded-full")} />
      {priority}
    </span>
  );
}

export function ProgressBar({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "h-2 w-full overflow-hidden rounded-full bg-muted",
        className
      )}
    >
      <div
        className="h-full rounded-full bg-primary transition-all duration-500"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

export { Badge, Progress, STATUS_LABELS, minutesToLabel };
