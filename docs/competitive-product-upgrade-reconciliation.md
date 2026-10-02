# Competitive Product-Upgrade Reconciliation

> **Historical reconciliation — not a current-release validation record.** The capability and evidence statements below reflect the source and validation state at the time of this audit. Use the active production-hardening record for current release, deployment, test, bundle, and archive facts.

**Specification source:** `/home/ubuntu/upload/pasted_content.txt`, 833 available lines. The text ends mid-instruction at line 833; this record therefore distinguishes available requirements from any missing continuation.

| Product principle or requirement           | Current canonical Student OS capability                                                                                                                                                                                   | Evidence status                  | Required next action                                                                                                 |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Command center answers “what next?”        | Deterministic `learningIntelligence` ranks work; Today, Dashboard, Study Planner, Focus, task recovery, and mastery share canonical state                                                                                 | **PARTIALLY VERIFIED**           | Trace dense and empty states to find real prioritization or actionability gaps                                       |
| Today’s adaptive plan                      | Timetable, tasks, exams, sessions, capacity, preferred productive hours, deadline risk, and AI proposal review are implemented; recurring timetable blocks now reserve both capacity and placement windows                | **PARTIALLY VERIFIED**           | Verify missed-session recovery and no-backlog behavior through current planner tests                                 |
| Exam-linked learning loop                  | Exam topics link to sessions, quiz evidence, flashcards, materials, learning evidence, and mastery calculations; manual topic status is retained as an estimated checklist signal, not an XP or direct-performance result | **PARTIALLY VERIFIED**           | Confirm every path feeds the same topic model and no UI path bypasses it                                             |
| Spaced repetition                          | Cards track review count, interval, due date, retention estimate, ease factor, and lapse data                                                                                                                             | **VERIFIED at source level**     | Validate review UX, scheduling edge cases, and empty states                                                          |
| AI material / flashcard / quiz proposals   | Per-action consent, ownership, structured validation, review checklist, and explicit canonical save exist                                                                                                                 | **VERIFIED in controlled tests** | Live provider document/PDF acceptance remains manual                                                                 |
| Quiz feedback and weakness loop            | Canonical attempts, missed-question feedback, learning evidence, and mastery/review engine exist                                                                                                                          | **PARTIALLY VERIFIED**           | Do not create a parallel assessment engine; audit server-authoritative migration separately                          |
| Knowledge hub and connected notes          | Subjects/topics connect notes, materials, decks, quizzes, sessions, tasks, and exams through canonical IDs                                                                                                                | **PARTIALLY VERIFIED**           | Audit discoverability and cross-link completeness, not duplicate data stores                                         |
| Minimal AI context                         | Server-only AI paths, protected calls, bounded schemas; Assistant now omits learner summary for generic questions                                                                                                         | **PARTIALLY VERIFIED**           | Compare every surface’s context selection and failure behavior                                                       |
| Quick Add / Focus / notifications / search | Existing natural-language preview, evidence-linked focus, categories, and global search are present                                                                                                                       | **PARTIALLY VERIFIED**           | Verify accessible error/retry/offline states and mobile behavior                                                     |
| Ghana-first curriculum support             | Existing profile subjects are learner-defined; official Ghana sources were separately researched and documented                                                                                                           | **NOT YET IMPLEMENTED**          | Add a versioned provenance-aware catalogue only after compatibility design; do not label custom subjects as official |
| Performance and mobile                     | Routes are lazy loaded and main chunk is roughly 767 kB before gzip; global reduced motion exists                                                                                                                         | **VERIFIED WITH WARNING**        | Avoid bundle growth; validate on narrow screens and document the persistent build warning                            |

## Governing implementation conclusion

Student OS already contains most of the specification’s P0/P1 product capabilities. The appropriate next work is **coherence hardening and evidence**, not a blind feature rewrite. Any repair must preserve the single `StoreContext` canonical state, deterministic `learningIntelligence` planning/mastery model, protected server ownership model, and learner-review gate for AI-generated learning artifacts.

## Command-center source finding

The Dashboard already presents a deterministic recommended next action with a direct route, an explicit Today’s Plan, exam countdown, daily-goal progress, task completion, focus/session totals, and accessible quick actions. Its zero-data state directs a learner to add a session or task. The next audit must therefore test ranking and recovery data paths rather than replace the dashboard with another planner.

## Planner recovery and learning-loop evidence

The deterministic planner regressions verify that direct quiz evidence outweighs study minutes for mastery, urgent work outranks weaker topics without suppressing them, blocked/deferred work is excluded, adaptive exam plans honor remaining capacity, and missed plan items are rescheduled only into available capacity while completed items remain intact. They also verify due-card queues and exam-readiness recommendations. The current increment extends both plan creation and missed-plan recovery to reserve recurring timetable blocks in their daily capacity and slot-overlap calculations. No source-verified backlog-forwarding defect was found in these tested paths.

## Scheduling-model boundary

The weekly agenda helper intentionally renders recurring timetable events. Dated study sessions, tasks, and exams are represented by their own canonical entities and are brought together in Today/Dashboard planning rather than duplicated into recurring events. The deterministic adaptive planner now also reserves recurring events when estimating capacity and finding an evening revision slot; this preserves one schedule model without duplicating dated records. The remaining audit question is user-facing discoverability across calendar views, not a justification to copy every entity into another schedule store.

## Study Assistant context finding

The Assistant accepts a bounded optional study context, is protected/rate-limited at the router, and now receives learner context only for questions that request personal planning, deadlines, or progress. Generic questions use no workspace summary. The server constrains concise responses, limits completion size, gives transparent local fallbacks, and keeps optional media generation separate. Live provider quality remains a manual acceptance boundary.

## AI resilience audit increment

The cross-surface audit verified that lessons, Assistant, generic learning drafts, schedule drafts, and account-owned material summaries/practice drafts all remain server-only protected capability modules with bounded inputs. Structured learning artifacts are validated before return and require learner review before a canonical quiz or session mutation. The Assistant and Daily Lesson Q&A also maintain direct, labeled local fallbacks when the online tutor is unavailable.

One P1 resilience gap was repaired: the two direct tutor surfaces depended on a hard-coded model identifier while other learning-draft surfaces chose an available compatible server model. They now use a bounded compatible-model preference order, retain the server default if the catalog is temporarily unavailable, and attach reasoning settings only to compatible `gpt-5` models. This does not expose a credential or add a browser model call. A related regression confirms validated model media intent can trigger an educational visual even without a narrow keyword match; a failed image request remains answer-only rather than failing the learner's question.

Full release validation for this increment passed **86 Vitest files / 283 tests**, TypeScript, the source credential scan, and the production build. The existing 767.31 kB pre-gzip main-bundle warning remains unresolved.

## Architecture boundary — trusted assessment and curriculum provenance

The specification's trusted assessment and curriculum-aware catalogue requirements are genuine architecture gaps, not missing labels. Current quizzes are intentionally local-first learner practice: the browser scores responses and writes canonical workspace evidence, while the relational database has no assessment-session, response, immutable-question, or idempotency tables. The safe future design is a protected owner-scoped relational assessment session with immutable question snapshots and server grading; it must coexist with, rather than silently relabel, the offline practice runner.

Country/system provenance is likewise absent from the profile and strict workspace validator. A backward-compatible future profile extension must preserve existing free-form subject labels and add optional country, system, catalogue version, and per-subject provenance. A Ghana catalogue can be a verified seed only where the official sources cited in the directive record support it; custom entries must remain custom. Neither migration is implemented in this increment.

## Offline and account-boundary audit increment

The PWA caches the application shell and public assets for offline continuity but explicitly keeps authenticated API and private storage routes out of the device-wide cache. Local workspace caches are keyed by authenticated account and remote hydration waits for protected workspace data before rendering the learning shell. Pending offline work survives network failure, then reconciles through revision-aware merging and deletion tombstones.

A source-verified P1 repair removes the embedded-preview bearer fallback entirely. The application no longer reads or forwards a runtime session-storage bearer value, and the server rejects a bearer-only session while continuing to authenticate the signed cookie. Ordinary nonce-bound OAuth cookie authentication is unchanged. Full release validation passed **86 Vitest files / 285 tests**, TypeScript, the source credential scan, and the production build. The main bundle remains 767.10 kB before gzip. Installed-device offline, service-worker update, real OAuth, and physical push delivery remain manual acceptance scenarios.

## Production bundle-loading repair

The production build previously emitted a single 767.10 kB pre-gzip shared JavaScript chunk, producing Vite's 500 kB warning even though route components were already lazy-loaded. Source tracing showed that the chart library, PDF/canvas export dependencies, UI primitives, and base application runtime were being coalesced into that shared payload.

The build now declares stable manual chunks: chart code is isolated in a 428.14 kB route-demanded chunk; dynamic PDF and canvas export dependencies remain independently loaded at 390.50 kB and 202.36 kB; UI primitives, query/tRPC helpers, icons, routing, and React runtime are separated. The largest emitted JavaScript asset is now 428.14 kB and the production build no longer emits the oversized-chunk warning. Full validation passed **86 Vitest files / 285 tests**, TypeScript, the credential scan, and the production build.

This is a **bundle-boundary repair**, not a claim of complete performance optimization. Initial route/network behavior, device CPU/memory, cache warming, Core Web Vitals, offline install/update behavior, and real-device accessibility still require browser and physical-device acceptance testing.

## Navigation accessibility increment

The source audit found an invalid nested interactive control in the global top bar: the Notifications destination rendered a `<button>` inside a navigation anchor. This can produce conflicting focus and announcement semantics for keyboard and assistive-technology users. The destination now uses the existing `Button asChild` contract to style one notification anchor rather than nesting a second interactive element. A focused regression checks the source composition. Full release validation passed **87 Vitest files / 286 tests**, TypeScript, the source credential scan, and the production build; real keyboard and assistive-technology traversal remains manual evidence.

## Global-search modal accessibility increment

The global search overlay declared itself as a modal dialog but was a custom full-screen `div`, so it did not use the application's established focus-management primitive. The overlay now uses the shared Radix-backed controlled dialog, opens with the search input focused, retains its existing Esc/overlay-close behavior through the dialog contract, and closes after a result navigation. The focused source regression verifies the focus-managed dialog composition. Full release validation passed **87 Vitest files / 287 tests**, TypeScript, the source credential scan, and the production build; real screen-reader announcements and keyboard traversal remain manual evidence.

## Quick Add dialog semantics increment

The shared Quick Add workflow already used the focus-managed dialog primitive, but its content had no accessible title. The repair adds a visually hidden “Quick add” dialog title without changing the command shortcut, mobile action button, natural-language draft/review workflow, or learner-state mutations. A focused regression confirms the title remains present. Full release validation passed **88 Vitest files / 288 tests**, TypeScript, the source credential scan, and the production build; manual keyboard and screen-reader behavior remains an acceptance boundary.

## Notification scheduling and delivery-history audit

The reminder settings persist category opt-outs, quiet hours, vibration choices, daily cap, goal/streak preferences, and up to three bounded custom reminders in the canonical workspace. Enabling device reminders registers the browser subscription through a protected procedure, replaces that device’s unsent schedule with a deduplicated plan, and sends the activation test separately. `PushReminderSync` repeats that replacement only when an account-ready relevant planning fingerprint changes or the browser reconnects; daily plan and custom reminders are planned fourteen days ahead, avoiding a source-level midnight scheduling gap.

The server verifies device ownership through `ctx.user.openId` for registration, schedule replacement, disablement, and delivery-history reads. The delivery-history endpoint returns technical acceptance/failure/expiry outcomes for the currently registered opaque endpoint only; it does not imply lock-screen visibility. Controlled ownership regressions reject unauthenticated access and prevent a second account from claiming, scheduling, reading, or disabling another account’s endpoint. Physical permission behavior, operating-system delivery, carrier/device network conditions, and notification presentation remain manual acceptance boundaries.

## Study session lifecycle integrity repair

The Study Planner exposed generic `planned`, `in progress`, and `completed` status chips. A generic status update could relabel a skipped or rescheduled session before the canonical completion command evaluated it, leaving the UI marked completed without the session's evidence, study-plan item completion, goal minutes, activity, or XP side effects. The planner now offers only lifecycle-safe actions: a planned session can start; an in-progress session can complete through the canonical completion command; terminal and paused states are displayed as status badges. Edit and deletion remain available without manufacturing learning evidence. A focused regression verifies the page cannot return to generic status mutation. Full release validation passed **89 Vitest files / 289 tests**, TypeScript, the source credential scan, and the production build.

