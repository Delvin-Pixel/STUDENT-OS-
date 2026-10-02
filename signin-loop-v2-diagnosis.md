# Sign-in redirect loop v2 diagnosis (user recording 15 Aug 21:44 local)

## User flow (from video analysis, verbatim)

Welcome → tap "Continue with Google" → "Finishing sign-in…" spinner → black loading page (manus.im/app-auth) → portal account picker "Choose an account / Dhel_Vhen (delvindzihlornu@gmail.com)" → user picks account → spinner next to account → redirected back to Welcome screen with buttons shown again. No error shown.

## Confirmed facts

1. Production bundle index-CwVhOYNR.js contains `SameSite=Lax` — Lax fix IS deployed.
2. Production callback probes (scripts/e2e-signin-sim.mjs):
   - No nonce cookie → 403 `{"error":"invalid oauth state"}` (no server log entry; guard returns silently)
   - Matching nonce + fake code → 500 `{"error":"OAuth callback failed"}` + nonce-clear cookie with SameSite=Lax (exchange throws because code invalid)
   - NO server log entry exists for the user's real attempt (logs searched 14–15 Aug; only our probes logged) → either the callback never reached the server, or the 403 guard fired (which logs nothing), or the portal redirected elsewhere.
3. Production OAUTH_SERVER_URL = https://api.manus.ai (platform-injected; repo env.ts default is empty; local .env says https://api.manus.im). sdk.ts logs "[OAuth] Initialized with baseURL: https://api.manus.ai" on every server start. Both api.manus.ai and api.manus.im accept the same RPC endpoints (ExchangeToken 401s on invalid code on both; GetUserInfo 401s missing token on both) — cannot distinguish validity with fake codes.
4. auth.me without cookie → 200 {"data":{"json":null}} — isAuthenticated=false → Welcome. No UNAUTHED error → main.tsx does NOT re-fire startLogin.
5. main.tsx has sessionStorage "manus-cookie" Bearer fallback (preview auto-login path) — only set by preview runtime, never by our callback.
6. Welcome.tsx: pending=true when provider clicked → shows "Finishing sign-in…"; pending resets on remount; isAuthenticated stays false → Welcome buttons shown. Matches recording.

## Timeline

- Checkpoint e5d25677/a5df3c70 (Lax fix) was published; user screenshot AFTER that showed successful onboarding ("What should we call you?") → the Lax fix worked at least once for the user.
- Then loop returned in the 15 Aug 21:44 recording, on the SAME Lax version.

## Root-cause analysis (why it worked once then looped again)

Two plausible explanations remain unfalsified:
A. **Cookie dropped by the browser on the cross-site 302**: OAuth portal (manus.im) → /api/oauth/callback (cross-site top-level GET) → Set-Cookie + 302 to "/". Safari ITP and some privacy-focused browsers refuse cookies set via cross-site redirects. The Manus OAuth skill lists unsupported browsers: Safari Private Browsing, Firefox ETP Strict, Brave Shields, cookie-blocking browsers. User's device/browser may block these cookies intermittently. The one-time success may have been a lucky retry or a different browser context.
B. **The OAuth portal's Google flow didn't complete the redirect to our callback at all**: after account pick, the portal may have failed silently (e.g., portal-side Google OAuth error) and redirected to "/" itself or the browser history fell back. No server log at all for the attempt supports this — the request never hit our server.

## Decisive evidence still needed / options

- Cannot mint a real authorization code for a live exchange test (would need a real user account).
- Production logs show NO attempt hit the server → strongest evidence is the portal never redirected to our callback (option B), OR the 403 guard fired silently (option: nonce cookie dropped before redirect — but the recording shows the portal loaded fine, which needs our domain's redirectUri only).
- Actually: portal redirect to callback would log SOMETHING only if nonce matched. If nonce dropped (cookie), 403 silent → no log. So "no log" is consistent with nonce cookie dropped.

## Chosen fix strategy (robust, browser-resilient)

Make sign-in succeed even when the session cookie is dropped on the cross-site redirect:

1. In oauth.ts callback success path: also return the session token in a `Set-Cookie` AND as part of the redirect: append `#signed_in=1` fragment... cannot embed token in URL safely.
2. Better: after the redirect to "/", the client detects post-OAuth state (document.referrer contains app-auth or sessionStorage flag set at startLogin time) and if isAuthenticated stays false after the redirect, instead of silently showing buttons, (a) auto-retry auth.me up to N times over a few seconds (server may be slow to set cookie, or cookie may be race-conditioned), (b) then show a clear inline error on Welcome: "Sign-in didn't complete. Your browser may be blocking cookies. Tap to try again." with a Retry button that re-invokes startLogin.
3. Also set the session cookie with SameSite=Lax; Path=/; Secure (already done) AND without httpOnly? NO — keep httpOnly; the Bearer sessionStorage fallback exists but only preview sets it.
4. Add a small client-side "last login attempt" timestamp in localStorage at chooseProvider time; on Welcome mount, if < 5 min old and isAuthenticated=false, show recovery UI instead of buttons only after retries.

## Files involved

- server/_core/oauth.ts (callback: guard 403 silent, success sets cookie + 302 "/")
- server/_core/cookies.ts (SameSite=lax already)
- client/src/const.ts (nonce cookie SameSite=Lax already)
- client/src/main.tsx (mid-OAuth guard already: checks code/state in URL)
- client/src/pages/Welcome.tsx (pending + providers UI)
- client/src/App.tsx (Router: !isAuthenticated → <Welcome />)
- scripts/e2e-signin-sim.mjs, scripts/probe-callback.mjs (probes)

## Testing plan after fix

- Local: mock callback success by testing Welcome recovery UI rendering (unit test with mocked useAuth).
- Probe production callback again (expect 403 without nonce, 500 with fake code — unchanged).
- pnpm test, typecheck, build, checkpoint, verify live.

## User-facing explanation (final report draft)

The sign-in loop persists because some browsers (Safari private mode, strict tracking protection, some Android browsers) drop the session cookie that the sign-in service sets when it redirects back to the app. The server-side fix already deployed (SameSite=Lax) covers the common case, but for browsers that refuse cookies on cross-site redirects we need a client-side recovery: detect a just-finished sign-in that didn't stick, and offer a clear retry instead of silently showing the welcome buttons again.

## Implementation state (21:55 Aug 15)

Welcome.tsx edited with full recovery layer: LAST_ATTEMPT_KEY = "studentos:last-signin-attempt" (10-min window), recordSignInAttempt() at chooseProvider + retrySignIn, retry ladder (4 retries over ~15s: 1500*(r+1)ms, refresh() each), then failed state → amber recovery card "Sign-in didn't finish" with explanation + gradient "Try signing in again" button (calls startLogin() with no provider → default portal picker). Imports AlertTriangle. TypeScript clean (0 errors in dev tsc).

New test file: server/welcome.recovery.test.ts — initially failed with "localStorage is not defined" (vitest node env, no DOM); fixed by adding in-memory localStorage shim at top of file. Need to re-run pnpm test to confirm all 56 pass, then: pnpm build (memory pressure: close chromium first: pkill -f chromium), rebuild server bundle: pnpm exec esbuild server/_core/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist, checkpoint, wait for deploy, probe callback (expect SameSite=Lax), deliver.

User-facing: explain recovery UI + why cookie dropped (browser privacy features); advise retry or normal browser tab; keep push-notif physical verification as remaining user-side step.
