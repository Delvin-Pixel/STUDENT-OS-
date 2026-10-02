# Multi-user implementation status (v1.6)

## User request (verbatim gist)

When sharing the link, a new person must see a fresh sign-in/create-account interface (Google/Microsoft/Facebook/Apple), get their own personal account, and never see the current user's data/profile. Also fix Study Assistant repeating the same answers and connect ALL Q&A (Assistant + Daily Lessons) to OpenAI, including media generation on request.

## Done

- AI Q&A: studyAssistant.ts + lessons.ts now route through invokeLLM (forge proxy in env; works when direct api.openai.com fails). Media requests: wantsMedia field + describeMediaRequest + generateImage (imageGeneration.ts → storagePut URL). Optional `media {url,caption}` in both answer types. Lesson illustration field in schema. Client: AIChatBox renderMedia, DailyLesson chat + illustration sidebar, Assistant bubble media + new suggestion. Tests 37 passing, TS clean.
- DB: `users.workspace` TEXT column added via `USE \`JmnRFmj9cCotDrmo9SM2je\`; ALTER TABLE users ADD workspace text;` — MUST USE backticked DB name in webdev_execute_sql (plain ALTER without USE failed with Table not found). Migration file: drizzle/0002_absent_earthquake.sql (drizzle-kit migrate reports nothing; manual USE prefix worked).
- server/workspace.ts: getWorkspace/setWorkspace/clearWorkspace(validate 4MB max)/validateWorkspacePayload, keyed by ctx.user.openId via protectedProcedure.
- server/routers.ts: workspace.load/save/clear protectedProcedure router. protectedProcedure comes from ./_core/trpc (NOT systemRouter).
- client/src/lib/workspaceSync.ts: createWorkspaceSync() — loadServerWorkspace (empty server → keep local; non-empty server → adopt and saveState), debounced scheduleUpload (2.5s), clearServerWorkspace.
- StoreContext.tsx: useAuth + sync wired; effect refetches server workspace on isAuthenticated/openId change; effect uploads on state change when authenticated.
- Settings.tsx: new Account section card at top — shows sign-in status, Sign in (startLogin) / Sign out (auth.logout mutation + logout() + reload) buttons. Profile card unchanged below.

## Verified in browser (13 Aug 2026)

- Settings → Account card renders when no account session: "Sign in with your Google, Microsoft, Facebook, or Apple account so your workspace is saved to you. Everyone who opens this link gets their own personal account." + Sunrise "Sign in" button. The profile is gated behind onboarding (profile card only renders with a saved profile).
- Manus OAuth portal (https://manus.im/app-auth) supports Google/Microsoft/Facebook/Apple etc. — provider selection happens on the portal; Student OS simply calls startLogin() → /app-auth with its redirect URI.

## Status after hydration fix (latest)

- workspaceSync.ts rewritten cleanly: loadServerWorkspace returns {adopted, serverState, clearedLocal}; empty server + leftover local profile → saveState(emptyState()); return {createWorkspaceSync: {loadServerWorkspace, scheduleUpload, clearServerWorkspace}}.
- StoreContext.tsx: load effect now .then() hydrates serverState via setState(serverState) or setState(emptyState()) when clearedLocal.
- server/workspace.test.ts written (9 tests: validation + per-user isolation via mocked getDb).
- Settings Account card verified in browser (13 Aug): sign-in copy mentions Google/Microsoft/Facebook/Apple; Sunrise Sign in button renders; profile card gated behind onboarding.
- Manus OAuth portal supports the listed providers; startLogin() → https://manus.im/app-auth with redirect URI.

## Final state (post hydration fix + tests + build)

All code complete and verified locally: workspace.test.ts (9 new tests), full suite 15 files / 46 tests passing, pnpm check clean, pnpm build successful. Settings Account card verified in browser. Remaining items are user-assisted: (a) sign in on their phone with their own provider and confirm fresh onboarding/own workspace, (b) physical-device push notification receipt. Next: save checkpoint, deliver.

## Remaining

1. Mark todo.md multi-user items complete; add Vitest coverage for server/workspace.ts + workspaceSync (mock trpc).
2. Verify in browser: signed-out flow shows sign-in card; signed-in shows identity. (Auth is Manus OAuth — provider choice happens on the Manus login portal.)
3. Full suite: pnpm test && pnpm check && pnpm build.
4. Save checkpoint (auto-publishes).
5. Deliver: explain that each person signs in with Google/MS/Facebook/Apple via the shared login portal; workspace syncs per openId; new accounts get fresh onboarding.

## Key facts

- Published domain: studentos-jmnrfmj9.manus.space; dev port 3000.
- Tests: 14 files / 37 tests. Checkpoints fd12a55a (v1.5).
- DB name for SQL tool: `JmnRFmj9cCotDrmo9SM2je` (case sensitive).
- esbuild log shows stale "MEDIA_PATTERNS duplicate" error from before fix — current code has exactly one declaration (line 267); ignore stale logs.
- Home.tsx uses useAuth already (Home.tsx line 16); Settings early-return renders before Account card when !profile — consider that fine since onboarding gating remains.