## Local practice-quiz submission integrity repair

The local quiz runner could process two near-simultaneous Finish activations before React rendered the result screen, recording duplicate practice attempts and duplicate connected mastery evidence. A synchronous in-memory completion guard now admits only the first attempt-recording path for the active runner. The change does not claim server-authoritative assessment: quiz attempts remain local-first learner practice, with remediation and topic evidence preserved after the single accepted completion. A focused regression verifies the guard. Full release validation passed **90 Vitest files / 290 tests**, TypeScript, the source credential scan, and the production build.

## Material-to-practice ownership and review audit

The material workflow separates account-owned file access, consent, generated drafts, and canonical learning artifacts. The server reads the signed-in account’s validated workspace, requires the selected storage key to exist there as a PDF, persists action-specific consent before requesting a short-lived server-side URL, and validates bounded structured output. Material summaries never auto-save a quiz; summary-derived questions require the learner to enter and verify answer choices. AI question drafts require a per-question learner acknowledgement before the normal editable quiz is created, and reviewed PDF export remains browser-local without a new AI request or private file URL.

Controlled lifecycle coverage exercises upload metadata, revisioned workspace save/restore, owned signed access, and workspace-clear reconciliation of metadata/quota. The existing ownership/access tests cover protected account scopes. Storage retention remains an infrastructure boundary: Student OS removes metadata and access paths but does not claim a physical provider-side byte deletion. Real PDF parsing and provider generation remain manual acceptance scenarios.

## Daily Lesson account-switch isolation repair

Daily Lesson selection remains deterministic from the learner's selected subject labels, education level, and date; onboarding does not currently collect country/system or label presets as an official catalogue. Those static presets and custom values remain ordinary learner choices, while the provenance-aware catalogue migration is explicitly deferred.

The audit found that an in-flight personalized lesson response was correlated only to that deterministic topic key. Two accounts sharing a topic key could therefore switch during a request and permit the earlier account's lesson response to render into the later account's workspace. The response guard now binds the request key to both the account cache scope and selected topic, and suppresses stale error notices too. A focused regression protects this source-level isolation boundary. Full release validation passed **91 Vitest files / 291 tests**, TypeScript, the source credential scan, and the production build.

## Task dependency cycle-prevention repair

Tasks intentionally support prerequisite links and surface blocked recovery states through the canonical task-execution helpers. The edit dialog previously permitted an indirect cycle, such as Task A blocked by Task B and Task B later blocked by Task A, leaving both tasks permanently blocked. The dialog now evaluates the proposed dependency graph before saving and rejects direct or indirect paths that lead back to the edited task. Existing acyclic prerequisites remain allowed. A pure regression covers direct, indirect, and valid dependency cases. Full release validation passed **91 Vitest files / 292 tests**, TypeScript, the source credential scan, and the production build.

## Focus timer lifecycle audit

The Focus timer uses one controlled lifecycle: starting a focus round optionally persists an account-scoped completion reminder; pausing, resetting, skipping a break, and changing presets clear that reminder; a natural focus completion records one canonical focus session with optional task/topic/objective evidence before entering the break phase. The timer does not treat focused time as task completion or mastered knowledge. Focus sessions contribute to daily-goal and streak evidence through the same workspace state, while the visible stats derive from those recorded sessions.

The audit confirmed the prior render-phase preference fix remains an effect, not a render-time state write. Reminder synchronization is best-effort and provider/device delivery remains manual; source behavior does not claim an operating system will present the alert.

## Mastery and review-loop audit

Mastery sorts topics through the deterministic learning-intelligence engine and keeps direct quiz checks distinct from estimates and supporting signals. The page exposes the latest direct check when present, labels estimated topics as non-verdicts, and routes learners to a check, review/retry, or retention plan without creating a second scoring model. Reviews uses the same ranked next action and due-review queue, summarizes completed rather than planned work, and links to the canonical flashcard review flow. No competing mastery, review, or recommendation state was found in these surfaces.

## Onboarding selection-state accessibility repair

Onboarding uses button-based selections for education level, goals, subjects, and daily study-time preference. Visual selection state was present, but assistive technology did not receive the same state. Each selection button now exposes `aria-pressed`, preserving the existing input model, custom-subject option, and deferred curriculum-provenance boundary. A focused regression protects all four selection groups. Full release validation passed **92 Vitest files / 293 tests**, TypeScript, the source credential scan, and the production build.

## Historical baseline validation — superseded by later repair checkpoints

The initial competitive-spec baseline passed **85 Vitest files / 279 tests**, TypeScript checking, source credential scanning, and the production build. The unauthenticated landing was visually reviewed again at 375 × 812: its distinct new-student and returning-student actions remain readable, separated, and touch-sized. At that time, the production build reported a main JavaScript chunk of approximately **767.31 kB** before gzip. The later bundle-boundary repair supersedes that warning record; the current largest asset is documented above as 428.14 kB.

## Source-verified repairs during this audit

Two P1 reliability defects were corrected without adding a parallel engine. First, the Flashcards page now limits a review session to new or due cards; cards already scheduled for a future review date remain out of the queue and a clear no-cards-due state is shown. Second, the Focus Timer no longer updates local timer state during render-time memoization; preference/phase synchronization runs in an effect and uses a tested pure duration helper. The latest complete validation after the Focus repair passed **86 test files / 280 tests**, TypeScript, credential scan, and production build. The main bundle warning remains.

## Material-to-practice finding

The material workflow uses one selected account-owned PDF per explicit action. Summary and generated-question requests are consent-led; generated questions remain drafts until every answer and explanation is checked; resulting quizzes use the canonical quiz store; and reviewed drafts can be exported locally without another provider or storage request. No source-verified consent or automatic-trust defect was found in this flow.

## Connected-notes finding

Notes are private canonical records with subject and optional topic links. The Notes workspace supports topic-linked creation, subject filtering, search, pinned ordering, and useful empty/filter-empty states. This meets the connected knowledge-base direction without constructing a duplicate note or topic model.

## Quiz-practice finding

The canonical practice-quiz helper calculates local score, missed-question IDs, and answer-level response evidence with explanations; its regression coverage verifies bounded scoring and remediation data. This is appropriate for learner practice. It remains distinct from the separately tracked server-authoritative assessment/session migration required for trusted, idempotent submissions.

## Local-first and offline evidence

Workspace hydration regressions verify that a returning student adopts a remote workspace on a new device, unsynced local work remains intact while offline, and a recoverable cloud-fetch failure retains the account-scoped local workspace with an explicit failed-sync state. This is controlled code-path evidence; real installed-PWA offline/reconnect behavior remains a manual-device acceptance boundary.

## Today command-center finding

The Today page is action-oriented rather than static: it presents one ranked next action, a task execution coach with explicit logged work/completion/deferral, a session coach with actual-duration and reflection capture, skip reasons, overlap-safe rescheduling, daily goal progress, current schedule, due attention, reminder status, habits, and goals. This fulfills the intended recovery-oriented daily-plan direction without creating duplicate tasks or sessions.

## Learning-support audit increment

The remaining source audit traced the Mastery and Reviews pages back to the same `learningIntelligence` engine used by Today and Dashboard. Mastery correctly distinguishes direct checks from estimates, exposes the latest direct quiz outcome when available, and sends learners to practice or planning without manufacturing a second score model. Reviews derives its next action from the same ranked-action function and its recall count from the same due-only queue used by Flashcards. Consequently, no duplicate priority, mastery, or review queue was found in these surfaces.

Quick Add was also verified to parse a session into a visible, editable draft before saving one **planned** canonical session. It explicitly states that planning adds no learning evidence; it does not silently turn a natural-language capture into completed study. Global search aggregates canonical tasks, sessions, cards, notes, goals, exams, timetable items, quizzes, materials, revision plans, and topics. Its current section-level destinations are a discoverability limitation rather than a second persistence or authorization path.

The notification bridge derives reminder candidates from canonical tasks, exams, saved lessons, daily goals, streaks, custom reminders, and the active focus timer. It synchronizes only after protected workspace readiness and uses account-scoped focus-reminder storage. The planner applies preference opt-outs, quiet hours, chronological daily caps, and a finite queue. Controlled ownership/provider tests remain separate from real device delivery acceptance.

### Verified P1 repair — explicit planning-date determinism

`getRankedNextActions(state, today)` accepted an explicit planning date but calculated overdue task and session labels with the runtime wall clock. This could make a backfilled daily review, test run, or controlled recovery calculation label the wrong number of overdue days when `today` differed from the device date. The engine now derives both durations from `daysBetween(entityDate, today)`, so every date-sensitive value in that ranked-action call respects its supplied planning date. A focused regression verifies independent task and session counts against a fixed date. The focused `learningIntelligence` suite passed **14 tests** after the repair; comprehensive validation is recorded separately for the checkpoint.

### Verified P1 repairs — exam evidence and recurring timetable capacity

The Exam Center previously allowed a learner-set `mastered` status to award XP and to enter the deterministic fallback score as 85 without a quiz, practice, or recall record. This could manufacture apparent readiness and cause an adaptive revision plan to omit a topic. Manual status now remains a transparent checklist estimate capped below the strong-topic threshold, awards no XP, and cannot remove a topic from the evidence-driven revision plan. Direct learning evidence continues to take precedence.

The presentation contract now follows the same boundary: the Exam Center displays **“Readiness estimate”** whenever any topic lacks direct evidence, and uses **“Direct-evidence readiness”** only when every listed topic has direct evidence. Its checklist control also states that practice and quizzes create learning evidence. This is a source-level transparency repair; the meter remains a deterministic planning aid rather than a trusted assessment result. Full validation passed **93 Vitest files / 297 tests**, TypeScript, the credential-literal scan, and the production build; no Vite oversized-chunk warning was emitted.

Removing an Exam Center topic now detaches it from that exam through a canonical StoreContext action rather than rebuilding the record inside the page. If an existing task, session, plan item, quiz/attempt, material, deck, focus record, note, or learning-evidence entry still references the topic and no other exam retains it, the topic is promoted to the canonical topic list with `source: "exam"`. This prevents historical evidence and linked artifacts from becoming unaddressable while respecting a learner’s intent to remove an unlinked topic. Focused regressions cover promoted, shared, and unlinked cases. Full validation passed **94 Vitest files / 300 tests**, TypeScript, the credential-literal scan, and the production build; manual device/provider boundaries remain unchanged.

The whole-exam delete path now applies the same preservation rule before tombstoning the exam for cloud synchronization. It detaches each topic through the canonical helper, retains only still-linked topics, and then removes the exam; a focused regression confirms that a note linked to an exam-only topic remains addressable after the exam itself is deleted. This completes the source-controlled deletion boundary for exam topics without deleting or mutating the learner’s linked artifacts. Full validation passed **94 Vitest files / 301 tests**, TypeScript, the credential-literal scan, and the production build; manual device/provider boundaries remain unchanged.

### Verified P1 repair — AI schedule capacity and edited timetable safety

AI schedule-draft validation previously counted only proposed minutes against the learner's daily capacity even though active canonical study sessions were supplied for conflict detection. A proposal could therefore fit its own limit yet exceed the learner's stated daily study time after existing work was included. Server validation now seeds daily totals from active sessions before validating each proposed item. The browser-side review/apply guard applies the same rule after learner edits, preventing a manually adjusted draft from bypassing it. The review guard now also rechecks recurring timetable blocks after edits, because server validation protects the generated response but cannot validate a later browser-side time change. Focused server and client regressions cover capacity and recurring-block rejection. Full validation passed **94 Vitest files / 303 tests**, TypeScript, the credential-literal scan, and the production build; no oversized-chunk warning was emitted.

The deadline-risk warning now uses the same active-session capacity model. It derives remaining time date by date through each deadline, subtracting the learner's active planned/in-progress/paused sessions before comparing estimated work. This avoids a falsely reassuring warning when a productive window is already fully committed. A focused regression verifies that two fully committed 60-minute days produce zero remaining capacity for a new deadline. Full validation passed **94 Vitest files / 304 tests**, TypeScript, the credential-literal scan, and the production build; manual provider/device boundaries remain unchanged.

