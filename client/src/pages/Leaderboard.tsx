/* STUDENT OS — Leaderboard. "Daybreak Workspace" style.
   Weekly XP competition vs device-local friend profiles. Simulated weekly
   scores are seeded around each friend's base level so rankings shift week to
   week. Sunrise gradient podium, glass bars, warm empty state. */

import { BrandedEmpty } from "@/components/AppBits";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useStore } from "@/contexts/StoreContext";
import {
  buildBoard,
  commentaryFor,
  friendWeeklyXp,
  weekKey,
} from "@/lib/leaderboard";
import { Crown, Medal, Plus, Trash2, Trophy } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

const EMOJI_PRESETS = [
  "😎",
  "🤓",
  "🧑‍💻",
  "👩‍🎓",
  "🦊",
  "🐻",
  "🦉",
  "🐱",
  "🚀",
  "⭐",
  "🎧",
  "📚",
];

function PodiumIcon({ rank }: { rank: number }) {
  if (rank === 1) return <Crown className="h-4 w-4 text-amber-500" />;
  if (rank === 2) return <Medal className="h-4 w-4 text-zinc-500" />;
  if (rank === 3) return <Medal className="h-4 w-4 text-orange-400" />;
  return (
    <span className="w-4 text-center text-xs font-bold text-muted-foreground">
      {rank}
    </span>
  );
}

export default function Leaderboard() {
  const { state, addFriend, deleteFriend } = useStore();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("😎");
  const [level, setLevel] = useState(400);
  const participantClaimRef = useRef(false);

  useEffect(() => {
    if (open) participantClaimRef.current = false;
  }, [open]);

  const board = useMemo(() => buildBoard(state), [state]);
  const week = weekKey();
  const topXp = Math.max(1, ...board.map(r => r.xp));
  const you = board.find(r => r.isYou);

  const line = useMemo(
    () =>
      board.length > 1 && you ? commentaryFor(you.rank, board.length) : "",
    [board, you]
  );

  return (
    <div className="mx-auto max-w-2xl">
      <header>
        <h1 className="font-display text-3xl font-bold">Leaderboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Weekly recorded XP showdown — top the board, claim the crown.
        </p>
      </header>

      {/* Podium card */}
      <div className="sunrise-sweep relative overflow-hidden rounded-3xl p-6 text-primary-foreground shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] opacity-90">
              <Trophy className="h-4 w-4" /> Week of {week}
            </div>
            <div className="mt-1 font-display text-2xl font-bold">
              {you?.rank === 1
                ? "You're leading the pack 👑"
                : `You're #${you?.rank ?? "–"} this week`}
            </div>
            {line && <div className="mt-1 text-sm opacity-90">{line}</div>}
          </div>
          <div className="hidden text-right sm:block">
            <div className="font-display text-3xl font-bold">
              {you?.xp ?? 0}
            </div>
            <div className="text-xs uppercase tracking-wider opacity-80">
              your weekly XP
            </div>
          </div>
        </div>

        {/* Bars */}
        <div className="mt-5 space-y-2.5">
          {board.map(r => (
            <div key={r.name} className="flex items-center gap-2.5">
              <span className="w-6 shrink-0">
                <PodiumIcon rank={r.rank} />
              </span>
              <span className="w-24 shrink-0 truncate text-sm font-medium">
                {r.emoji} {r.name}
                {r.isYou && (
                  <span className="ml-1 rounded-full bg-white/25 px-1.5 py-0.5 text-[9px] font-bold uppercase">
                    You
                  </span>
                )}
              </span>
              <div className="h-5 flex-1 overflow-hidden rounded-full bg-white/25">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${r.isYou ? "bg-white shadow" : "bg-white/70"}`}
                  style={{
                    width: `${Math.max(3, Math.round((r.xp / topXp) * 100))}%`,
                  }}
                />
              </div>
              <span className="w-14 shrink-0 text-right text-sm font-bold tabular-nums">
                {r.xp.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Friends list */}
      <div className="mt-6 flex items-center justify-between">
        <h2 className="font-display text-lg font-bold">Your rivals</h2>
        <Button
          variant="sunrise"
          size="sm"
          disabled={state.friends.length >= 5}
          onClick={() => setOpen(true)}
        >
          <Plus className="mr-1 h-4 w-4" /> Add rival
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Your score counts dated Student OS rewards earned this week. Up to 5
        rival scores are device-local weekly estimates around the level you set
        — every week is a new race.
      </p>

      {state.friends.length === 0 ? (
        <BrandedEmpty
          icon={Trophy}
          title="No rivals yet"
          text="Add a friend, set their study level, and compete for weekly XP glory."
        />
      ) : (
        <div className="mt-4 flex flex-col gap-2">
          {state.friends.map(f => (
            <div
              key={f.id}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5"
            >
              <span className="text-2xl">{f.emoji}</span>
              <div className="flex-1">
                <div className="text-sm font-semibold">{f.name}</div>
                <div className="text-xs text-muted-foreground">
                  Projected this week: ~{friendWeeklyXp(f).toLocaleString()} XP
                  · base {f.weeklyBase}/wk
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => deleteFriend(f.id)}
                aria-label={`Remove ${f.name}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display">Add a rival</DialogTitle>
            <DialogDescription>
              Pick a name, an avatar, and how serious they are about studying.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Amara"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Avatar</Label>
              <div className="flex flex-wrap gap-1.5">
                {EMOJI_PRESETS.map(e => (
                  <button
                    key={e}
                    onClick={() => setEmoji(e)}
                    className={`flex h-10 w-10 items-center justify-center rounded-xl text-lg transition-all ${
                      emoji === e
                        ? "border-2 border-primary bg-primary/10"
                        : "border border-border bg-card hover:bg-accent"
                    }`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Study level: {level} XP / week</Label>
              <Slider
                value={[level]}
                onValueChange={v => setLevel(v[0])}
                min={50}
                max={1500}
                step={25}
              />
              <div className="flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
                <span>Casual</span>
                <span>Grinder</span>
                <span>Machine</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="sunrise"
              disabled={!name.trim()}
              onClick={() => {
                if (participantClaimRef.current) return;
                participantClaimRef.current = true;
                addFriend(name.trim(), emoji, level);
                setName("");
                setOpen(false);
              }}
            >
              Add rival
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
