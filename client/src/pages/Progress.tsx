/* STUDENT OS — Progress Insights. XP/level, study-time charts, subject
   breakdown, streak, goals completed, achievements gallery. */

import { Badge } from "@/components/ui/badge";
import { useStore } from "@/contexts/StoreContext";
import {
  completedSessionMinutes,
  weeklyLearningMinutes,
} from "@/lib/progressMetrics";
import {
  cn,
  dayCountLabel,
  isoDate,
  levelForXp,
  minutesToLabel,
  shortDay,
  weekDays,
} from "@/lib/utils";
import { BookOpen, Brain, Flame, Target, Trophy, Zap } from "lucide-react";
import { useMemo } from "react";
import {
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const PIE_COLORS = [
  "oklch(0.65 0.19 35)",
  "oklch(0.62 0.11 195)",
  "oklch(0.65 0.13 145)",
  "oklch(0.68 0.14 60)",
  "oklch(0.6 0.17 300)",
  "oklch(0.55 0.1 250)",
];

export default function Progress() {
  const { state } = useStore();
  const level = levelForXp(state.xp);
  const week = weekDays();

  /* cumulative XP over last 7 days */
  const cumulative = (() => {
    const perDay = new Map<string, number>();
    const todayIdx = week.length - 1;
    // estimate daily xp: completed sessions/50, focus/10, tasks completed date
    state.sessions
      .filter(s => s.status === "completed")
      .forEach(s => {
        perDay.set(s.date, (perDay.get(s.date) ?? 0) + 20);
      });
    state.focusSessions.forEach(f => {
      perDay.set(
        f.date,
        (perDay.get(f.date) ?? 0) + Math.round(f.duration / 10)
      );
    });
    state.tasks
      .filter(t => t.status === "completed" && t.completedAt)
      .forEach(t => {
        const completedDay = isoDate(new Date(t.completedAt!));
        perDay.set(completedDay, (perDay.get(completedDay) ?? 0) + 15);
      });
    return week.map((d, i) => ({
      day: shortDay(d),
      xp: Array.from(perDay.entries())
        .filter(([day]) => day <= d)
        .reduce((a, [, v]) => a + v, 0),
      dayIndex: i - todayIdx,
    }));
  })();

  /* subject minutes — last 30 days */
  const subjectMinutes = useMemo(() => {
    const map = new Map<string, number>();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const cutoffStr = isoDate(cutoff);
    state.sessions
      .filter(s => s.status === "completed" && s.date >= cutoffStr)
      .forEach(s =>
        map.set(
          s.subject,
          (map.get(s.subject) ?? 0) + completedSessionMinutes(s)
        )
      );
    state.focusSessions
      .filter(f => f.date >= cutoffStr)
      .forEach(f => {
        const key = f.subject || "General";
        map.set(key, (map.get(key) ?? 0) + f.duration);
      });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, minutes]) => ({
        name,
        minutes: Math.round((minutes / 60) * 10) / 10,
      }));
  }, [state.sessions, state.focusSessions]);

  const totalMinutes = subjectMinutes.reduce((a, s) => a + s.minutes, 0);
  const completedGoals = state.goals.filter(g => g.completed).length;
  const unlocked = state.achievements.filter(a => a.unlocked);
  const weekMinutes = weeklyLearningMinutes(
    state.sessions,
    state.focusSessions,
    week
  );

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="font-display text-3xl font-bold tracking-tight">
        Progress
      </h1>

      {/* Level card */}
      <div className="mt-4 rounded-2xl bg-gradient-to-br from-primary via-[oklch(0.68_0.16_45)] to-[oklch(0.62_0.11_195)] p-5 text-primary-foreground shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider opacity-80">
              Current level
            </div>
            <div className="font-display text-3xl font-bold">
              {level.current.level} · {level.current.name}
            </div>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-1.5 text-sm font-bold">
            <Zap className="h-4 w-4" /> {state.xp} XP
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/20">
          <div
            className="h-full rounded-full bg-white transition-all"
            style={{ width: `${Math.round(level.progress * 100)}%` }}
          />
        </div>
        {level.next && (
          <p className="mt-2 text-xs opacity-85">
            {level.nextMin - state.xp} XP to reach Level {level.next.level} —{" "}
            {level.next.name}
          </p>
        )}
      </div>

      {/* Stats row */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          icon={Flame}
          label="Streak"
          value={dayCountLabel(state.streakDays)}
        />
        <StatCard
          icon={BookOpen}
          label="This week"
          value={minutesToLabel(weekMinutes)}
        />
        <StatCard
          icon={Target}
          label="Goals done"
          value={String(completedGoals)}
        />
        <StatCard
          icon={Trophy}
          label="Badges"
          value={`${unlocked.length}/${state.achievements.length}`}
        />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {/* XP trend */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <h2 className="font-display text-sm font-semibold">
            XP trend (this week)
          </h2>
          <div className="mt-2 h-44">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={cumulative}
                margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
              >
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(v: number) => [`${v} XP`, "Cumulative"]}
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    fontSize: 12,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="xp"
                  stroke="oklch(0.65 0.19 35)"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Subject breakdown */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <h2 className="font-display text-sm font-semibold">
            Time by subject (last 30 days)
          </h2>
          {subjectMinutes.length === 0 ? (
            <p className="mt-8 text-center text-xs text-muted-foreground">
              Complete a few study sessions to see your subject breakdown.
            </p>
          ) : (
            <div className="mt-1 flex items-center gap-3">
              <div className="h-44 w-44 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={subjectMinutes}
                      dataKey="minutes"
                      nameKey="name"
                      innerRadius={35}
                      outerRadius={62}
                      paddingAngle={2}
                    >
                      {subjectMinutes.map((_, i) => (
                        <Cell
                          key={i}
                          fill={PIE_COLORS[i % PIE_COLORS.length]}
                        />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-muted-foreground">
                  {totalMinutes} h total
                </div>
                <div className="mt-2 flex flex-col gap-1.5">
                  {subjectMinutes.slice(0, 6).map((s, i) => (
                    <div
                      key={s.name}
                      className="flex items-center gap-2 text-xs"
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{
                          background: PIE_COLORS[i % PIE_COLORS.length],
                        }}
                      />
                      <span className="min-w-0 flex-1 truncate">{s.name}</span>
                      <span className="font-medium">{s.minutes} h</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Goals completed */}
      <section className="mt-6">
        <h2 className="font-display text-lg font-semibold">Goals completed</h2>
        {completedGoals === 0 ? (
          <div className="mt-3 rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Complete your first goal to see it here.
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {state.goals
              .filter(g => g.completed)
              .map(g => (
                <Badge
                  key={g.id}
                  variant="secondary"
                  className="rounded-full px-3 py-1.5 text-xs font-medium"
                >
                  <Target className="mr-1 h-3 w-3 text-primary" /> {g.name}
                </Badge>
              ))}
          </div>
        )}
      </section>

      {/* Achievements */}
      <section className="mt-6">
        <h2 className="font-display text-lg font-semibold">Achievements</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {state.achievements.map(a => {
            const Icon =
              a.id === "streak_7" || a.id === "perfect_week"
                ? Flame
                : a.id === "flashcard_master" || a.id === "bookworm"
                  ? Brain
                  : Trophy;
            return (
              <div
                key={a.id}
                className={cn(
                  "flex flex-col items-center rounded-2xl border p-4 text-center transition-all",
                  a.unlocked
                    ? "border-primary/30 bg-primary/5 shadow-sm"
                    : "border-border bg-muted/30 opacity-60 grayscale"
                )}
              >
                <Icon
                  className={cn(
                    "h-6 w-6",
                    a.unlocked ? "text-primary" : "text-muted-foreground"
                  )}
                />
                <div className="mt-2 text-xs font-semibold">{a.name}</div>
                <div className="mt-0.5 text-[10px] text-muted-foreground">
                  {a.description}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="mt-1 font-display text-xl font-bold">{value}</div>
    </div>
  );
}