Deadline-risk assessment now also accumulates all estimated work due on or before each successive deadline. Previously, two 60-minute tasks due on the same 60-minute day could each appear feasible when assessed independently. The later item is now warned as requiring 120 cumulative minutes against 60 available minutes, and the dialog describes the total work due by that date. This remains a transparent planning estimate, not a forecast or assessment result. Full validation passed **94 Vitest files / 305 tests**, TypeScript, the credential-literal scan, and the production build; manual provider/device boundaries remain unchanged.

### Verified P1 repair — Today preserves ranked learning recommendations

Today previously rendered the highest-ranked task or session execution controls, but dropped a highest-ranked exam-topic study or due-flashcard recommendation and fell through to the empty state. The daily surface now presents those deterministic next actions through a linked execution-coach card, preserving the original Study or Flashcards route and explanation without inventing a session or marking learning complete. Task and session lifecycle controls remain unchanged. Focused regressions verify that study and flashcard actions are retained while task/session actions continue to use their existing controls. Full validation passed **95 Vitest files / 307 tests**, TypeScript, the credential-literal scan, and the production build; no oversized-chunk warning was emitted.

### Verified P1 repair — recurring timetable collision guard for manual study work

The adaptive planner and AI draft validator already reserved recurring timetable blocks, but the canonical manual session creation, editing, rescheduling, and plan-item activation paths only checked for another study session. A learner could therefore manually create a study block inside a recurring class. A shared local-weekday collision helper now protects each of those canonical paths, with the same source of truth as the timetable. Focused regression coverage verifies overlapping and adjacent blocks. Full validation passed **95 Vitest files / 308 tests**, TypeScript, the credential-literal scan, and the production build; no oversized-chunk warning was emitted.

### Verified P1 repair — task edit completion uses the canonical lifecycle

The Task dialog intentionally exposed a completed status for existing tasks, but its edit save path first applied generic task changes and then called the canonical completion action. That split could assess stale dependencies or subtasks after the learner edited them in the same save, and generic StoreContext updates could also receive a completed status without lifecycle safeguards. Edited completion now passes the proposed patch atomically to the canonical completion action, which evaluates the merged candidate before recording completion, XP, and activity. Generic completed-status patches are rejected. Focused regressions cover the dialog and StoreContext lifecycle contract. Full validation passed **96 Vitest files / 310 tests**, TypeScript, the credential-literal scan, and the production build; no oversized-chunk warning was emitted.

### Verified P1 repair — idempotent task and session completion claims

Task and session completion side effects previously relied on React state to render the terminal status before a second activation arrived. Rapid repeated completion could therefore duplicate task activity/XP or session learning evidence/XP while the initial update was pending. StoreContext now claims each valid task or session ID synchronously before its canonical completion update, restores claim sets from the authenticated hydrated workspace, and retains the existing terminal-state checks. Focused lifecycle regressions cover both claim contracts. Full validation passed **97 Vitest files / 312 tests**, TypeScript, the credential-literal scan, and the production build; no oversized-chunk warning was emitted.

The completion claim is deliberately released when a learner reopens a task to `todo` or `in_progress`; the stale completion timestamp is cleared at the same time. This preserves the rapid-repeat guard for one completion event without incorrectly blocking a later, newly validated completion after the learner resumes work. Focused task lifecycle coverage verifies both conditions. Full validation passed **99 Vitest files / 316 tests**, TypeScript, the credential-literal scan, and the production build; no oversized-chunk warning was emitted.

Reopening must not turn a one-time task reward into an XP replay mechanism. Tasks now retain an optional, backward-compatible `xpAwardedAt` marker after reopen while clearing the display-oriented `completedAt`. Canonical re-completion still verifies dependencies and subtasks, records the new completion date, and logs activity, but awards task XP only if the marker is absent. Hydration and import normalize legacy completed tasks into the marker, and strict workspace validation accepts both legacy and marked records. Full validation passed **99 Vitest files / 318 tests**, TypeScript, the credential-literal scan, and the production build; no oversized-chunk warning was emitted.

Goal completion had the same reward-replay risk: the learner can reopen a goal, while direct completion had no in-flight claim and granted XP each time. Goals now use an account-hydrated completion claim and a backward-compatible `xpAwarded` marker. Reopening releases only the in-flight claim; a valid later completion can update the goal again but rewards XP only once. Legacy completed goals are normalized on hydration/import, and workspace validation accepts marked and legacy goals. Full validation passed **99 Vitest files / 320 tests**, TypeScript, the credential-literal scan, and the production build; no oversized-chunk warning was emitted.

Habit toggling previously derived its XP sign from a render-time state reference but modified the habit log in a queued functional update. Two fast toggles could leave the habit unchecked while awarding XP twice. Habit log, XP, achievement refresh, and meaningful-activity transition now derive from one actual predecessor state through a pure atomic helper; an undo subtracts the same habit XP and does not create activity. Focused regression covers the double-toggle invariant. Full validation passed **100 Vitest files / 321 tests**, TypeScript, the credential-literal scan, and the production build; no oversized-chunk warning was emitted.

### Verified accessibility repair — keyboard flashcard flipping

The review card faces were announced as buttons but could be flipped only by pointer click. Both faces now participate in keyboard focus order, expose their pressed state, and use the same flip handler for Enter and Space while preventing Space from scrolling the page. A focused regression verifies the semantic keyboard contract. Full validation passed **100 Vitest files / 322 tests**, TypeScript, the credential-literal scan, and the production build; real keyboard and screen-reader traversal remain manual acceptance boundaries.

### Verified P1 repair — plan item activation claims

Study Planner disabled an activated item only after the new session rendered. Rapid repeated activation could therefore create duplicate canonical planned sessions for one plan item. The StoreContext now claims the plan-item ID synchronously after all overlap guards pass, and refreshes claims from canonical sessions during hydration and subsequent session changes. Deleting that planned session naturally releases the claim through the same canonical source. Focused regressions cover claim placement and session-lifecycle integration. Full validation passed **100 Vitest files / 323 tests**, TypeScript, the credential-literal scan, and the production build; no oversized-chunk warning was emitted.

Missed-plan rebalancing also performs a compound state transition: it marks old items skipped and appends recovery items. Rapid repeated activation could compute the same recovery against the previous plan and append duplicates. The canonical rebalance path now claims the plan after a non-empty recovery is determined; claims clear when the study-plan collection changes, allowing a later legitimate recovery. Focused regressions cover the claim contract and deterministic recovery engine. Full validation passed **100 Vitest files / 324 tests**, TypeScript, the credential-literal scan, and the production build; no oversized-chunk warning was emitted.

### Verified P1 repair — local calendar date projections

Habit windows and Focus weekly history derived local date ranges by serializing local `Date` objects to UTC. In timezones away from UTC, late-day activity could appear under the next calendar date, making the current habit day unavailable or misclassifying focus history. Both projections now use the shared local calendar formatter (`isoDate`). Focused coverage verifies local date formatting and source usage. Full validation passed **101 Vitest files / 326 tests**, TypeScript, the credential-literal scan, and the production build; no oversized-chunk warning was emitted.

The same audit found three additional learner-facing projections with UTC calendar drift. Progress now groups task-completion XP by the local completion day and computes its 30-day cutoff locally; Saved Lessons displays the local saved day; and the seven-day local planner preserves each generated local calendar date. The regression checks the shared formatter is used at each projection. Full validation again passed **101 Vitest files / 326 tests**, TypeScript, the credential-literal scan, and the production build; no oversized-chunk warning was emitted. The controlled test proves source behavior only; timezone/device acceptance remains manual.

### Verified P1 repair — Daily Lesson question account-switch isolation

The existing lesson-generation callback was scoped to the active account and deterministic lesson selection, but the follow-up question callback was not. A question submitted immediately before an account or lesson change could append its answer to the new visible conversation. The active scope is now refreshed whenever the account/topic effect runs, including cached lessons; question success and failure callbacks reject a stale scope. Each prompt receives an ID, so a current-scope failure removes only its matching prompt rather than whichever message was most recently appended. Focused source regression coverage and full validation passed **101 Vitest files / 327 tests**, TypeScript, the credential-literal scan, and the production build; live provider latency and real account-switch acceptance remain manual boundaries.

### Verified P1 repair — browser reminder account isolation

Browser task and exam reminder logs previously shared one local-storage record across all workspaces in a browser profile. Although normal IDs are generated uniquely, imported or restored workspaces can retain matching IDs, so one learner's sent marker could suppress another learner's valid reminder. Reminder log keys now include the authenticated workspace scope, and the polling loop waits for that workspace to hydrate before it evaluates reminders. A focused collision regression confirms two accounts with the same task ID each receive their own due reminder. Full validation passed **102 Vitest files / 328 tests**, TypeScript, the credential-literal scan, and the production build; browser permission, operating-system delivery, and device presentation remain manual acceptance boundaries.

### Verified P1 repair — Study Assistant response ordering

The Study Assistant appended an answer only when its network request resolved. A later question could therefore receive its answer first, separating replies from their originating prompts and making a connected learning conversation misleading. Each accepted question now creates an in-place answer placeholder; success and fallback responses replace that placeholder, preserving question-and-answer order. New submissions are guarded while a request is pending, including the suggested-prompt path. Focused out-of-order resolution coverage and full validation passed **103 Vitest files / 329 tests**, TypeScript, the credential-literal scan, and the production build; live model quality and provider latency remain manual boundaries.

### Verified P1 repair — AI quiz-draft topic binding

Quiz Drafts previously accepted an asynchronous AI response into unscoped component state. If a learner changed the selected topic while the request was in flight, the old draft could be shown and then saved against the newly selected canonical topic. A request now claims the originating topic ID; a topic change invalidates that claim; stale responses are discarded; and the reviewed draft retains its originating canonical topic for the final `createQuiz` action. Focused topic-binding coverage and full validation passed **104 Vitest files / 330 tests**, TypeScript, the credential-literal scan, and the production build; live provider behavior remains a manual boundary.

### Verified P1 repair — AI material-draft binding

Material summary and practice-question callbacks previously read the currently selected PDF when they resolved. If a learner changed PDFs while an AI request was in flight, an old draft could reappear and create flashcards or a quiz against the new material's subject/topic. Each request now claims its originating material key; a selection change invalidates outstanding claims; stale responses are discarded; and summary/manual-quiz/generated-quiz artifact actions use the reviewed draft's retained material metadata. Focused material-binding coverage and full validation passed **105 Vitest files / 331 tests**, TypeScript, the credential-literal scan, and the production build; live provider behavior and PDF content quality remain manual boundaries.

### Verified P1 repair — Study Materials upload metadata binding

The upload form previously reconstructed a new local material record from live form state when an asynchronous upload completed. A learner could alter the title, subject, or topic while the file was being read/uploaded, causing the stored object to be recorded under later metadata rather than its submitted metadata. The submission now captures one immutable metadata object that is sent to the protected upload procedure and used for the canonical local material record after success. Focused regression coverage and full validation passed **106 Vitest files / 332 tests**, TypeScript, the credential-literal scan, and the production build; live upload/network/storage acceptance remains manual.

### Verified P1 repair — AI schedule proposal application idempotency

The reviewed AI schedule application loop created canonical sessions synchronously but had no proposal-level claim. Rapid repeated activation could submit the same reviewed proposal before React state reflected the newly added sessions, duplicating planner work. The dialog now claims a validated reviewed proposal before adding sessions, clears the visible proposal after successful application, and only resets the claim when a fresh draft is generated. Focused regression coverage and full validation passed **106 Vitest files / 333 tests**, TypeScript, the credential-literal scan, and the production build; provider output quality and real device interaction remain manual boundaries.

### Verified P1 repair — manual quiz-builder save idempotency

The manual quiz builder called canonical `createQuiz` directly with no synchronous save claim. Rapid repeated Save activation could create duplicate learner-authored quizzes before the dialog closed. The builder now claims the valid save before canonical creation and clears that claim only when the dialog closes, allowing a later distinct quiz while rejecting duplicate activation of the current form. Focused regression coverage and full validation passed **106 Vitest files / 334 tests**, TypeScript, the credential-literal scan, and the production build; real device interaction remains a manual boundary.

### Verified P1 repair — Quick Add session idempotency

