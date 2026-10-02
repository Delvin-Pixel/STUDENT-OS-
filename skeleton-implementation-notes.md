# Skeleton screen implementation notes (15 Aug) — PROGRESS

## Status

1. DONE: index.css — added `.skeleton-shimmer` keyframe (skeletonShimmer) and `.gentle-bob`, both gated by prefers-reduced-motion.
2. DONE: `client/src/components/DailyLessonSkeleton.tsx` — full shimmer skeleton mirroring the lesson card (banner, goals, 3 sections, key terms/quick check grid, "Preparing your lesson…" loader row). Uses role=status + aria-label.
3. DONE: DailyLesson.tsx — replaced plain spinner Card with `<DailyLessonSkeleton topic />` plus a one-line status caption "Generating today's lesson — matching {topic} to your {level} level…".

## Remaining

4. Workspace-generation skeleton/animation: add an animated "building your workspace" stage. Best place: Onboarding.tsx step 5 (final step currently shows "Your workspace is ready." with "Build my workspace" button) — replace that with an animated building stage that auto-advances after onboarding completes (the `finish(false)` path). The workspace restore in StoreContext hydration (loadServerWorkspace) is fast (server JSON read) — no skeleton needed there, but could add brief hydration indicator. Simpler & matches user ask: animate the Onboarding step-5 → dashboard transition: show a "Setting up your workspace" screen with shimmer checklist (profile, subjects, daily lessons…) for ~1.5s with bob/sparkle, then route to Dashboard. Implement via a `building` state in Onboarding before calling finish.
5. User asked (15 Aug): "and also remove the five services" — ASKED for clarification (waiting). They likely mean remove the 5 provider buttons (Google/MS/FB/Apple/Email) on the welcome screen. MUST ask what replaces them before touching welcome auth UX. Do NOT implement until confirmed.
6. Tests: welcome.recovery.test.ts exists; no client component test convention yet. Add a simple unit test file `server/welcome.recovery.test.ts` style or client test? Keep simple: verify DailyLessonSkeleton renders without crash via vitest with jsdom not configured for client... existing server tests only (no jsdom). Could add a render test only if a jsdom setup exists — it doesn't. Skip client tests; rely on tsc + screenshot + prod build.
7. tsc: the stale 09:12 mediaPrompt.ts errors in devserver.log are OLD (pre-fix) — do not chase.
8. Build: memory pressure in sandbox; kill chromium before `pnpm build`. Latest checkpoint 5841b1bc. Live bundle verified earlier: index-t8DFpQIV.js. Live domain https://studentos-jmnrfmj9.manus.space
9. After build: grep for "Preparing your lesson" in new chunk; checkpoint; verify prod serves new chunk; deliver with screenshot.

## Key file facts

- DailyLesson.tsx pending state now at lines ~118-123 (skeleton).
- Onboarding.tsx step 5 at lines 178-189 ("Your workspace is ready." + finish button).
- StoreContext hydration: sync.loadServerWorkspace() then setState.
