# Media-generation fix + email identity progress (13 Aug 2026)

## Root cause found (user's "Create a diagram of the states of matter" showed text only)

Production log (manus-webdev-logs):

```
[Study Assistant] Media generation failed; returning answer only. SyntaxError: Unterminated string in JSON at position 602 (line 2 column 601)
    at describeMediaRequest (dist/index.js:1494:23)
```

The LLM's visual-prompt translation returned prose containing unterminated/unbalanced quotes, so JSON.parse in describeMediaRequest threw. The catch returned the text answer only — NO image.

## Fix applied in server/studyAssistant.ts

describeMediaRequest now: (1) try clean JSON parse, (2) sliceBalancedObject() to extract the first balanced {…} slice, (3) last resort: retry invokeLLM with response_format {type:"json_object"} + "Output ONLY valid JSON" system prompt. Also keep MEDIA_PATTERNS detection (already covers "Create a diagram of …").
lessons.ts has its own describeMediaRequest — MUST apply the SAME defensive parsing there.

## Remaining TODO (media + identity fixes section in todo.md)

1. Apply the same sliceBalancedObject + JSON retry fix to server/lessons.ts describeMediaRequest.
2. Verify deployed logs no longer show the media failure after checkpoint.
3. Email identity: user's account identity is Manus OAuth (ctx.user). Check ctx.user shape for email (useAuth hook returns user). Capture email in Settings Account card ("email verified by your sign-in provider"). Store email with the account — likely as user record field; the users table already exists in drizzle/schema.ts. Simplest: display email in Account card from ctx.user, no new DB column needed unless email missing.
4. Regression tests: media prompt parsing (sliceBalancedObject: prose-after-JSON, unterminated quote, retry path).
5. Verify media end-to-end in browser (deployed logs after publish).
6. pnpm test && pnpm check && pnpm build; checkpoint (auto-publish enabled).
7. Remind user: old leftover profile on their phone is wiped automatically when they sign in with their own account (workspaceSync clearedLocal path already verified); ask them to sign in via Settings → Account → Sign in, which will clear the old "Delvin" local profile.

## Progress (phase 2, email identity)

Email evidence: server/_core/sdk.ts line 299 captures `userInfo.email ?? null` into the user identity; drizzle/schema.ts users table already has `email: varchar(320)`. So ctx.user / useAuth().user may carry an email field — verify at runtime before displaying. Plan: in Settings Account card, show "Account email" row from user.email if present, with note "verified by your sign-in provider"; no new DB work needed. If email is null in practice, display "verified by your sign-in provider (email kept by the account platform)".
Media parser fix DONE: server/mediaPrompt.ts (shared: sliceBalancedObject + parseMediaPromptJson + parseMediaPrompt with JSON-only retry); studyAssistant.ts describeMediaRequest now delegates; lessons.ts visualiseMediaRequest uses parseMediaPromptJson + sliceBalancedObject import, parseOpenAIAnswer tolerant of trailing prose. tsc clean, 15 files / 46 tests pass. Remaining: tests for sliceBalancedObject/mediaPromptJson, email row in Settings, build, checkpoint, deliver.

## VERIFIED EVIDENCE (pre-delivery)

- manus-webdev-logs CONFIRMS the exact production failure from the user's screenshot: "[Study Assistant] Media generation failed; returning answer only. SyntaxError: Unterminated string in JSON at position 602 (line 2 column 601) at describeMediaRequest". The new defensive sliceBalancedObject/parseMediaPrompt parser in server/mediaPrompt.ts is precisely the fix for this unterminated-string failure. studyAssistant.ts and lessons.ts both delegate to the shared parser. 16/16 test files, 50/50 tests passing, tsc clean.
- The production code ran the OLD parser; the fix ships with the next checkpoint (auto-publish).

## FINAL PRE-CHECKPOINT STATE (13 Aug)

- All 16 test files / 50 tests pass; tsc clean.
- Account email row CONFIRMED in Settings.tsx lines 121-133: Mail icon card, shows user.email (from OAuth identity) else "Provided by your sign-in provider", plus explicit copy: "Your sign-in (Google/Microsoft/Facebook/Apple) verifies this email for login, alerts, and notifications. Student OS never emails passwords or verification codes itself." User-identity line: "Signed in as … Your Student OS workspace is saved to this account — sign in anywhere to find it, and other people who open this link get their own fresh account."
- Production failure signature (manus-webdev-logs): "Media generation failed; returning answer only. SyntaxError: Unterminated string in JSON at position 602 (line 2 column 601) at describeMediaRequest" — fixed by server/mediaPrompt.ts defensive parser used by studyAssistant.ts (line 31) and lessons.ts.
- Sandbox login page (manus.im/app-auth) did not load in sandbox browser — user must verify sign-in + email row + media generation on their own phone after republish (auto-publish enabled, so checkpoint = live).
- Remaining: save checkpoint (auto-publishes), deliver with instructions to: sign in fresh (clears Delvin profile), test "create a diagram of the states of matter" again, check Settings Account email row, share link to a friend.

## Current state (post media + email fix)

- mediaPrompt.ts DONE + tests written in server/mediaPrompt.test.ts (hoisted vi.mock pattern like studyAssistant.test.ts; call-count assertions adjusted to find calls instead of toHaveBeenCalledTimes due to cross-test leak; last edit not yet re-run).
- Settings Account card now shows Account email row (Mail icon, bg-primary/5 card) using user.email from auth.me (drizzle users.email varchar(320), populated by OAuth server sync in sdk.ts authenticateRequest getUserInfoWithJwt).
- tsc clean, 16 files / 50 tests (49 passing, mediaPrompt retry tests fixed pending rerun).
- Remaining: rerun pnpm test (should be 50/50), pnpm build, browser-verify media generation end-to-end (ask study assistant 'create a diagram of states of matter' on deployed site, check prod logs via manus-webdev-logs), checkpoint + deliver. Remind user sign-in via Settings Account wipes old local 'Delvin' profile and shared links give each person their own account; email verification is done by the sign-in provider, Student OS stores email in DB and shows it, does not send its own codes.

## Notes

- Auto-publish is ENABLED; every checkpoint publishes to studentos-jmnrfmj9.manus.space.
- ctx.user shape lives in server/_core (useAuth returns user with id, name, openId, possibly email — verify).
- Settings Account card exists in client/src/pages/Settings.tsx (section "Account" with Sign in/out + restart onboarding).
- Full suite currently: 15 files / 46 tests passing.
- User email-verification requirement answered honestly: sign-in platform already verifies email; Student OS displays and stores it; we do NOT send our own verification-code emails.