Quick Add requires a reviewable natural-language session draft before creation, but its canonical session action had no synchronous draft claim. Rapid repeated confirmation could create duplicate planned sessions before the dialog cleared. The reviewed draft is now claimed before `addSession`; the claim resets only when the review draft is cleared or a new review begins. Focused regression coverage and full validation passed **107 Vitest files / 335 tests**, TypeScript, the credential-literal scan, and the production build; real keyboard/touch interaction remains a manual boundary.

### Verified P1 repair — onboarding profile-photo selection ordering

Profile-photo preparation is asynchronous. Selecting a second image while the first was being compressed could allow the earlier request to resolve last and overwrite the later choice. Each preparation now carries a monotonically increasing selection token; only the latest token may set the prepared image, error, or preparing state. Focused regression coverage and full validation passed **108 Vitest files / 336 tests**, TypeScript, the credential-literal scan, and the production build; real image decoding/compression and device upload acceptance remain manual boundaries.

### Verified P1 repair — manual Study Planner session-save idempotency

The reusable manual Study Planner dialog validated a proposed session but called its canonical save callback without a synchronous dialog-level claim. Rapid repeated Save activation could create duplicate new sessions before the dialog closed. A valid dialog save is now claimed before the canonical callback and the claim resets when the dialog is opened for a new edit/create operation. Focused regression coverage and full validation passed **108 Vitest files / 337 tests**, TypeScript, the credential-literal scan, and the production build; real keyboard/touch interaction remains a manual boundary.

### Verified P1 repair — manual task-dialog save idempotency

The manual task dialog validated a task before invoking canonical save but did not synchronously claim the current submission. Rapid repeated Save activation could create duplicate new tasks before the dialog closed. Valid submissions are now claimed before the callback and the claim resets whenever the dialog is opened. Focused regression coverage and full validation passed **109 Vitest files / 338 tests**, TypeScript, the credential-literal scan, and the production build; real keyboard/touch interaction remains a manual boundary.

### Verified P1 repair — manual flashcard dialog save idempotency

The manual flashcard dialog called canonical card creation directly after validation, allowing rapid repeated Add card activation to append duplicate cards before the dialog closed. Valid submissions are now synchronously claimed before creation and the claim resets when the dialog opens for the next card. Focused regression coverage and full validation passed **110 Vitest files / 339 tests**, TypeScript, the credential-literal scan, and the production build; real keyboard/touch interaction remains a manual boundary.

### Verified P1 repair — manual note editor save idempotency

The manual note editor invoked canonical note creation directly after validation, allowing rapid repeated Save note activation to append duplicate notes before the editor closed. Valid submissions are now synchronously claimed before creation and the claim resets when the editor opens for a new note or edit. Focused regression coverage and full validation passed **111 Vitest files / 340 tests**, TypeScript, the credential-literal scan, and the production build; real keyboard/touch interaction remains a manual boundary.

### Verified P1 repair — manual budget transaction save idempotency

The budget transaction dialog invoked canonical creation directly after validation, allowing rapid repeated Add transaction activation to append duplicate financial entries before the dialog closed. Valid submissions are now synchronously claimed before creation and the claim resets when the dialog opens for the next transaction. Focused regression coverage and full validation passed **112 Vitest files / 341 tests**, TypeScript, the credential-literal scan, and the production build; real keyboard/touch interaction remains a manual boundary.

### Verified P1 repair — manual flashcard deck save idempotency

The manual flashcard deck dialog invoked canonical deck creation directly after validation, allowing rapid repeated Create deck activation to append duplicate decks before the dialog closed. Valid submissions are now synchronously claimed before creation and the claim resets when the dialog opens for the next deck. Focused regression coverage and full validation passed **112 Vitest files / 342 tests**, TypeScript, the credential-literal scan, and the production build; real keyboard/touch interaction remains a manual boundary.

### Verified P1 repair — manual exam dialog save idempotency

The manual exam dialog invoked canonical exam creation directly after validation, allowing rapid repeated Add exam activation to append duplicate exams before the dialog closed. Valid submissions are now synchronously claimed before creation and the claim resets when the dialog opens for the next exam or edit. Focused regression coverage and full validation passed **113 Vitest files / 343 tests**, TypeScript, the credential-literal scan, and the production build; real keyboard/touch interaction remains a manual boundary.

### Verified P1 repair — manual goal dialog save idempotency

The manual goal dialog invoked canonical goal creation directly after validation, allowing rapid repeated Save goal activation to append duplicate goals before the dialog closed. Valid submissions are now synchronously claimed before creation and the claim resets when the dialog opens for the next goal. Focused regression coverage and full validation passed **114 Vitest files / 344 tests**, TypeScript, the credential-literal scan, and the production build; real keyboard/touch interaction remains a manual boundary.

### Verified P1 repair — manual habit creation idempotency

The manual habit form invoked canonical habit creation directly after validation, allowing rapid repeated Add habit activation to append duplicate habits before the dialog closed. Valid submissions are now synchronously claimed before creation and the claim resets when the dialog opens for the next habit. Focused regression coverage and full validation passed **115 Vitest files / 345 tests**, TypeScript, the credential-literal scan, and the production build; real keyboard/touch interaction remains a manual boundary.

### Verified P1 repair — flashcard review runner idempotency

Flashcard review records direct recall evidence when a grade changes the card’s scheduling fields. Before the next card rendered, rapid repeated grading could apply more than one score to the same current card and append duplicate recall evidence. The review runner now synchronously claims the visible card before scheduling it and advancing, while preserving later review sessions after the card is next due. A focused regression covers the claim placement. Full validation passed **98 Vitest files / 313 tests**, TypeScript, the credential-literal scan, and the production build; no oversized-chunk warning was emitted.

### Verified P1 repair — reviewed material drafts apply once

Both the learner-authored summary quiz builder and the checked AI material-question draft could create a canonical quiz synchronously before their draft-clearing state rendered. Rapid repeated activation could therefore duplicate a reviewed practice quiz. Each save action now claims its current draft before calling the canonical quiz creation action and releases the claim only after that draft is cleared, so a newly created or regenerated draft remains independently reviewable. Focused regressions cover both manual and AI-derived paths. Full validation passed **99 Vitest files / 315 tests**, TypeScript, the credential-literal scan, and the production build; no oversized-chunk warning was emitted.

The same audit found that adaptive-plan creation and missed-plan recovery reserved dated sessions and tasks but did not reserve matching recurring timetable events. Revision could therefore be placed inside a scheduled class despite the app already treating timetable blocks as capacity constraints. Both flows now calculate the recurrent event's duration for the local planning date and include its time range in collision detection. Focused regressions cover a 18:00–18:30 class pushing a 30-minute revision block to 18:30, and the equivalent missed-plan recovery case. The remaining calendar boundary is intentional: the calendar renders recurring events while dated sessions/tasks/exams remain their own canonical records. Full validation for both repairs passed **92 Vitest files / 296 tests**, TypeScript, the credential-literal scan, and the production build; the largest JavaScript asset remains 428.14 kB and the oversized-chunk warning is absent.

## Explicit boundaries

The archive, current test suite, and source inspection cannot demonstrate a live OAuth provider journey, installed-PWA notification delivery, real provider PDF processing, or physical low-end-Android performance. Those remain manual acceptance checks.

## Consolidated reconciliation state

The 833-line available product specification has now been traced through the canonical state, planner, learning-loop, account-boundary, notification, material, AI, accessibility, and delivery paths described in this record. The table below is a current evidence index, not a claim that the truncated source specification was fully available or that external/device acceptance has occurred.

| Available specification area                        | Current source-controlled state                                                                                                                                                                          | Remaining boundary                                                                                        |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Command center, Today, plans, task/session recovery | **VERIFIED at source level.** Shared `learningIntelligence` ranking, lifecycle-safe session/task actions, capacity/recovery behavior, and cycle-safe dependencies were traced and repaired where needed. | Signed-in workflow and learner judgment remain manual.                                                    |
| Mastery, flashcards, reviews, quizzes, retest       | **VERIFIED for local practice learning loop.** Direct evidence labels, due-only cards, remediation, duplicate-submit prevention, and canonical review routes are controlled.                             | Trusted 50-question, server-authoritative assessment is **NOT IMPLEMENTED**.                              |
| Materials, notes, and connected knowledge           | **VERIFIED at source level.** Ownership, action consent, review gates, private access, topic links, and browser-local reviewed export were traced.                                                       | Live PDF/provider behavior and physical storage deletion remain manual/infrastructure boundaries.         |
| AI learning support                                 | **VERIFIED at source level.** Calls are server-only, protected/rate-limited, bounded, validated where structured, and subject to learner review before canonical draft application.                      | Live catalog/provider/media quality remains manual.                                                       |
| Account isolation, PWA, notifications               | **VERIFIED for controlled code paths.** Cookie-only sessions, account-scoped hydration/cache, private-cache exclusion, bounded reminder planning, and endpoint ownership were traced.                    | OAuth portal, installed PWA, permissions, push transport, and physical device presentation remain manual. |
| Accessibility and mobile source semantics           | **VERIFIED for repaired source contracts.** Navigation, modal focus/name, Quick Add, and onboarding selection state regressions are covered.                                                             | Real keyboard, screen reader, zoom, and touch testing remain manual.                                      |
| Bundle delivery                                     | **VERIFIED for build boundaries.** The 767.10 kB shared chunk was split; no Vite oversized-chunk warning remains and the largest asset is 428.14 kB.                                                     | Network, CPU/memory, cache, and Core Web Vitals measurement remain manual.                                |
| Curriculum provenance                               | **NOT IMPLEMENTED.** Static and custom subjects remain learner-defined and are not called official.                                                                                                      | Requires the separately designed optional country/system/catalogue migration.                             |

### Verified P1 repair — Quick Add creation idempotency

Quick Add already claimed reviewed natural-language session drafts, but its direct task, flashcard, and expense paths invoked canonical mutations before the dialog closed. Rapid repeated activation could therefore append duplicate records. Each of those valid paths now synchronously claims the current dialog submission before its canonical mutation, and the shared claim resets only when the dialog opens for another capture. Focused regression coverage and full validation passed **116 Vitest files / 346 tests**, TypeScript, the credential-literal scan, and the production build; real keyboard and touch interaction remain manual acceptance boundaries.

### Verified P1 repair — Exam Center topic creation idempotency

The Exam Center added a topic directly from either Enter or the Add button. Rapid repeated activation could append duplicate topics to the same canonical exam before the input-clearing state rendered. Each exam topic input now holds a synchronous claim after a valid creation; the claim is released only when the learner changes that input for a later topic. Focused regression coverage and full validation passed **117 Vitest files / 347 tests**, TypeScript, the credential-literal scan, and the production build; real keyboard and touch interaction remain manual acceptance boundaries.

### Verified P1 repair — Timetable event creation idempotency

The reusable Timetable event dialog invoked canonical creation after validation but before its closing state rendered. Rapid repeated Add event activation could therefore append duplicate recurring schedule events. Valid new-event submissions are now synchronously claimed before their canonical save, and that claim resets each time the dialog opens; edit saves retain their existing update behavior. Focused regression coverage and full validation passed **118 Vitest files / 348 tests**, TypeScript, the credential-literal scan, and the production build; real keyboard and touch interaction remain manual acceptance boundaries.

### Verified P1 repair — friendly leaderboard participant creation idempotency

The friendly leaderboard’s Add rival action invoked canonical participant creation before its dialog closed. Rapid repeated activation could therefore append duplicate local participant records. Valid additions are now synchronously claimed before creation, and the claim resets each time the dialog opens for a later participant. Focused regression coverage and full validation passed **119 Vitest files / 349 tests**, TypeScript, the credential-literal scan, and the production build; this remains a learner-managed local leaderboard rather than a verified multi-account social ranking service.

### Verified P1 repair — custom reminder creation idempotency

Custom reminder creation validates schedule fields and checks existing reminders, but those checks read the pre-render workspace. Rapid repeated Save reminder activation could therefore enqueue duplicate canonical reminders before local state refreshed. Valid creation now synchronously claims the current form before canonical addition, releases the claim if validation rejects the addition, and releases it for a later reminder only when the learner edits the form. Focused regression coverage and full validation passed **120 Vitest files / 350 tests**, TypeScript, the credential-literal scan, and the production build; browser permission, push transport, and device presentation remain manual acceptance boundaries.

### Verified P1 repair — onboarding custom-subject idempotency

