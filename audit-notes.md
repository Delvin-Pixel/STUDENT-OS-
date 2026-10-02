# Bug audit notes (13 Aug 2026, full-audit request)

## Current project state

- User rolled back to 7a328649, then asked to test + fix all bugs and send the new website.
- Current HEAD: 2935163 (Rollback to 7a328649). Production verified SameSite=None on the rolled-back version — the sign-in redirect loop IS present on mobile.
- Auto-publish enabled; every checkpoint publishes immediately.

## Audit findings so far

1. **CONFIRMED BUG — sign-in redirect loop** (root cause re-verified on production via probe script `scripts/probe-callback.mjs`, live server returns `SameSite=None` on the nonce/session cookies). On mobile browsers that reject SameSite=None cookies, Google sign-in bounces back to Welcome.
   - Fix (already proven earlier, files known):
     - client/src/const.ts line 23: `SameSite=None; Secure` → `SameSite=Lax; Secure`
     - server/_core/cookies.ts line 45: `sameSite: "none"` → `sameSite: "lax"` (add comment)
     - server/_core/oauth.ts line 32: clearCookie `sameSite: "none"` → `sameSite: "lax"`
     - client/src/main.tsx: add `isMidOAuthCallback()` guard in `redirectToLoginIfUnauthorized` (skip startLogin when pathname === /api/oauth/callback and query has code=)
     - server/auth.logout.test.ts line 57: test assertion `sameSite: "none"` → `"lax"`
   - After fixes: pnpm test (50 tests), tsc, pnpm build (dist rebuilt with esbuild for server: `pnpm exec esbuild server/_core/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist`; note vite build may OOM — kill chromium first), checkpoint.
   - Verify production via: `node scripts/probe-callback.mjs` → expect SameSite=Lax in set-cookie.

2. **Review passed clean so far**: Welcome.tsx (render logic fine, startLogin called from click handler), App.tsx routing (Welcome gate → Onboarding → AppShell fine), StoreContext (sync hydration, debounce upload, reminders loop fine).

## Remaining audit checklist (phase 2)

- Daily Lessons page: lesson generation, ask question (LLM routing, source label), diagram/media requests.
- Study Assistant page: LLM routing, media generation via mediaPrompt.ts defensive parser.
- Theme toggle (sun/moon on homepage/Dashboard), persistence.
- Notifications: browser notification toggle + test button, device push (VAPID), service worker sw.js.
- Quick Add command palette (natural language), Leaderboard, Exam countdown widget.
- Check networkRequests.log and browserConsole.log in .manus-logs for runtime errors.

## Delivery plan

- Fix all findings, run tests + build, checkpoint (auto-publishes), send user final summary with live URL https://studentos-jmnrfmj9.manus.space/

## Phase 2 audit results (screenshots + code review)

The dev preview shows Onboarding (Welcome gates correctly for signed-out; the preview session holds a logged-in state so / redirects past Welcome — expected, not a bug). Screenshots of / /study /assistant /settings /leaderboard all render the Onboarding screen cleanly; no rendering crash.

Code review confirms: Dashboard theme toggle (Sun/Moon in greeting hero) is correctly wired via ThemeContext (light/dark cycling + localStorage persistence OK); QuickAdd natural-language parsing exists in components/QuickAdd.tsx + lib/quickAddParse.ts; exam countdown widget exists in Dashboard (line 122); device push sync (PushReminderSync + Settings register) wired; lesson answer source labels in lib/presentationContracts.ts (OpenAI / Student OS fallback).

Remaining confirmed BUG: only the sign-in redirect loop (SameSite=None on mobile), probe-verified live on production against the rolled-back version. Lessons timeout 8s fallback scaffold is intentional design, not a bug (devserver 09:12 mediaPrompt.ts error is STALE — file is now valid, tsc clean).

No other functional bugs found in theme, reminders, quick-add, leaderboard, countdown, notifications UI.

## Fix plan (phase 3)

Apply the 5-file cookie fix + mid-OAuth guard, update logout test, run `pnpm test`, tsc, rebuild dist server bundle via esbuild (vite build may OOM — kill chromium first, or run vite build single-threaded), checkpoint → auto-publishes. Verify via `node scripts/probe-callback.mjs` expecting SameSite=Lax.

## Files to edit for the sign-in fix (exact locations, current content in repo)

1. client/src/const.ts — line ~23: cookie string `SameSite=None; Secure` → `SameSite=Lax; Secure`
2. server/_core/cookies.ts — line ~45: `sameSite: "none"` → `sameSite: "lax"`
3. server/_core/oauth.ts — line ~32: clearCookie sameSite "none" → "lax"
4. client/src/main.tsx — in `redirectToLoginIfUnauthorized`, skip startLogin when `window.location.pathname === "/api/oauth/callback"` (mid-OAuth guard)
5. server/auth.logout.test.ts — assertion `sameSite: "none"` → `"lax"` (grep to find)
