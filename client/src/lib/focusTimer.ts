export type FocusTimerPhase = "focus" | "break";

/** Returns the idle timer duration after a preference or phase change. */
export function idleTimerSeconds(
  phase: FocusTimerPhase,
  prefs: { focus: number; breakLen: number }
) {
  return (phase === "focus" ? prefs.focus : prefs.breakLen) * 60;
}