Custom-subject addition checked duplicates against the render-time `subjects` array before scheduling an append. Rapid repeated activation could enqueue two functional appends that both accepted the same custom label, leading to a duplicate in the eventual profile state. The duplicate check now runs inside the functional state transition itself, preserving case-insensitive matching even when React batches activations. Focused regression coverage and full validation passed **121 Vitest files / 351 tests**, TypeScript, the credential-literal scan, and the production build; onboarding provider, device, and profile-photo acceptance remain manual boundaries.

### Verified P1 repair — onboarding completion idempotency

The final Build my workspace action set its visual uploading state only after the handler started. Rapid repeated activation could therefore initiate more than one profile-photo upload and more than one local profile-completion write before the control re-rendered disabled. The completion handler now synchronously claims its first invocation before any upload or canonical profile write, releasing the claim only after a failed upload so the learner may retry. Focused regression coverage and full validation passed **122 Vitest files / 352 tests**, TypeScript, the credential-literal scan, and the production build; live provider upload, OAuth, and device behavior remain manual acceptance boundaries.

### Verified P1 repair — adaptive revision-plan save idempotency

The reviewed adaptive revision-plan Save action created a canonical study plan before its close-and-clear state rendered. Rapid repeated activation could therefore duplicate the same plan and its items. Each generated adaptive plan now starts with a fresh synchronous save claim; the first valid save claims the plan before canonical creation, while regenerating a plan resets the claim for the new review. Focused regression coverage and full validation passed **123 Vitest files / 353 tests**, TypeScript, the credential-literal scan, and the production build; real keyboard and touch interaction remain manual acceptance boundaries.

### Verified P1 repair — Daily Lesson bookmark idempotency

Daily Lesson bookmarks were deduplicated only against the render-time saved-lesson collection. Rapid repeated Save for review activation could enqueue duplicate records before that collection refreshed. The canonical workspace now hydrates, maintains, and checks a deterministic selection-key claim before appending a bookmark, so duplicate activations are rejected while normal remove-and-resave behavior remains available after state synchronization. Focused regression coverage and full validation passed **124 Vitest files / 354 tests**, TypeScript, the credential-literal scan, and the production build; live account, device, and offline-reconciliation acceptance remain manual boundaries.

### Verified P1 repair — AI quiz-draft acceptance idempotency

An AI quiz draft remained rendered until the accepted-save state cleared it. Rapid repeated Save after review activation could therefore create duplicate canonical quizzes from the same reviewed draft. Each fresh draft request now resets a synchronous save claim, and the first accepted save claims the draft before canonical creation. Focused regression coverage and full validation passed **125 Vitest files / 355 tests**, TypeScript, the credential-literal scan, and the production build; provider response quality and real interaction remain manual acceptance boundaries.

### Verified P1 repair — material-summary flashcard deck idempotency

The summary review surface disabled flashcard saving only after state rendered. Rapid repeated Save reviewed key ideas as flashcards activation could therefore append duplicate canonical decks from one reviewed summary. Each fresh summary draft now resets a synchronous flashcard-save claim, and the first save claims it before canonical deck creation. Focused regression coverage and full validation passed **126 Vitest files / 356 tests**, TypeScript, the credential-literal scan, and the production build; provider output quality and real interaction remain manual acceptance boundaries.

### Verified P1 repair — dashboard task-completion feedback integrity

The dashboard dispatched canonical task completion and then unconditionally logged activity and displayed celebration feedback. When completion was rejected for unmet dependencies, incomplete subtasks, or a repeated activation, the dashboard could still present success-like feedback and schedule a redundant activity update. The dashboard now gates its celebration solely on the canonical completion result; canonical completion remains the sole activity recorder. Focused regression coverage and full validation passed **127 Vitest files / 357 tests**, TypeScript, the credential-literal scan, and the production build; real keyboard and touch interaction remain manual acceptance boundaries.

### Verified P1 repair — Focus reminder synchronization ordering

Focus controls wrote device reminder state asynchronously on start, pause, reset, preset change, and completion. Rapid control changes could allow an earlier request to finish after a later one and restore an obsolete focus reminder remotely. Focus now serializes device-sync writes and replays the most recently requested reminder state until it is synchronized. Focused regression coverage and full validation passed **128 Vitest files / 358 tests**, TypeScript, the credential-literal scan, and the production build; browser permission, push service delivery, and device notification presentation remain manual acceptance boundaries.

### Verified P1 repair — Focus reminder preference enforcement

The active Focus completion reminder was appended after general device reminders had already applied quiet-hours and daily-cap limits. It could therefore bypass the learner’s configured notification policy. The combined Focus and general reminder set is now passed through the shared preference limiter immediately before device synchronization. Focused regression coverage and full validation passed **129 Vitest files / 359 tests**, TypeScript, the credential-literal scan, and the production build; browser permission, push service delivery, and device notification presentation remain manual acceptance boundaries.

### Verified P1 repair — general device reminder synchronization ordering

The effect-driven device synchronizer could issue overlapping register-and-sync requests after local reminder-plan changes. Cleanup flags could prevent later JavaScript continuation but could not stop an already dispatched older server request from finishing after a newer request and restoring a stale plan. The synchronizer now serializes latest-plan jobs until the current version is applied. It also applies the shared quiet-hours and daily-cap limiter when restoring an active Focus reminder. Focused regression coverage and full validation passed **130 Vitest files / 360 tests**, TypeScript, the credential-literal scan, and the production build; browser permission, push service delivery, and device notification presentation remain manual acceptance boundaries.

### Verified P1 repair — Focus reminder-category preference enforcement

The Focus start action created and synchronized an active completion reminder whenever the timer entered a focus phase, regardless of whether the learner had disabled the Focus reminder category. Focus now creates the active completion reminder only when that category is enabled; pausing, reset, completion, and general synchronization continue to clear or omit it when appropriate. Focused regression coverage and full validation passed **131 Vitest files / 361 tests**, TypeScript, the credential-literal scan, and the production build; browser permission, push service delivery, and device notification presentation remain manual acceptance boundaries.

### Verified P1 repair — server reminder replacement atomicity

Authenticated server reminder replacement previously performed ownership lookup, pending-reminder deletion, and replacement insertion as independent database operations. Overlapping client synchronization requests for one endpoint could interleave those steps and leave a mixed reminder queue. The owned-device lookup and complete pending-plan replacement now execute in one database transaction. Focused regression coverage and full validation passed **132 Vitest files / 362 tests**, TypeScript, the credential-literal scan, and the production build; live database concurrency and push transport remain manual acceptance boundaries.

### Verified P1 repair — notification-disable boundary integrity

Turning phone reminders off could race an in-flight permission, subscription, registration, or synchronization path. A stale successful path could re-enable the device after the learner had disabled reminders. Settings now uses a monotonic toggle guard and compensates stale registrations by disabling and unsubscribing the device. The general synchronizer invalidates queued plans when notifications are disabled and disables any registration that completes after that change. Focused regression coverage and full validation passed **133 Vitest files / 364 tests**, TypeScript, the credential-literal scan, and the production build; browser permission, push service delivery, and device notification presentation remain manual acceptance boundaries.

### Verified P1 repair — study-material storage-key integrity

Distinct uploads with the same file name were stored under an account-and-name path. A later file with the same name could overwrite the bytes referenced by an earlier canonical material record. New material object names now include the content SHA-256 reservation hash before the sanitized file name, preserving existing byte-level deduplication while separating distinct uploads. Focused regression coverage and full validation passed **134 Vitest files / 366 tests**, TypeScript, the credential-literal scan, and the production build; live object-storage behavior and PDF parsing remain manual acceptance boundaries.

### Verified P1 repair — practice-quiz answer selection accessibility

Practice-quiz answer choices were keyboard-operable buttons but their selected visual state was not exposed to assistive technology. Answer controls now declare an explicit button type, are grouped as answer options, and reflect the learner’s current selected answer with `aria-pressed`. Focused regression coverage and full validation passed **135 Vitest files / 367 tests**, TypeScript, the credential-literal scan, and the production build; screen-reader, keyboard, touch, and zoom acceptance remain manual boundaries.

### Verified P1 repair — ranked study recommendation handoff integrity

Ranked exam-topic recommendations exposed a canonical topic only in their title and action ID, then routed every learner to the generic Study Planner. That route discarded the intended exam-topic identity, so a learner could create unrelated work after accepting the recommendation. The deterministic recommendation now carries an opaque canonical topic ID into the Study Planner. The planner resolves that ID only against the learner’s local canonical topics or exam topics before opening one prefilled new-session dialog; unrecognised URL values do not create or label a topic. Dashboard, Today, and Reviews use the same URL builder. Focused regression coverage and full validation passed **136 Vitest files / 369 tests**, TypeScript, the credential-literal scan, and the production build; real keyboard, touch, screen-reader, device, and account-hydration acceptance remain manual boundaries.

### Verified P1 repair — Mastery recommendation handoff integrity

Mastery’s topic-level actions displayed a specific canonical topic but sent learners to generic Study Planner or Practice Quizzes pages. The destination could therefore lose the chosen topic and create unrelated work. Mastery actions now carry only the opaque canonical topic ID. Study Planner and the practice-quiz builder independently resolve that ID against the learner’s canonical topic collections before opening one prefilled creation dialog; manual retained topics are available to the quiz builder alongside active exam topics. Unknown values do not create a topic or label. Focused regression coverage and full validation passed **137 Vitest files / 371 tests**, TypeScript, the credential-literal scan, and the production build; real keyboard, touch, screen-reader, device, and account-hydration acceptance remain manual boundaries.

### Verified P1 repair — Progress completed-duration integrity

Progress subject and weekly study-time projections used each session’s planned duration even after a learner recorded a different actual duration at completion. This could disagree with canonical completion evidence and other learning surfaces. Progress now uses one tested completed-duration helper, which prefers `actualDuration` while preserving the planned duration for legacy sessions without an actual value. Focused regression coverage and full validation passed **138 Vitest files / 372 tests**, TypeScript, the credential-literal scan, and the production build; real device, timezone, keyboard, touch, screen-reader, and account-hydration acceptance remain manual boundaries.

### Verified P1 repair — Progress weekly Focus aggregation integrity

Progress’s weekly learning-time card counted completed Study Planner sessions but excluded canonical Focus-session records, even though its subject breakdown and review summaries include focus work. The weekly card now uses a tested aggregation helper that combines in-range Focus minutes with completed-session actual duration (or legacy planned duration where no actual value exists). Focused regression coverage and full validation passed **138 Vitest files / 373 tests**, TypeScript, the credential-literal scan, and the production build; real device, timezone, keyboard, touch, screen-reader, and account-hydration acceptance remain manual boundaries.

### Verified P1 repair — Study Assistant weekly learning-summary integrity

The Study Assistant’s personalized planning reply labeled an all-time completed-session sum as “this week” and excluded Focus work. Its learner context likewise omitted a canonical weekly total. Both now use one tested current-week helper shared with the learning-time projection logic, combining in-range Focus records with completed-session actual duration (or legacy planned duration). Focused regression coverage and full validation passed **138 Vitest files / 374 tests**, TypeScript, the credential-literal scan, and the production build; live provider-response quality, device, timezone, keyboard, touch, screen-reader, and account-hydration acceptance remain manual boundaries.

### Verified P1 repair — friendly leaderboard weekly-XP integrity

The leaderboard compared each friend’s disclosed device-local weekly estimate to the learner’s all-time `state.xp`, while presenting the board as a weekly competition. The learner row now derives only dated canonical rewards inside the selected local week: completed sessions, Focus work, tasks, dated goal rewards, quiz attempts, Daily Lesson completions, and habit completions. Newly completed goals retain an optional reward timestamp; older undated rewards are deliberately excluded rather than presented as current-week points. The UI now distinguishes the learner’s recorded weekly XP from simulated friend estimates. Focused regression coverage and full validation passed **139 Vitest files / 375 tests**, TypeScript, the credential-literal scan, and the production build; real multi-device reconciliation and peer competition remain manual and deferred boundaries.

### Verified P1 repair — practice-quiz answer-group accessibility integrity

