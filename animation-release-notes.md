# Animation release (15 Aug night) — state notes

## User requests this round

1. Loading animation/skeleton while workspace + Daily Lessons generate → CHANGED to: educational inspiring animations, NO skeleton bars (user said "not skeletons. use educational inspiring animations").
2. Remove the five sign-in services (provider buttons) from welcome screen → DONE: single generic "Sign in" button kept, all provider SVG marks removed, Welcome.tsx cleaned.

## What's implemented (all uncheckpointed yet)

- client/src/components/WorkspaceBuilding.tsx (new): staggered 3-step "Building your workspace" cards (Saving profile / Setting up planner / Preparing Daily Lessons) with shimmer badges → check icons + Done label; auto-navigates to "/" after ~2.4s. Wired into Onboarding.tsx step 5 (building state + conditional render).
- client/src/components/DailyLessonSkeleton.tsx (rewritten): orbiting subject icons (Atom, FlaskConical, Calculator, Globe, Laptop, Dna, Music, Palette, Microscope) around a floating gradient BookOpen center, soft glow, rotating motivational phrases (aria-live), rising knowledge particles. Replaces old shimmer layout skeleton.
- client/src/index.css: added .lesson-orbit, .lesson-orbit-reverse, .lesson-float, .particle-drift + keyframes, inside prefers-reduced-motion guard, appended after flame-pulse block (~line 402).
- client/src/pages/Welcome.tsx: PROVIDERS removed, beginSignIn() uses startLogin() (no provider hint), single Sign in button in new flex row, footer sparkle text kept.

## Verification status

- tsc clean, 17 files / 56 tests passing.
- NOT yet: production build, checkpoint, live verification, screenshots.

## Deployment notes

- Auto-publish ENABLED: checkpoint = publish.
- Production is studentos-jmnrfmj9.manus.space; verify served bundle contains changes after deploy (bundle name hash changes each build; may take 1-3 min to propagate).
- Note: dist/index.js on disk was sometimes stale relative to vite build; production build = pnpm build (vite → dist/public, esbuild → dist/index.js). OOM possible — kill chromium first.
- Live verify: curl -sm 30 https://studentos-jmnrfmj9.manus.space/ → grep script tag; probe /api/oauth/callback cookie SameSite=Lax (live probe script: scripts/probe-callback.mjs).
- Known earlier prod issue: OAUTH_SERVER_URL injection (api.manus.ai vs api.manus.im) — monitor manus-webdev-logs.
- Daily Lessons timeout seen in devserver.log (lesson service slow) — local timeout in server/lessons.ts withTimeout; not fixed this round (scaffold fallback works).

## Screenshots to verify before delivery

- Preview root / (dashboard or welcome), mobile viewport 375x812.