Practice-quiz choices exposed pressed state on their individual buttons, but their container remained a generic `div`; its `aria-label` therefore did not establish an explicit group landmark for assistive technology. The answer container now uses `role="group"` with the existing label, while preserving semantic button controls and `aria-pressed` state. Focused regression coverage and full validation passed **139 Vitest files / 375 tests**, TypeScript, the credential-literal scan, and the production build; real screen-reader, keyboard, touch, and zoom acceptance remain manual boundaries.

### Verified P1 repair — mastery evidence recency local-date integrity

The deterministic mastery engine derived an evidence record’s recency day by slicing its UTC timestamp string. Near local midnight this can assign evidence to the prior or next calendar day and cross a 7- or 30-day weighting threshold incorrectly. The shared recency helper now converts valid timestamps through the local `isoDate` utility before applying the existing thresholds, retaining a bounded fallback for legacy malformed values. Focused regression coverage and full validation passed **139 Vitest files / 376 tests**, TypeScript, the credential-literal scan, and the production build; real timezone/device acceptance remains manual.

### Verified P1 repair — recurring timetable event overlap integrity

Manual recurring timetable events validated only basic end-after-start input. A newly created or edited event could overlap an existing weekly block and then invalidate the study planner’s availability assumptions. The shared scheduling module now detects same-day interval intersection, invalid event times, adjacent blocks, and the event currently being edited. Canonical `addEvent` and `updateEvent` use that guard before state mutation. Focused regression coverage and full validation passed **140 Vitest files / 378 tests**, TypeScript, the credential-literal scan, and the production build; real keyboard, touch, screen-reader, timezone, and device acceptance remain manual boundaries.

### Verified P1 repair — Focus canonical topic-selection integrity

Focus offered topic links from the manual-topic collection only. Learners could not directly select an exam-only canonical topic for a focus round, so its effort evidence could be omitted from the connected learning loop. Focus now deduplicates manual and exam topics into one canonical selector and synchronizes the selected topic’s canonical subject before completion. Focused regression coverage and full validation passed **141 Vitest files / 379 tests**, TypeScript, the credential-literal scan, and the production build; real keyboard, touch, screen-reader, device, and account-hydration acceptance remain manual boundaries.

### Verified P1 repair — AI quiz-draft canonical topic-existence integrity

An AI quiz draft retained its originating topic data after review, but could still be accepted after that topic was removed from the canonical workspace. This created a linked quiz whose topic no longer existed. Acceptance now resolves the reviewed draft’s opaque topic ID against the current canonical topic set before claiming or creating a quiz. If the topic has been removed, the draft is discarded with actionable feedback; otherwise the latest canonical subject and name are used. Focused regression coverage and full validation passed **141 Vitest files / 379 tests**, TypeScript, the credential-literal scan, and the production build; live provider-response and interaction acceptance remain manual boundaries.

### Verified P1 repair — material-derived quiz canonical topic integrity

Reviewed material-summary and AI practice-question drafts looked up topic labels in the manual-topic collection only. An exam-only material topic could therefore produce a blank quiz topic label, and a removed topic could still be accepted as an orphaned link. Both reviewed save paths now resolve the material’s opaque topic ID against a deduplicated current manual-and-exam topic set before claiming a save. Current canonical subject/name are used; a removed topic blocks canonical quiz creation while preserving the reviewed draft for the learner. Focused regression coverage and full validation passed **141 Vitest files / 380 tests**, TypeScript, the credential-literal scan, and the production build; live provider-response and interaction acceptance remain manual boundaries.

### Verified P1 repair — Flashcards stale review-deck render safety

When an active review deck disappeared through a canonical state change, Flashcards called `setReviewing(null)` during render. This violates React’s render purity and can create unstable recovery behavior. The stale-deck condition is now reconciled in an effect; the interim render remains side-effect free and returns no review panel until the effect restores the deck list. Focused regression coverage and full validation passed **141 Vitest files / 381 tests**, TypeScript, the credential-literal scan, and the production build; real keyboard, touch, screen-reader, device, and account-hydration acceptance remain manual boundaries.

### Verified P1 repair — Quick Add canonical session-rejection feedback integrity

Quick Add treated canonical planned-session creation as successful even when the StoreContext overlap guard rejected the proposed time. It then showed a success toast, cleared the reviewed draft, and closed the dialog although no session existed. Canonical `addSession` now returns an explicit acceptance result after retaining its overlap guards. Quick Add reports success and clears its draft only after acceptance; a rejection leaves the reviewed draft editable and resets its one-time claim. Focused regression coverage and full validation passed **141 Vitest files / 382 tests**, TypeScript, the credential-literal scan, and the production build; real keyboard, touch, screen-reader, timezone, device, and account-hydration acceptance remain manual boundaries.

### Verified P1 repair — canonical transaction validation and save-feedback integrity

The manual Budget dialog allowed its date input to be cleared, while canonical `addTransaction` accepted any record without validation. An empty or malformed date could therefore enter the local-first workspace and later cause cloud-workspace schema rejection. A shared bounded transaction validator now verifies the transaction type, positive finite amount, category, label, and real local ISO calendar date before canonical mutation. `addTransaction` returns acceptance; the Budget form and Quick Add retain their input and avoid success feedback when a canonical write is rejected. Focused regression coverage and full validation passed **142 Vitest files / 385 tests**, TypeScript, the credential-literal scan, and the production build; real keyboard, touch, screen-reader, timezone, device, and account-hydration acceptance remain manual boundaries.

### Verified P1 repair — canonical optional-goal-deadline integrity

The Goal dialog represented its optional deadline as `undefined` when the learner left it empty, even though canonical workspace goals require a string deadline. That record could enter the local-first state and later fail cloud-workspace schema validation. Shared calendar and goal validation now preserve an intentionally omitted deadline as the canonical empty string, reject malformed or impossible calendar values and invalid bounded goal fields before mutation, and return acceptance from `addGoal`. The dialog retains input and avoids success feedback if canonical creation rejects it. Focused regression coverage and full validation passed **143 Vitest files / 388 tests**, TypeScript, the credential-literal scan, and the production build; real keyboard, touch, screen-reader, timezone, device, and account-hydration acceptance remain manual boundaries.

### Verified P1 repair — review-summary local-date attribution integrity

Daily and weekly review summaries classified quiz attempts by slicing a UTC timestamp and compared task completion timestamps directly to local calendar dates. Completed tasks consequently did not appear in summaries, while attempts near a local-date boundary could be assigned to the wrong day. A shared timestamp-to-local-date helper now normalizes review and leaderboard projections; malformed timestamps are excluded. Focused regression coverage and full validation passed **143 Vitest files / 389 tests**, TypeScript, the credential-literal scan, and the production build; real timezone and device acceptance remain manual boundaries.

### Verified P1 repair — same-day habit-log conflict merge integrity

The local-first conflict merge shallowly overlaid habit logs by date. Independent same-day completions on two devices therefore caused the active device’s array to replace the cloud array, silently dropping valid completion history. The canonical merger now takes a deterministic union per local calendar day and excludes habit IDs covered by deletion tombstones, preserving idempotent deletion-wins behavior. Focused regression coverage and full validation passed **143 Vitest files / 390 tests**, TypeScript, the credential-literal scan, and the production build; real multi-device conflict acceptance remains a manual boundary.

### Verified P1 repair — stale-deck card-creation feedback integrity

Manual Flashcard and Quick Add card creation could target a deck that disappeared through a concurrent canonical update. `addCard` silently left state unchanged, while callers cleared the learner’s card input and reported success. Canonical `addCard` now returns acceptance after checking deck existence. Both callers retain their reviewed input and avoid false-success feedback when the target deck is gone. Focused regression coverage and full validation passed **143 Vitest files / 391 tests**, TypeScript, the credential-literal scan, and the production build; real multi-device and interaction acceptance remain manual boundaries.

### Verified P1 repair — timetable overlap-rejection feedback integrity

Timetable create and edit dialogs closed after dispatching a save even when StoreContext rejected the proposed recurring event for overlapping another weekly block. That discarded the learner’s event details despite no canonical mutation. Canonical add and update actions now return acceptance, and the dialog closes only after acceptance; rejected details remain editable with an actionable message. Focused regression coverage and full validation passed **143 Vitest files / 392 tests**, TypeScript, the credential-literal scan, and the production build; real keyboard, touch, screen-reader, timezone, and multi-device acceptance remain manual boundaries.

### Verified P1 repair — Study Planner overlap-rejection feedback integrity

The Study Planner dialog closed after dispatching a manual session save even when canonical overlap guards rejected the new or edited time. That discarded the learner’s session details despite no canonical mutation. Canonical session update now returns acceptance alongside existing creation results, and the dialog closes only after acceptance; rejected details remain editable with an actionable message. Focused regression coverage and full validation passed **143 Vitest files / 393 tests**, TypeScript, the credential-literal scan, and the production build; real keyboard, touch, screen-reader, timezone, and multi-device acceptance remain manual boundaries.

### Verified P1 repair — Task canonical-topic linkage integrity

The Task dialog offered only retained manual topics for direct work linkage, excluding current exam topics that were already canonical and available in other learning surfaces. The dialog now deduplicates manual and exam topics, includes both in its selector, and synchronizes the task subject when the learner chooses a topic. Focused regression coverage and full validation passed **143 Vitest files / 394 tests**, TypeScript, the credential-literal scan, and the production build; real keyboard, touch, screen-reader, and multi-device acceptance remain manual boundaries.

### Verified P1 repair — nested study-plan conflict merge integrity

Workspace conflict reconciliation treated a study plan as a flat record. Independent additions or recovery updates to different nested plan items on two devices could therefore be lost when the active device’s whole plan replaced the cloud plan. Study-plan merging now preserves independent item IDs and retains the active device’s version only when both devices changed the same item, mirroring established nested-card behavior. Focused regression coverage and full validation passed **143 Vitest files / 395 tests**, TypeScript, the credential-literal scan, and the production build; real multi-device conflict acceptance remains a manual boundary.

### Verified P1 repair — nested exam-topic conflict merge integrity

Workspace conflict reconciliation also treated an exam as a flat record. Independent exam-topic additions or status updates on two devices could therefore be lost when the active device’s full exam record replaced the cloud version. Exam merging now preserves independent topic IDs and retains the active device’s version only for a true same-topic conflict, with idempotence coverage. Focused regression coverage and full validation passed **143 Vitest files / 396 tests**, TypeScript, the credential-literal scan, and the production build; real multi-device conflict acceptance remains a manual boundary.

### Verified P1 repair — notification-disable queued-reminder integrity

Turning off the master notification setting stopped future browser synchronization but did not clear an already queued server reminder plan for the installed device. Phone alerts could therefore still arrive after the learner disabled notifications, and retaining the old synchronization key could then suppress a later re-enable. The synchronizer now resolves the existing device endpoint without prompting, disables its server queue, and resets the key before re-enable. Focused regression coverage and full validation passed **143 Vitest files / 396 tests**, TypeScript, the credential-literal scan, and the production build; real browser permission, installed-PWA, push-provider delivery, and device acceptance remain manual boundaries.

### Verified P1 repair — Note stale-topic linkage integrity

The Note editor retained a removed canonical topic ID in its local state and could persist that stale link when the learner saved an open note after a topic deletion. The editor now resolves topic IDs only against the current canonical manual-and-exam topic list, clears an unavailable selector value, and saves no link when a topic is no longer present. The StoreContext note-update contract now also explicitly accepts `topicId` patches. Focused regression coverage and full validation passed **143 Vitest files / 397 tests**, TypeScript, the credential-literal scan, and the production build; real keyboard, touch, screen-reader, timezone, and multi-device acceptance remain manual boundaries.

### Verified P1 repair — flashcard deck stale-topic linkage integrity

The Deck editor retained a removed canonical topic ID in its local state and could persist that stale link if a learner saved after a topic deletion. The deck selector now resolves IDs only against the current deduplicated manual-and-exam topic list, clears an unavailable selector value, and omits a missing topic from the canonical deck save. Focused regression coverage and full validation passed **143 Vitest files / 398 tests**, TypeScript, the credential-literal scan, and the production build;
real keyboard, touch, screen-reader, timezone, and multi-device acceptance remain manual boundaries.

### Verified P1 repair — Exam Center canonical-write integrity

Exam creation and editing accepted unbounded or malformed field data before local mutation, and the dialog closed immediately after dispatch rather than preserving a rejected create or edit draft. Nested topic creation similarly cleared its draft despite a concurrently removed target exam, and neither path prevented the shared schema’s 501st record. Shared validation now normalizes and bounds editable exam fields, StoreContext validates each create and edit, and create actions enforce exported schema-aligned limits of 500 exams and 500 topics per exam. Canonical actions return acceptance; a rejected exam or topic write retains the learner’s editable draft and releases its duplicate-submit claim. Focused regression coverage and full validation passed **146 Vitest files / 405 tests**, TypeScript, the credential-literal scan, and the production build; real keyboard, touch, screen-reader, timezone, and multi-device acceptance remain manual boundaries.

### Verified P1 repair — canonical practice-quiz write integrity

Quiz creation previously accepted unchecked quiz fields and question structures into the local-first workspace, then always cleared manual, AI-review, and material-review state. Malformed titles, prompts, options, answer indices, explanations, or stale canonical topic links could therefore become later cloud-schema failures or discard reviewed learner work. Shared quiz validation now normalizes and bounds the complete quiz payload; StoreContext re-resolves a linked topic’s current identity before creating the quiz and returns acceptance. Manual, AI-draft, and material-review save paths retain their editable or reviewed draft and release their submit claim after rejection. Focused regression coverage and full validation passed **148 Vitest files / 409 tests**, TypeScript, the credential-literal scan, and the production build; real keyboard, touch, screen-reader, timezone, and multi-device acceptance remain manual boundaries.

### Verified P1 repair — canonical study-material write integrity

Completed uploads were recorded without a schema-aligned client guard, and the UI cleared its upload state after any server upload response even if the canonical workspace record was missing, duplicate, malformed, stale-topic-linked, or beyond the material collection limit. Shared material validation now normalizes bounded upload metadata; StoreContext re-resolves a linked topic’s subject, rejects duplicate storage keys and the 501st material, and reports acceptance. The upload form resets only after the canonical write succeeds, preserving completed upload details after rejection. Focused regression coverage and full validation passed **150 Vitest files / 413 tests**, TypeScript, the credential-literal scan, and the production build; real storage-provider, keyboard, touch, screen-reader, timezone, and multi-device acceptance remain manual boundaries.

### Verified P1 repair — canonical Focus-session evidence integrity

Focus completion accepted malformed session values, could create evidence for a removed topic, and reported a completed session even when a future canonical guard would fail. Shared Focus validation now enforces bounded local-date, duration, subject, and objective inputs; StoreContext rejects the 5,001st session against an exported schema limit and returns acceptance. A removed selected topic is deliberately omitted from the recorded session and produces no evidence, while a current topic supplies its canonical subject. The timer now reports a recording failure truthfully while still beginning the learner’s break. Focused regression coverage and full validation passed **153 Vitest files / 419 tests**, TypeScript, the credential-literal scan, and the production build; real keyboard, touch, screen-reader, timezone, and multi-device acceptance remain manual boundaries.

### Verified P1 repair — canonical goal-update integrity

Goal reopening and progress actions could mutate a missing or malformed record without validation, and repeated decrement activation could underflow progress below the schema’s zero minimum. Goal updates now resolve the current canonical target, validate a complete proposed bounded goal before applying an editable patch, and report rejection for a removed target. Progress changes reject non-finite deltas and clamp both decrements and increments to the inclusive zero-to-target range, protecting later cloud synchronization. Focused regression coverage and full validation passed **155 Vitest files / 422 tests**, TypeScript, the credential-literal scan, and the production build; real keyboard, touch, screen-reader, timezone, and multi-device acceptance remain manual boundaries.

### Verified P1 repair — canonical note-write integrity

Note creation and editing accepted unchecked fields and could retain a stale topic identifier or exceed the workspace collection limit, while the editor closed immediately after dispatch. Shared note validation now normalizes and bounds title, subject, and content; StoreContext rejects the 2,001st note, resolves current topic subjects, and rejects a removed topic target before mutation. Note creation and editing return acceptance, and the editor keeps its draft visible and editable after a rejected write. Focused regression coverage and full validation passed **157 Vitest files / 426 tests**, TypeScript, the credential-literal scan, and the production build; real keyboard, touch, screen-reader, timezone, and multi-device acceptance remain manual boundaries.

### Verified P1 repair — canonical task-write integrity

Task creation and editing previously accepted impossible calendar dates, unbounded optional task fields, stale topic links, and collection overflow; the TaskDialog also left its save claim set when a canonical write was rejected, preventing retry without reopening. Shared task validation now uses the local calendar contract for due and deferred dates and mirrors remaining workspace bounds, while StoreContext rejects stale links and the 2,001st task and returns acceptance. Tasks and Quick Add now preserve rejected input and release retry claims. Focused regression coverage and full validation passed **158 Vitest files / 428 tests**, TypeScript, the credential-literal scan, and the production build; real keyboard, touch, screen-reader, timezone, and multi-device acceptance remain manual boundaries.

### Verified P1 repair — actionable upcoming task recommendations

The command-center ranking previously included only due, overdue, or partially started tasks, so an assignment due tomorrow could disappear even when it was the most useful next action. The canonical ranking now uses the caller-supplied learner-local planning date, preserves overdue and partial priority, includes tasks due within seven days, and explains whether work is due tomorrow or later in the week. Added focused coverage for supplied-date behavior and tomorrow deadlines; focused validation passed **1 Vitest file / 19 tests**, and TypeScript passed. Full project validation and checkpointing remain pending for this increment; real timezone and device behavior remain manual boundaries.

Validation follow-up for the actionable upcoming-task recommendation repair passed **158 Vitest files / 429 tests**, TypeScript, the credential-literal scan, and the production build. The earlier focused-only note is superseded by this full result; real timezone and device behavior remain manual boundaries.

### Verified P1 repair — canonical habit and simulated-friend creation integrity

Habit and simulated-friend creation accepted unbounded strings and could retain non-finite friend scores before cloud schema validation. StoreContext now normalizes bounded names and icons, rejects malformed values and schema overflow before mutation, and returns acceptance for both actions. Simulated friend data remains explicitly local and simulated; no real social-account behavior is implied. Focused regression coverage and full validation passed **159 Vitest files / 431 tests**, TypeScript, the credential-literal scan, and the production build; real device and multi-account interaction remain manual boundaries.

### Verified P1 repair — canonical habit-toggle integrity

Habit completion toggles previously accepted any ID and date, allowing a stale habit target or malformed calendar key to reach the canonical habit log. StoreContext now verifies that the habit still exists and validates the learner-local ISO date before mutation, returning rejection without changing the log. Focused regression coverage and full validation passed **159 Vitest files / 432 tests**, TypeScript, the credential-literal scan, and the production build; real timezone and device interaction remain manual boundaries.

### Verified P1 repair — habit-dialog rejected-save recovery

The habit dialog previously cleared and closed after dispatching canonical creation even when a guard rejected the draft. It now uses StoreContext’s accepted-write result, releases its duplicate-submit claim on rejection, and keeps the learner’s draft open for correction and retry. Focused regression coverage and full validation passed **159 Vitest files / 432 tests**, TypeScript, the credential-literal scan, and the production build; real keyboard, touch, screen-reader, and multi-device interaction remain manual boundaries.

### Verified P1 repair — canonical timetable event-write integrity

Timetable events previously relied on dialog constraints and overlap checks alone, allowing malformed event fields or a 1,001st event to enter the workspace before later cloud-schema rejection. Shared validation now normalizes bounded event fields, validates weekday, time range, and type, and StoreContext enforces the exported 1,000-event schema limit before the existing overlap guard. Edits retain their immutable ID while validating the complete proposed event. Focused regression coverage and full validation passed **160 Vitest files / 434 tests**, TypeScript, the credential-literal scan, and the production build; real keyboard, touch, screen-reader, timezone, and multi-device acceptance remain manual boundaries.

### Verified P1 repair — canonical timer-preference integrity

Timer preference updates previously wrote unvalidated values directly to the canonical workspace, allowing malformed durations or oversized preset labels to become later schema failures. StoreContext now rejects non-integer, out-of-range, or empty/overflow preference values before mutation and reports accepted writes to callers. Focused regression coverage and full validation passed **161 Vitest files / 435 tests**, TypeScript, the credential-literal scan, and the production build; real timer interaction, device, and multi-device acceptance remain manual boundaries.

### Verified P1 repair — canonical currency-setting integrity

Currency preference updates previously trusted the compile-time union and wrote any runtime string to the canonical workspace. StoreContext now rejects values outside the workspace schema’s currency enum before mutation and reports acceptance to callers. Focused regression coverage and full validation passed **162 Vitest files / 436 tests**, TypeScript, the credential-literal scan, and the production build; real locale, device, and multi-device acceptance remain manual boundaries.

### Verified P1 repair — canonical notification-preference integrity

Notification preference patches previously merged arbitrary runtime values directly into canonical settings, allowing invalid time strings, out-of-range daily caps, unsupported vibration patterns, and unknown keys to survive until a later cloud-schema failure. StoreContext now reconstructs settings exclusively from its known fields, validates every notification toggle and local time, enforces the daily cap of 1–6, validates default and category vibration patterns, and reports rejected writes without mutation. Focused regression coverage and full validation passed **163 Vitest files / 437 tests**, TypeScript, the credential-literal scan, and the production build; real browser notification delivery, sound/vibration behavior, keyboard, touch, timezone, and multi-device acceptance remain manual boundaries.

### Verified P1 repair — Today task-to-Focus handoff integrity

Today’s “Focus on this” action previously opened the Focus page without the recommended task’s canonical identity, requiring the learner to reselect the task and risking unlinked time evidence. The command-center route now carries only the encoded task ID; Focus resolves it against current incomplete canonical tasks and preselects the task, subject, topic, and objective once. Removed or completed route targets are safely ignored. Focused regression coverage and full validation passed **164 Vitest files / 438 tests**, TypeScript, the credential-literal scan, and the production build; real keyboard, touch, mobile route navigation, timezone, and multi-device acceptance remain manual boundaries.

### Verified P1 repair — canonical task-deferral calendar integrity

The canonical task deferral action previously used a shape-only date expression, so impossible local dates could pass the guard and reach workspace state. It now reuses the shared strict local ISO-date validator before comparing the deferral date to the learner’s local current day. Focused regression coverage includes non-leap and leap-year boundaries; full validation passed **165 Vitest files / 439 tests**, TypeScript, the credential-literal scan, and the production build. Real timezone, device, and multi-device behavior remain manual boundaries.

### Verified P1 repair — canonical task-work integrity

Task-work logging previously delegated any runtime number to a helper that rounds values; `NaN` or another non-finite value could therefore become invalid canonical time or progress evidence. StoreContext now rejects non-finite work-minute or explicit-progress values before mutation and reports acceptance to callers, while retaining the helper’s existing bounded valid-input behavior. Focused regression coverage and full validation passed **166 Vitest files / 440 tests**, TypeScript, the credential-literal scan, and the production build. Real keyboard, touch, timezone, and multi-device acceptance remain manual boundaries.

### Verified P1 repair — canonical study-session lifecycle integrity

Study-session transitions previously trusted compile-time values: non-finite actual durations could reach completion, unsupported reflection or skip values could be stored, and rescheduling accepted rollover dates and invalid clock times. StoreContext now returns accepted-write status for lifecycle transitions, rejects malformed completion and skip values, and applies strict local-date and clock validation plus a string reason guard before rescheduling. Focused regression coverage and full validation passed **167 Vitest files / 441 tests**, TypeScript, the credential-literal scan, and the production build. Real keyboard, touch, timezone, and multi-device acceptance remain manual boundaries.

### Verified P1 repair — canonical core-settings integrity

The master-notification and theme setters previously trusted compile-time types and wrote arbitrary runtime values directly to canonical settings. StoreContext now rejects non-boolean reminder state and themes outside `light`, `dark`, or `system`, notifies the learner of rejected input, and reports accepted writes to callers. Focused regression coverage and full validation passed **168 Vitest files / 442 tests**, TypeScript, the credential-literal scan, and the production build. Real browser notification delivery, appearance behavior, keyboard, touch, timezone, and multi-device acceptance remain manual boundaries.

### Verified P1 repair — canonical study-session create and edit integrity

Study-session create and edit actions previously performed overlap checks but could still write malformed fields, removed topic IDs, over-capacity collections, or status changes that bypassed lifecycle controls. A shared session-draft normalizer now enforces schema-aligned text, local-date, local-time, duration, priority, difficulty, and status constraints; creates reject the 5,001st session; and both actions re-resolve linked topics. Edits retain immutable identity and reject status changes outside lifecycle actions. Full validation passed **169 Vitest files / 443 tests**, TypeScript, the credential-literal scan, and the production build. Real keyboard, touch, timezone, and multi-device acceptance remain manual boundaries.

The session-write contract was then narrowed to planning fields only. Manual create and edit paths now strip lifecycle, execution-timestamp, plan-link, evidence, and other internal fields rather than accepting them from arbitrary runtime objects; new manual sessions must be planned, while existing lifecycle state remains exclusively controlled by start, pause, resume, complete, skip, and reschedule actions. The same full validation result applies.

### Verified P1 repair — canonical study-plan creation integrity

Revision-plan creation previously trusted unbounded plan and item data. It now validates title, local date span, daily capacity, plan and item capacities, item time/duration/priority/status, and current topic and exam links before canonical mutation; accepted text is normalized. Full validation passed **170 Vitest files / 444 tests**, TypeScript, the credential-literal scan, and the production build. Real device, accessibility, timezone, and multi-device acceptance remain manual boundaries.

### Verified P1 repair — canonical study-plan item-status integrity

The internal plan-item status setter previously updated any matching object without checking that the plan and item still existed or that the runtime status was supported. It now requires a current plan and item and accepts only planned, completed, or skipped states before mutation. Focused regression coverage and full validation passed **171 Vitest files / 445 tests**, TypeScript, the credential-literal scan, and the production build. Real device, accessibility, timezone, and multi-device acceptance remain manual boundaries.

Plan-item activation now routes through the canonical study-session creation path rather than appending an unchecked session. This preserves current capacity, malformed-field, overlap, and stale-topic protections before an activation claim is recorded. The same full validation result applies.

### Verified P0 repair — account-switch workspace hydration isolation

When the authenticated account scope changed, the provider could retain the previous account’s state while the new query loaded; its local-first persistence effect could then write that stale workspace under the new account scope. StoreContext now invalidates in-flight sync generations, clears visible state, sets hydration back to loading, and blocks persistence until the matching account has hydrated. Focused regression coverage and full validation passed **172 Vitest files / 446 tests**, TypeScript, the credential-literal scan, and the production build. Real multi-account browser, offline, and multi-device acceptance remain manual boundaries.

### Verified P1 repair — material AI rate-limit parity

The material-summary and material-practice routes were protected and account-owned, but they omitted the shared durable learner AI throttle used by the other model surfaces. Both procedures now consume the `learning_draft` allowance using the authenticated `openId` before requesting summary or question generation. This preserves consent and review gates while preventing those provider-facing routes from bypassing account-scoped request budgets. Focused coverage and full validation passed **173 Vitest files / 447 tests**, TypeScript, the credential-literal scan, and the production build. Live provider, PDF parsing, and multi-device acceptance remain manual boundaries.

### Verified P1 repair — AI schedule application integrity

The reviewed AI schedule dialog previously invoked canonical session creation for every proposal but ignored each boolean result, then cleared the whole draft and announced that all sessions had been added. It now retains only rejected reviewed proposals, keeps their review acknowledgements, releases the duplicate-submit claim, and reports the exact accepted and remaining counts. Full validation passed **174 Vitest files / 448 tests**, TypeScript, the credential-literal scan, and the production build. Real provider, keyboard, touch, mobile, timezone, and multi-device acceptance remain manual boundaries.

### Verified P1 repair — canonical quiz-attempt acceptance integrity

The quiz runner previously displayed a completion result after calling the canonical attempt writer without knowing whether the selected quiz still existed. Canonical attempt recording now returns accepted status, rejects a removed quiz without evidence or XP mutation, and the runner releases its completion claim and gives an actionable recovery message instead of presenting a false result. Full validation passed **175 Vitest files / 449 tests**, TypeScript, the credential-literal scan, and the production build. Real keyboard, touch, device, timezone, and multi-device acceptance remain manual boundaries.

### Verified P1 repair — canonical learner-profile integrity

Profile patches previously merged arbitrary runtime fields into canonical workspace state, and onboarding marked a workspace complete before knowing whether the profile write had been accepted. StoreContext now normalizes bounded name, age, education, student type, goals, subjects, hours, and profile-photo reference fields before mutation. Onboarding requires accepted profile persistence before marking completion and retains input with a recovery message if it is rejected. Full validation passed **176 Vitest files / 451 tests**, TypeScript, the credential-literal scan, and the production build. Real keyboard, touch, device, timezone, and multi-device acceptance remain manual boundaries.

### Verified P1 repair — plan-item activation admission coverage

Plan-item activation continues to delegate to canonical `addSession`; its admission guard is now extracted into the single pure `admitPlannedStudySession` helper rather than duplicated in a planner path. Direct regressions prove that a removed linked topic returns `stale_topic` and a workspace at the exact **5,000-session** limit returns `capacity`, so neither case can yield an accepted activation payload or plan-item claim. A current linked topic remains admissible through the same guard before `addSession` applies the plan linkage. Focused coverage passed **2 files / 4 tests**; full validation passed **177 Vitest files / 453 tests**, TypeScript, the credential-literal scan, and the production build. Real keyboard, touch, device, timezone, and multi-device acceptance remain manual boundaries.

### Verified P1 repair — missed-plan recovery capacity integrity

The recovery planner marked missed items as skipped and appended rescheduled copies, but it did not reserve a slot within the canonical per-plan **2,000-item** workspace-schema maximum. A full plan could therefore create an over-limit local state that cloud validation would reject. The schema now exports one shared plan-item capacity constant; plan creation and deterministic recovery use it. Recovery accepts only the remaining slots and reports any unallocated missed work. A direct 1,999-completed-plus-1-missed-item regression proves that recovery adds no overflow item and reports the item as needing capacity. Focused coverage passed **2 files / 21 tests**; full validation passed **177 Vitest files / 454 tests**, TypeScript, the credential-literal scan, and the production build. Real keyboard, touch, device, timezone, and multi-device acceptance remain manual boundaries.

### Verified P0 repair — queued learner-profile preservation at onboarding completion

`Onboarding.finish()` correctly writes the profile before marking the workspace complete, but `markOnboarded` previously built its final profile from a render-time `stateRef` snapshot. React can apply the accepted profile mutation first, leaving the later completion mutation able to overwrite age, education, student type, goals, subjects, study hours, or photo metadata with defaults. Completion now validates a preview but derives its final normalized profile inside the functional updater from `prev.profile`. A pure regression proves the completion-name merge preserves every accepted profile field, and source coverage pins the functional updater use. Focused coverage passed **3 files / 3 tests**; full validation passed **178 Vitest files / 455 tests**, TypeScript, the credential-literal scan, and the production build. Real device, accessibility, timezone, and multi-device acceptance remain manual boundaries.

### Verified P1 repair — deterministic exam recommendation dates

`getRankedNextActions(state, today)` correctly accepted a learner-calendar reference date, but its exam recommendation branch called the runtime-clock `daysFromNow` helper. This could make the same supplied workspace and planning date produce different exam visibility or countdown text over time. The branch now calculates `daysBetween(today, exam.date)` like the other deterministic actions. A regression fixes an August 22 planning reference to the exact “Mock in 6 days” result for an August 28 exam. Focused coverage passed **2 files / 23 tests**; full validation passed **178 Vitest files / 456 tests**, TypeScript, the credential-literal scan, and the production build. Real device, accessibility, timezone, and multi-device acceptance remain manual boundaries.

### Verified P1 repair — canonical quiz-answer finite input integrity

Quiz attempt response construction rounded and clamped selected indices, but a runtime `NaN` answer survived JavaScript arithmetic as `NaN` and could enter the canonical attempt response, producing a workspace payload that schema validation would reject. A single `normalizeQuizAnswers` boundary now requires every current question to have an integer answer inside its option range before scoring or persistence. Missing, non-finite, fractional, and out-of-range indices reject without recording attempt, XP, or learning evidence. Focused coverage passed **3 files / 6 tests**; full validation passed **178 Vitest files / 457 tests**, TypeScript, the credential-literal scan, and the production build. Real keyboard, touch, device, timezone, and multi-device acceptance remain manual boundaries.

### Verified P1 repair — reviewed material-summary flashcard admission integrity

The reviewed summary-to-flashcard action trusted the transient draft and appended a deck without confirming its topic still existed or that the deck collection had capacity. It also marked the UI as saved even when a future canonical write could reject. A single pure admission boundary now validates title, subject, key ideas, current topic linkage, and the shared **500-deck** schema capacity; current-topic saves use the canonical subject. The UI marks saved only after acceptance and releases its claim while retaining the draft on rejection. Direct regressions cover accepted, stale-topic, malformed, and capacity cases. Focused coverage passed **3 files / 5 tests**; full validation passed **179 Vitest files / 459 tests**, TypeScript, the credential-literal scan, and the production build. Real keyboard, touch, device, timezone, and multi-device acceptance remain manual boundaries.

### Verified P1 delivery — protected trusted-assessment flow

Student OS now offers a separate timed-assessment path for an existing canonical quiz while retaining the local-first practice runner and its evidence model unchanged. The protected server derives the owner from `ctx.user.openId`, snapshots the signed-in learner’s current quiz questions into relational session/question rows, withholds answer keys until finalization, validates server-saved selected indices, and calculates final score solely from the immutable server snapshot. Unique owner/start and owner/submit keys provide retry-safe starts and idempotent finalization; the reviewed non-destructive migration was applied successfully. The UI labels a finalized result as distinct from local practice evidence. Focused coverage passed **2 files / 3 tests**; full validation passed **182 Vitest files / 463 tests**, TypeScript, the credential-literal scan, and the production build. Live session resume across a browser refresh, actual concurrent transaction races, and browser accessibility/device acceptance remain manual or follow-up boundaries.

### Verified P1 delivery — optional Ghana NaCCA catalogue provenance

Onboarding now offers an optional **Ghana NaCCA secondary catalogue** selection only for the Secondary education level. The narrow versioned seed uses titles published on NaCCA’s Secondary Education Curriculum page, including Mathematics, Biology, Chemistry, Computing, Physics, and Robotics.[1] When a learner selects it, Student OS persists cited country/system/catalogue context and per-subject provenance. Exact matching seed subjects receive `catalogue` provenance; every unmatched or learner-added label remains explicitly `custom`, never falsely official. The strict workspace schema and canonical profile normalizer accept only bounded HTTPS context and current-subject-only provenance, so older profiles remain valid while malformed or detached metadata is rejected. Focused coverage passed **3 files / 4 tests**; full validation passed **184 Vitest files / 466 tests**, TypeScript, the credential-literal scan, and the production build. Catalogue coverage is intentionally narrow, and live curriculum accuracy/revision monitoring remains a manual governance boundary.

## References

[1] [National Council for Curriculum and Assessment, _Secondary Education Curriculum_](https://nacca.gov.gh/secondary-education-curriculum/)

### Verified P1 delivery — server-finalized assessment grade semantics

Trusted assessment results previously returned a protected immutable-snapshot score but omitted the directive’s explicit grade and performance semantics. The server now maps only validated integer scores from 0 through 100 to the specified A+/A through F bands and descriptors, including the distinct 40, 30, 20, 10, and 0-point F ranges. The timed-assessment result renders that server response and does not calculate a grade in the browser. Focused coverage passed **2 files / 4 tests**; full validation passed **184 Vitest files / 467 tests**, TypeScript, the credential-literal scan, and the production build. Live browser/session resume and device accessibility remain manual boundaries.

### Verified P1 delivery — trusted-assessment refresh recovery

The protected assessment service already persisted immutable snapshots and answer selections, but the browser did not retain the opaque session reference. A refresh could therefore strand an in-progress timed assessment. The runner now stores only the quiz-namespaced session ID in session storage and uses the protected owner-scoped read route to restore learner-safe questions, saved responses, finalized result, and server grade. It clears an unavailable reference with truthful recovery guidance and never converts the separate local practice runner into a server-authoritative path. Focused coverage passed **3 files / 5 tests**; full validation passed **185 Vitest files / 468 tests**, TypeScript, the credential-literal scan, and the production build. Physical browser-refresh and device accessibility acceptance remain manual boundaries.
