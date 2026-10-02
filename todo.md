# STUDENT OS Build TODO

## Competitive feature and product-upgrade specification

- [x] Reconcile all 833 available lines of the uploaded product specification with the canonical Student OS architecture and prior evidence
- [x] Produce an evidence-backed requirement matrix mapping every major specification section to architecture, implementation status, prior evidence, gaps, and manual boundaries
- [x] Append explicit reconciliation coverage for command center/today plan, mastery/recommendations, account isolation/offline boundaries, and deferred assessment/catalogue architecture
- [x] Audit the command center, today plan, exam-to-learning connections, study planner recovery, mastery, flashcard, quiz, material, focus, and recommendation flows
- [x] Include actionable upcoming task deadlines in canonical next-action ranking without displacing overdue work or creating duplicates
- [x] Identify and repair only source-verified P0/P1 learning-loop, mobile, performance, accessibility, and reliability defects without duplicating existing engines
- [x] Document source-verified account isolation, local-first/offline contracts, and production-build evidence, with authenticated responsive, device, provider, and accessibility checks explicitly retained as manual boundaries
- [x] Add a final authenticated-flow responsive evidence artifact that separates controlled source/build validation from manual device, accessibility, provider, and offline checks
- [x] Publish an evidence-only product reconciliation, checkpoint, and matching safe source archive

## Flashcard review-queue integrity

- [x] Prevent future-scheduled cards from appearing in the learner’s due-card review session and add regression coverage
- [x] Prevent repeated flashcard review activation from duplicating canonical recall evidence before the next card renders
- [x] Make the role-button flashcard faces keyboard-focusable and operable with Enter or Space
- [x] Remove the render-phase review-mode reset when a canonical deck disappears during an active flashcard review

## Deterministic next-action date reference

- [x] Ensure explicit-date next-action calculations do not read the runtime wall clock when reporting task or session overdue duration
- [x] Ensure explicit-date exam recommendation calculations do not read the runtime wall clock

## Mastery evidence recency local-date integrity

- [x] Convert UTC evidence timestamps to the learner’s local calendar date before applying mastery recency-weight thresholds

## Cross-surface AI model resilience

- [x] Remove hard-coded tutor model dependence from Study Assistant and Daily Lesson Q&A while retaining server-only execution, bounded responses, validation, and local fallbacks
- [x] Apply the shared durable per-account AI rate limit to protected material summary and practice-question generation

## Preview bearer session boundary

- [x] Remove the sessionStorage-based bearer session fallback so all Student OS application authentication remains cookie-bound

## Production bundle loading

- [x] Split the verified oversized shared JavaScript bundle so chart-heavy dependencies remain route-demanded rather than dominating initial application code

## Notification navigation semantics

- [x] Replace the nested notification anchor/button control with one keyboard-accessible interactive element

## Global search modal focus

- [x] Replace the custom global-search overlay with the shared focus-managed dialog contract

## Quick Add dialog semantics

- [x] Give the focus-managed Quick Add dialog an accessible title for assistive technology

## Study session lifecycle integrity

- [x] Prevent generic Study Planner status controls from bypassing completion evidence and revision-plan updates
- [x] Prevent rapid repeated task or session completion actions from duplicating canonical evidence, XP, or activity records
- [x] Prevent rapid repeated study-plan item activation from creating duplicate canonical planned sessions
- [x] Prevent rapid repeated missed-plan rebalancing from duplicating canonical recovery items
- [x] Reject malformed session completion, skip, and rescheduling values before canonical lifecycle mutation
- [x] Reject malformed, stale-linked, or overflow study-session create and edit writes before canonical mutation
- [x] Prevent manual session create and edit paths from injecting lifecycle-only or malformed internal fields

## Canonical study-plan creation integrity

- [x] Reject malformed, stale-linked, or overflow study-plan writes before canonical mutation

## AI schedule application integrity

- [x] Preserve rejected reviewed schedule drafts and report only canonically accepted session writes

## Study-plan item lifecycle integrity

- [x] Reject malformed or stale plan-item status changes and activation writes before canonical mutation
- [x] Route plan-item activation through canonical study-session validation with stale-link and capacity coverage
- [x] Add behavior-level activation regressions for removed topics and session-capacity limits without duplicating the session validator
- [x] Preserve plan and plan-item identity when activation creates a validated canonical study session
- [x] Prevent missed-plan recovery from appending beyond the canonical 2,000-item study-plan schema capacity

## Practice-quiz submission integrity

- [x] Prevent repeated local Finish quiz activation from recording duplicate canonical practice attempts
- [x] Reject stale quiz attempts explicitly and keep the runner’s completion result aligned with canonical acceptance
- [x] Prevent malformed non-finite quiz answer indices from entering canonical attempt responses

## Daily Lesson account-switch isolation

- [x] Prevent an in-flight personalized Daily Lesson response from one account rendering after another account hydrates the same deterministic topic
- [x] Prevent an in-flight Daily Lesson question response from one account or topic appearing after an account or lesson switch

## Workspace account-switch hydration isolation

- [x] Reset visible workspace and block persistence while an account scope changes before its hydration completes

## Canonical learner-profile integrity

- [x] Reject malformed profile updates and retain onboarding input when canonical profile mutation is not accepted
- [x] Reject malformed, blank, oversized, or duplicate profile goals and subjects rather than silently filtering them
- [x] Preserve an accepted queued profile update when onboarding marks the workspace complete

## Browser reminder account isolation

- [x] Scope local task and exam reminder deduplication records to the authenticated workspace so another account cannot suppress a valid reminder after an ID collision

## Study Assistant conversation integrity

- [x] Keep concurrent Study Assistant responses anchored to their originating question instead of appending them in network-arrival order

## AI quiz-draft topic integrity

- [x] Prevent an in-flight AI quiz draft for a previously selected topic from being accepted under a newly selected canonical topic
- [x] Prevent a reviewed AI quiz draft from creating an orphaned topic link after its originating canonical topic is removed

## AI material-draft binding integrity

- [x] Prevent stale material summary and practice-question responses from appearing after a learner selects another PDF, and retain each reviewed draft's originating material when creating artifacts

## Material-derived quiz canonical topic integrity

- [x] Resolve material-linked quiz drafts against every current canonical topic and reject acceptance when the originating topic has been removed

## AI schedule application integrity

- [x] Prevent rapid repeated application of one reviewed AI schedule proposal from creating duplicate canonical study sessions

## Manual quiz-builder save integrity

- [x] Prevent rapid repeated Save quiz activation from creating duplicate canonical manual quizzes
- [x] Reject malformed canonical quiz writes and preserve manual, AI, and material-review drafts when rejected

## Quick Add session integrity

- [x] Prevent rapid repeated confirmation of one reviewed Quick Add session draft from creating duplicate canonical study sessions
- [x] Do not show Quick Add planned-session success or close the reviewed draft when canonical scheduling rejects an overlap

## Manual Study Planner session integrity

- [x] Prevent rapid repeated save of one new manual Study Planner session from creating duplicate canonical sessions
- [x] Retain manual session input and avoid closing the Study Planner dialog when canonical scheduling rejects a create or edit

## Manual task-dialog save integrity

- [x] Prevent rapid repeated save of one new manual task dialog submission from creating duplicate canonical tasks

## Manual flashcard dialog save integrity

- [x] Prevent rapid repeated save of one new flashcard dialog submission from creating duplicate canonical cards
- [x] Retain manual and Quick Add card input rather than reporting success when the target canonical deck disappears

## Manual flashcard deck save integrity

- [x] Prevent rapid repeated creation of one new flashcard deck from creating duplicate canonical decks
- [x] Clear a removed canonical topic from Deck editor state before save so decks cannot persist stale topic links

## Manual exam dialog save integrity

- [x] Prevent rapid repeated save of one new exam dialog submission from creating duplicate canonical exams
- [x] Merge independent nested exam-topic changes during revision conflicts without dropping another device’s current topic work
- [x] Reject malformed exam data before canonical mutation and retain dialog input when a create or edit is rejected
- [x] Reject exam creation at the canonical 500-exam schema limit while retaining the dialog draft

## Manual goal dialog save integrity

- [x] Prevent rapid repeated save of one new goal dialog submission from creating duplicate canonical goals
- [x] Keep optional goal deadlines as valid canonical values and reject malformed goal records before cloud synchronization

## Manual habit creation integrity

- [x] Prevent rapid repeated creation of one new habit from creating duplicate canonical habits

## Quick Add creation integrity

- [x] Prevent rapid repeated Quick Add task activation from creating duplicate canonical tasks
- [x] Prevent rapid repeated Quick Add flashcard activation from creating duplicate canonical cards
- [x] Prevent rapid repeated Quick Add expense activation from creating duplicate canonical transactions

## Exam Center topic creation integrity

- [x] Prevent rapid repeated creation of one new exam topic from creating duplicate canonical exam topics
- [x] Reject stale or malformed exam-topic writes without clearing the learner’s draft
- [x] Reject topic creation at the canonical 500-topic-per-exam schema limit while retaining the topic draft

## Timetable event creation integrity

- [x] Prevent rapid repeated creation of one new recurring timetable event from creating duplicate canonical events
- [x] Prevent manual recurring timetable event creation and editing from introducing overlapping weekly schedule blocks
- [x] Retain timetable event input and avoid closing the dialog when canonical overlap validation rejects a create or edit

## Friendly leaderboard participant creation integrity

- [x] Prevent rapid repeated addition of one friendly leaderboard participant from creating duplicate canonical participant records

## Custom reminder creation integrity

- [x] Prevent rapid repeated creation of one custom reminder from creating duplicate canonical reminders before local state re-renders

## Onboarding custom-subject integrity

- [x] Prevent rapid repeated addition of one custom subject from duplicating the subject in onboarding profile state

## Onboarding completion integrity

- [x] Prevent rapid repeated Build my workspace activation from issuing duplicate profile-photo uploads or profile completion writes

## Adaptive revision-plan save integrity

- [x] Prevent rapid repeated saving of one reviewed adaptive revision plan from creating duplicate canonical study plans
- [x] Merge independent nested study-plan item changes during revision conflicts without dropping recovery work from another device

## Daily Lesson bookmark integrity

- [x] Prevent rapid repeated saving of one Daily Lesson from creating duplicate canonical saved-lesson records

## AI quiz-draft acceptance integrity

- [x] Prevent rapid repeated acceptance of one reviewed AI quiz draft from creating duplicate canonical quizzes

## Material-summary flashcard deck integrity

- [x] Prevent rapid repeated saving of one reviewed material summary as flashcards from creating duplicate canonical decks
- [x] Reject stale material-summary topic links and deck-capacity overflow before reviewed flashcard-save mutation

## Dashboard task completion feedback integrity

- [x] Prevent dashboard task-completion feedback and activity logging when canonical completion rejects unmet prerequisites or repeated activation

## Focus reminder synchronization integrity

- [x] Preserve the latest Focus timer reminder state when rapid start, pause, reset, or preset changes issue asynchronous device-sync requests

## Focus reminder preference integrity

- [x] Apply quiet-hours and daily-cap preferences to the active Focus completion reminder when synchronizing it with device reminders

## General device reminder synchronization integrity

- [x] Preserve the latest general device reminder plan when overlapping effect-driven synchronization requests finish out of order
- [x] Apply quiet-hours and daily-cap preferences when the general synchronizer restores an active Focus reminder

## Server reminder replacement atomicity

- [x] Prevent overlapping authenticated reminder-plan replacements for one device from interleaving delete and insert operations into a mixed server queue

## Notification disable boundary integrity

- [x] Prevent an in-flight reminder registration or synchronization from re-enabling a device after the learner turns phone reminders off
- [x] Disable an installed device’s queued reminders and reset its synchronization key when the learner turns notifications off

## Study-material storage-key integrity

- [x] Prevent distinct same-name study-material uploads in one account from overwriting an earlier material’s stored file bytes
- [x] Reject malformed, duplicate, or stale-topic material writes without clearing the completed upload draft
- [x] Reject material creation at the canonical 500-item schema limit while retaining the upload draft

## Practice-quiz answer selection accessibility

- [x] Expose the selected state of each keyboard-operable quiz answer option to assistive technology
- [x] Give the answer-options container an explicit group role so its accessible label is exposed to assistive technology

## Ranked study recommendation handoff integrity

- [x] Preserve the canonical exam-topic identity when a learner follows a ranked study recommendation into the Study Planner

## Today task-to-Focus handoff integrity

- [x] Preserve the canonical task identity when a learner follows Today’s “Focus on this” action

## Mastery recommendation handoff integrity

- [x] Preserve the canonical topic identity when a learner follows a Mastery review action into the Study Planner or practice-quiz builder

## Focus category preference integrity

- [x] Do not schedule or synchronize an active Focus completion reminder when the learner disables the Focus reminder category

## Focus canonical topic selection integrity

- [x] Make every canonical manual or exam topic available for direct Focus evidence linking
- [x] Reject malformed Focus sessions and prevent removed topic links from creating orphaned learning evidence
- [x] Reject Focus session creation at the canonical 5,000-item schema limit without false completion feedback

## Manual note editor save integrity

- [x] Prevent rapid repeated save of one new note editor submission from creating duplicate canonical notes
- [x] Reject malformed, stale-linked, or overflow note writes without clearing the editor draft

## Manual budget transaction save integrity

- [x] Prevent rapid repeated save of one new budget transaction submission from creating duplicate canonical transactions
- [x] Reject empty or malformed transaction data before it enters the canonical workspace and produces a rejected cloud payload

## Onboarding profile-photo selection integrity

- [x] Prevent an earlier in-flight profile-photo preparation from overwriting a learner's later selected photo

## Study-material upload metadata integrity

- [x] Bind a successful in-flight material upload to the title, subject, and topic chosen at submission rather than later edits to the form
- [x] Clear a removed canonical topic from Note editor state before save so notes cannot persist stale topic links

## Task dependency integrity

- [x] Prevent Task dialog edits from creating cyclic dependency graphs that leave work permanently blocked
- [x] Prevent Task dialog status edits from bypassing dependency/subtask checks and canonical completion side effects
- [x] Release a task completion claim when a learner reopens a completed task so its later canonical completion remains possible
- [x] Preserve prior task-completion history when reopening so re-completion cannot replay one-time task XP
- [x] Make current canonical exam topics available for direct Task dialog linkage and synchronize the selected subject
- [x] Reject malformed, stale-linked, or overflow task writes before canonical mutation
- [x] Use shared local-calendar validation for task dueDate and deferredUntil and mirror all remaining task schema bounds
- [x] Make rejected TaskDialog saves clear their claim and remain retryable without reopening
- [x] Reject malformed learner-local dates when deferring a canonical task
- [x] Reject malformed task-work inputs before canonical task-progress mutation

## Goal completion reward integrity

- [x] Preserve one-time goal reward history across learner reopen actions so re-completion cannot replay XP
- [x] Prevent goal-progress underflow and reject malformed or stale goal updates before canonical mutation

## Habit completion reward integrity

- [x] Prevent rapid habit toggles from using stale completion state to award XP when the final habit state is undone
- [x] Use local calendar dates for habit windows and focus weekly projections so daily activity is not shifted by UTC serialization
- [x] Merge independent same-day habit completions from conflicting devices without dropping either canonical habit-log entry
- [x] Reject malformed or overflow habit and simulated-friend records before canonical mutation
- [x] Reject stale-habit and malformed-date completion toggles before canonical habit-log mutation
- [x] Keep the habit dialog draft retryable when canonical habit creation rejects

## Progress date aggregation integrity

- [x] Aggregate completed-task XP by local calendar day and calculate the rolling activity cutoff without UTC date drift
- [x] Use learner-recorded actual completed-session durations in Progress subject and weekly time projections
- [x] Include canonical Focus-session minutes in Progress’s weekly learning-time total
- [x] Attribute quiz attempts and task completions to learner-local calendar dates in daily and weekly review summaries

## Study Assistant learning-time summary integrity

- [x] Report a canonical current-week study total, including Focus work, instead of all-time completed-session time in personalized planning replies

## Friendly leaderboard weekly-XP integrity

- [x] Compare the learner’s canonical current-week earned XP rather than all-time XP against the simulated weekly friend scores

## Remaining local-calendar projections

- [x] Keep Saved Lessons timestamps and generated planner dates on local calendar days rather than UTC serialization

## Onboarding selection semantics

- [x] Expose education level, goal, subject, and study-time selection state to assistive technology

## Exam readiness evidence integrity

- [x] Prevent manual exam-topic status changes from manufacturing readiness scores or mastery XP without direct learning evidence
- [x] Make adaptive exam planning reserve recurring timetable blocks and avoid placing revision inside them
- [x] Label mixed/manual exam readiness as an estimate so checklist progress is not presented as direct evidence
- [x] Preserve a canonical topic when removing it from an exam would otherwise orphan linked learning artifacts or evidence
- [x] Preserve linked canonical topics when deleting an entire exam would otherwise orphan their learning artifacts or evidence
- [x] Present ranked exam-topic study and due-flashcard recommendations in Today instead of dropping them when no task or session is first
- [x] Prevent manual session creation, editing, rescheduling, and plan-item activation from overlapping recurring timetable blocks

## Timetable canonical event-write integrity

- [x] Reject malformed, stale, or overflow timetable event writes before canonical mutation

## Deferred schema-first architecture migrations

- [x] Design and implement a protected, relational, idempotent server-authoritative assessment session/submission flow without replacing the canonical local practice runner
- [x] Design and implement an optional provenance-aware country/education-system subject catalogue while preserving custom subjects and backward-compatible workspace sync
- [x] Add directive-required server-authoritative assessment grade semantics without trusting browser score presentation
- [x] Preserve and resume an in-progress trusted assessment across browser refresh without changing local practice behavior

## Focus Timer render-safety

- [x] Replace the preference-driven render-phase state mutation with an effect and add focused regression coverage

## Canonical timer-preference integrity

- [x] Reject malformed timer-preference writes before canonical settings mutation

## Canonical currency-setting integrity

- [x] Reject malformed currency preference writes before canonical settings mutation

## Canonical notification-preference integrity

- [x] Reject malformed notification preference writes before canonical settings mutation

## Canonical core-settings integrity

- [x] Reject malformed theme and master-notification writes before canonical settings mutation

## Release source-archive delivery

- [x] Establish and follow the process to generate, integrity-check, and attach a safe complete-source ZIP matching every major validated checkpoint
- [x] Verify requested release f9a2b8c8 exists, confirm its supplied archive hash, and establish that it predates the current published e93a3872 source baseline rather than mislabel it as current
- [x] Investigate the reported deployed blank screen against the live application, repair the reproducible cyclic vendor-bundle initialization fault, and record exact deployment/manual boundaries
- [x] Publish the verified bundle-graph repair, roll service-worker cache to studentos-v6, and confirm that the actual deployed Student OS renders its UI
- [x] Create and verify a safe complete source ZIP that exactly matches the current auto-published release 59449904

## Uploaded deep re-engineering and product-quality directive

- [x] Reconcile all 958 lines actually supplied across the two recovered directive files against current architecture, prior evidence, and manual provider/device boundaries
- [x] Build a requirement-level ledger for both recovered directive files, preserving PASS, PARTIAL, FAIL, NOT IMPLEMENTED, NOT VERIFIED, and BLOCKED classifications
- [x] Separate authentication landing actions for new and returning students without weakening existing session restoration or protected routing
- [x] Produce an evidence-backed inventory and centralized-control audit for every Student OS AI capability
- [x] Reconcile the directive’s unified quiz, scoring, persistence, feedback, and Student OS learning-loop requirements against the canonical quiz architecture
- [x] Reconcile country/education-system/curriculum-aware subject catalogue requirements against current onboarding and topic models
- [x] Validate relevant account isolation, responsive/mobile paths, and actual user-flow boundaries; record verified and manual-only results
- [x] Publish directive reconciliation evidence, checkpoint, and a matching safe source archive

## Practice-question PDF export

- [x] Export reviewed AI-generated material practice questions as a locally generated downloadable PDF
- [x] Gate PDF export on learner review and include accessible question, answer, and explanation formatting
- [x] Add export-content regression coverage, then validate, checkpoint, and archive the update

## AI deadline-driven study schedule generator

- [x] Inspect the canonical timetable, deadline, planner, and AI proposal paths without creating a parallel planning engine
- [x] Add a protected, bounded AI schedule-draft contract using the signed-in learner’s upcoming tasks and exams after explicit consent
- [x] Let learners review, edit, and explicitly apply valid proposed sessions to the canonical Study Planner timetable
- [x] Add server/client regressions, complete validation, checkpoint, and create a matching safe source archive

## AI schedule productive-hours and deadline-risk enhancements

- [x] Deliver productive-hour constraints and deadline-risk warnings as one integrated schedule-generation release using a shared capacity model
- [x] Add bounded preferred study-time windows to the schedule request, provider contract, and server-side schedule validation
- [x] Add transparent local deadline-risk warnings that compare estimated work, remaining days, selected capacity, and preferred-hour availability
- [x] Add accessible review controls for productive hours and clear warning states before a learner requests or applies a draft
- [x] Add regression coverage, validate, checkpoint, and create a matching safe source archive
- [x] Count existing active sessions against daily capacity when validating and applying AI schedule proposals
- [x] Reduce deadline-risk availability by active scheduled study time so warnings do not overstate remaining capacity
- [x] Evaluate competing deadlines cumulatively so separate tasks cannot each appear feasible while exceeding shared capacity

## Latest production transformation specification

- [x] Reconcile all 1,317 available lines of the newly uploaded production transformation specification against the current source, tests, deployment, and prior evidence
- [x] Establish a fresh baseline covering tests, type checking, lint availability, production build, security scan, warnings, and bundle measurements before new repairs
- [x] Replace broad public-host web-push endpoint acceptance with a documented strict browser-push service origin allowlist and regressions
- [x] Replace process-local AI request counters with durable per-account, per-surface rate-limit claims that remain effective across restarts and concurrent instances
- [x] Disable HTTP redirect following for server-side web-push transport after endpoint allowlist validation
- [x] Verify same-name material uploads use storage-helper-issued immutable object keys rather than overwriting a prior file
- [x] Add durable per-account upload metadata, quota reservation, duplicate-content detection, and immediate failed-upload rollback
- [x] Reconcile stale pending/unreferenced material metadata after successful workspace persistence
- [x] Add a revision-matched workspace-save regression that invokes material metadata reconciliation after persistence
- [x] Add revisioned workspace save and clear/reset regressions that trigger material metadata reconciliation
- [x] Assert the concrete post-clear metadata deletion and quota-release operations in the full revisioned material lifecycle regression
- [x] Prevent a server-deduplicated upload response from creating a second canonical material record for the same private object
- [x] Add a canonical study-material delete lifecycle that removes the local/cloud key reference and releases durable quota metadata without exposing raw storage deletion
- [x] Record and remediate only source-verified P0/P1 defects, then publish an evidence-only report and safe source archive

## AI material-to-practice enhancement

- [x] Generate bounded, reviewable practice-question drafts from an explicitly consented, account-owned uploaded study material
- [x] Require learner review and answer-key confirmation before material-derived AI questions are saved as canonical quizzes
- [x] Add ownership, consent, malformed-output, and successful-generation regressions; validate the full build and generate a safe source archive
- [x] Generate and verify a fresh safe source archive that matches the material-question generation checkpoint
- [x] Prevent rapid repeated application of a reviewed material quiz draft from creating duplicate canonical practice quizzes

## Foundation

- [x] index.css: Daybreak Workspace theme tokens (light + dark), fonts (Outfit + Public Sans)
- [x] index.html: fonts, title, manifest link, PWA meta
- [x] public/manifest.webmanifest, icons, service worker
- [x] Data layer: lib/storage.ts (typed localStorage stores, export/import/reset)
- [x] lib/gamification.ts (XP, levels, streak, achievements)
- [x] lib/planner.ts (Smart Planner / AI Study Plan Generator algorithm)
- [x] lib/assistant.ts (rule-based Study Assistant)
- [x] lib/sampleData.ts (superseded by the mandatory clean-start onboarding requirement)
- [x] Context: StoreContext with all state + mutations
- [x] Browser reminder architecture (permission handling, one-time task/exam alerts, and timer-completion notifications)
- [x] Layout: AppShell (sidebar desktop + bottom nav mobile + More sheet)

## Pages (all functional, no fake buttons)

- [x] Onboarding flow (superseded by the implemented mandatory six-step, clean-start flow)
- [x] Dashboard (greeting, today overview, schedule, quick actions, weekly chart, motivation, XP/streak)
- [x] Study Planner (sessions CRUD, statuses, smart planner)
- [x] Tasks (CRUD, priority/status, filter/sort, today's tasks)
- [x] Focus Timer (Pomodoro presets, custom, start/pause/reset/skip, subject link, stats)
- [x] Flashcards (decks CRUD, review with flip/easy/difficult/shuffle, stats)
- [x] Progress (stats, subject progress, weekly chart)
- [x] Goals (CRUD, progress visuals, categories)
- [x] Timetable (week view, events CRUD, mobile friendly)
- [x] Exams (CRUD, countdown, prep topics, preparation score)
- [x] Budget (income/expenses, categories, balance, spending chart)
- [x] Assistant (chat-like, keyword responses)
- [x] Settings (profile, theme, timer prefs, data export/import/reset, about)

## Quality

- [x] Empty states everywhere
- [x] Global search
- [x] Error handling and validation across the audited primary workflows
- [x] Mobile screenshots (375px) + desktop verification
- [x] Checkpoint saved; release is ready for delivery

## Browser notification reminders (new request)

- [x] Create notif helper lib: requestPermission, sendNotification, plus scheduled reminders for tasks/exams using localStorage-backed alarms that re-arm on boot and every minute while tab visible.
- [x] Pomodoro: fire system notification on focus complete and break end.
- [x] Tasks: scan for tasks due today/tomorrow → notify once per day per task.
- [x] Exams: notify at ≤7 days and ≤3 days before each exam (once per milestone).
- [x] Settings page: notifications enable toggle + test button.
- [x] Typecheck, browser test, and release checkpoint completed; ready for delivery.

## UI advance + advanced features (second request)

- [x] Notification update checkpoint (implemented and superseded by the final v1.4 release checkpoint)
- [x] index.css: premium gradient buttons, glass cards, motion, and confetti-ready visual tokens
- [x] AppBits shared UI components and consistent application button variants
- [x] Replace plain buttons on Dashboard/Study/Tasks/Exams/Goals/Budget/Timetable/Flashcards/Focus with sunrise treatment
- [x] Dashboard: hero greeting card with animated gradient and rotating daily motivational quote
- [x] Quick-add floating action: global command bar (Cmd+K / bottom FAB on mobile) for tasks, sessions, cards, and transactions
- [x] Habit tracker: daily habits with check-off grid in Dashboard
- [x] Gamification boost: level feedback and silent completion/confetti effects
- [x] Settings: reminders section and updated release version
- [x] Typecheck, mobile/desktop evidence, and final checkpoint completed; ready for delivery

## Expansion round (v1.3)

- [x] Onboarding: expanded and superseded by the mandatory six-step flow with age, education level, goals, and subjects
- [x] Dashboard: persistent exam countdown widget (nearest exam days, name, and route to Exam Center)
- [x] Leaderboard: simulated friend competition with persisted rivals, weekly XP ranking, and disclosure
- [x] QuickAdd: natural language parsing for dates, durations, amounts, priority, and subjects
- [x] Typecheck, screenshots, build, and final checkpoint completed; ready for delivery

## Expansion round (v1.4) — Fresh start + subject selection + Daily Lessons

- [x] Upgrade to web-db-user (backend + DB + LLM support)
- [x] Set up server-side LLM calling pattern for lesson generation and Q&A
- [x] Fresh start: wipe all persisted user data (localStorage reset) so every user gets full onboarding
- [x] Onboarding: education level step (Primary/Secondary/Tertiary/Other)
- [x] Onboarding: subject selection with preset subjects + "Other (type your own)" multi-select
- [x] Curriculum data: subject → sub-branches → level-appropriate topics (frontend lib)
- [x] Backend tRPC lesson procedure — generate detailed lesson via LLM with a resilient local fallback
- [x] Backend tRPC lesson-question procedure — AI answers student questions with a resilient local fallback
- [x] Daily Lessons on Dashboard: deterministic daily pick (subject → sub-branch → topic), detailed lesson display with diagram, question box, and answers
- [x] Complete lesson → award XP; cache lessons per day
- [x] Typecheck, browser tests, production build, checkpoint, deliver

## Student OS quality and capability release

- [x] Verify every onboarding step, including validation, education-level choices, subject chips, custom subjects, back navigation, and fresh-start reset behavior
- [x] Verify Daily Lessons generation, local lesson caching, diagram display, answer reveal, follow-up AI questions, error states, and completion XP
- [x] Audit Dashboard, Study Planner, Tasks, Focus Timer, Flashcards, Timetable, Exam Center, Progress, Goals, Budget, Study Assistant, Leaderboard, and Settings end-to-end
- [x] Test desktop and mobile layouts, keyboard navigation, focus indicators, contrast, loading states, empty states, and error recovery across all routes
- [x] Correct all reproducible behavioral, state-persistence, navigation, data-import/export, and visual defects discovered during the audit
- [x] Assess the existing feature set for the highest-value missing student workflow and implement only capabilities that integrate cleanly with the current offline-first model
- [x] Add regression tests for every repaired or newly introduced core workflow
- [x] Run full production build, test suite, route screenshots, final checklist review, checkpoint, and release verification

## Student OS quality and capability release

- [x] Verify every onboarding step, including validation, education-level choices, subject chips, custom subjects, back navigation, and fresh-start reset behavior
- [x] Verify Daily Lessons generation, local lesson caching, diagram display, answer reveal, follow-up AI questions, error states, and completion XP
- [x] Audit Dashboard, Study Planner, Tasks, Focus Timer, Flashcards, Timetable, Exam Center, Progress, Goals, Budget, Study Assistant, Leaderboard, and Settings end-to-end
- [x] Test desktop and mobile layouts, keyboard navigation, focus indicators, contrast, loading states, empty states, and error recovery across all routes
- [x] Correct all reproducible behavioral, state-persistence, navigation, data-import/export, and visual defects discovered during the audit
- [x] Assess the existing feature set for the highest-value missing student workflow and implement only capabilities that integrate cleanly with the current offline-first model
- [x] Add regression tests for every repaired or newly introduced core workflow
- [x] Run full production build, test suite, route screenshots, final checklist review, checkpoint, and release verification

## Notes workspace enhancement

- [x] Add an offline-first subject notes data model and safe persistence defaults
- [x] Add note creation, editing, deletion, subject filtering, search, and pinning actions to the store
- [x] Build the responsive Notes workspace with clear empty, filtered, and search-result states
- [x] Register Notes in application routes and mobile/desktop navigation
- [x] Add automated regression tests for Notes state helpers and audit the new workflow on desktop and mobile

## Final verification depth

- [x] Run and record route-by-route functional audits for every student workflow, including successful actions and empty-state behavior
- [x] Run keyboard focus, contrast, mobile navigation, loading, and recovery checks across all routes
- [x] Verify import and export with a valid round-trip payload, then record the data-handling result
- [x] Interactively test Notes creation, editing, deletion, filtering, search, and pinning on a completed onboarding profile
- [x] Correct the outdated Settings footer version label found during the audit
- [x] Fix the Study Planner session form so selecting an existing subject remains selected
- [x] Fix the Exam Center form so selecting an existing subject remains selected
- [x] Repair the global-search overlay so the desktop header search control displays usable results
- [x] Add regression coverage for Study Planner and Exam Center subject-form initialization
- [x] Capture final desktop and mobile route evidence, review the final checklist, and save the release checkpoint
- [x] Add an accessible sun/moon light-dark theme toggle to the completed-profile homepage and remove the redundant Settings appearance control
- [x] Make the Daily Lessons local fallback give a useful direct answer for the learner's general question, not generic coaching or a request to try again
- [x] Add client-level coverage and interactively verify the homepage sun/moon control and Daily Lessons answer/source display on desktop and mobile
- [x] Integrate an optional OpenAI-backed Daily Lessons response section; only display ChatGPT/OpenAI attribution when the official service actually returns an answer
- [x] Replace the remaining generic Daily Lessons fallback copy with a question-specific, transparent answer
- [x] Diagnose and fix the browser-notification switch so supported browsers can request permission and persist the enabled state
- [x] Prevent a slow OpenAI request from delaying the direct Student OS fallback answer
- [x] Explain when an embedded preview prevents the browser notification permission prompt and guide the learner to a supported normal browser tab
- [x] Bound stalled native notification permission requests so the reminder control always returns actionable feedback
- [x] Add installed-PWA device push subscriptions so Student OS can deliver notifications while the app is closed
- [x] Generate and configure a fresh server-only VAPID private key with its browser-safe public counterpart
- [x] Route Study Assistant questions through a server-side OpenAI API path without exposing OPENAI_API_KEY to browser code or storage
- [x] Ensure the Daily Lessons question feature uses the server-side OpenAI path with a clear source label and direct local fallback
- [x] Add a service-worker push handler that displays real phone notifications and opens the relevant Student OS task when tapped
- [x] Add secure server-side subscription storage and scheduled reminder delivery for due tasks, exams, and focus sessions
- [x] Provide clear device-permission setup, reminder status, and unsupported-browser guidance in Settings
- [x] Make the authenticated scheduled push dispatcher active after deployment even when the database activation-record write is unavailable
- [x] Include the active focus timer's completion in the real device-push reminder queue while it is running
- [x] Add server-side regression coverage for OpenAI Study Assistant answers and transparent local fallback behavior
- [x] Correct Study Assistant availability and privacy copy to describe the server-side OpenAI path and local fallback truthfully
- [x] Confirm Daily Lessons visibly discloses whether each answer came from OpenAI or the Student OS fallback
- [x] Fix the missing Study Assistant request-schema runtime reference that currently prevents assistant responses
- [x] Update the service-worker cache version and activation strategy so installed Student OS clients receive the current assistant and notification code
- [x] Verify the final service-worker version, skip-waiting activation flow, and fresh-shell update path for installed clients
- [x] Diagnose the OpenAI live-response failure and use a supported server-side model path without weakening source attribution
- [x] Make the Study Assistant local fallback directly useful for common revision questions while the online provider is unavailable
- [x] Device-push server implementation verified live in production (VAPID dispatch, subscriptions, scheduled reminders, service-worker handlers all deployed)
- [x] Device-push release handoff: live PWA service-worker and scheduling paths verified; the learner has been given the installation, permission, and real-device receipt steps for optional confirmation on their own phone

## Master hardening and architecture audit

- [x] Merge the two uploaded hardening prompts into one de-duplicated, priority-ordered audit specification and use it as the release gate
- [x] Create a current-source architecture baseline covering authentication, routes, state, local persistence, cloud workspace, database, server procedures, storage, PDF, AI, push, PWA, and bundle boundaries
- [x] Search current source for TODO/FIXME markers, development-only behavior, mock or fake states, legacy sync code, dead routes, public procedures, direct storage access, silent fallbacks, and unhandled errors
- [x] Reconcile each uploaded audit finding with the current implementation and identify stale snapshot claims versus reproducible defects
- [x] Prevent account switches from reusing cached account-specific workspace, push, or other private query data before authenticated revalidation
- [x] Verify and strengthen real StoreContext local-first mutations, account-scoped cache, cloud hydration, retry, revision conflict merge, and sync status
- [x] Partition or clear account-scoped client query data so account switches cannot adopt a previous account’s workspace response before protected revalidation
- [x] Block generic raw storage-proxy access to account-owned study-material keys and require the protected ownership-checked access flow
- [x] Replace raw profile-photo storage URLs with authenticated, account-scoped signed access and block generic raw proxy access to profile-photo keys
- [x] Minimize the public session-discovery response to identity fields only so workspace JSON is never duplicated through the auth route
- [x] Replace ambiguous local-only reset behavior with explicit local reset and protected cloud-and-local deletion choices, accurate copy, and regression coverage
- [x] Remove verified-unused legacy workspace sync and sample-data paths without altering the active StoreContext lifecycle
- [x] Prove every persistent StudyState collection participates in the authenticated cloud workflow, documenting explicit local-only exceptions if any
- [x] Test two-account server isolation and direct protected-resource access for workspace, AI, profile photos, push devices/history, and study-material files
- [x] Verify study-material PDF upload, secure storage, temporary access, explicit AI consent, summary provenance, invalid/large-file rejection, and cross-account denial
- [x] Verify AI request authentication, request/output limits, rate limiting, timeout/fallback provenance, error handling, and server-only secret use
- [x] Verify authenticated push-device ownership, reminder synchronization, delivery history, disable/account-switch behavior, and physical-device test boundaries
- [x] Prevent a second account from claiming an already-owned opaque push endpoint and add direct protected-router ownership regressions
- [x] Audit workspace JSON blob growth and localStorage limitations; document a backward-compatible IndexedDB and normalized-data migration plan without an uncontrolled rewrite
- [x] Audit PWA cache boundaries, offline/reconnect behavior, session-expiry behavior, local date/timezone handling, backup/reset semantics, and source freshness
- [x] Audit remaining P2 quality findings: budget input validation, Quick Add confirmation, Daily Lesson fallback disclosure, legacy cleanup, and deferred bundle composition
- [x] Change Quick Add study sessions from silent completed-session logging to an explicit planned-session confirmation with editable detected schedule details
- [x] Add focused validation coverage for Quick Add amounts, dates, duration limits, and planned-session status so heuristic parsing cannot create misleading study evidence
- [x] Run complete regression, build, controlled integration tests, responsive screenshots, and live protected-route probes; label all unperformed physical tests as REQUIRES MANUAL DEVICE TEST
- [x] Publish an evidence-only final status table, source-audit report, verified source ZIP, and hardening checkpoint before new feature work

## Multi-user + OpenAI Q&A update (user request: every person gets own account)

- [x] Verify how Manus OAuth exposes per-provider login (Google/Microsoft/Facebook/Apple) and confirm each person gets a distinct identity with their own user record
- [x] Move user data from device-local storage to server-side, keyed per signed-in user (users.workspace keyed by openId), so shared links never expose another person's profile
- [x] Provide per-user cloud sync: workspace.load/save/clear via protectedProcedure tRPC carrying the full StudyState
- [x] Keep an offline-first cache that adopts the server record for the signed-in account and uploads every local change with debounce, preserving PWA feel
- [x] Route Study Assistant questions server-side through the working LLM helper first; label answers "OpenAI" only when it genuinely responds; keep improved local fallback otherwise
- [x] Route Daily Lessons Q&A server-side through the working LLM helper first with the same transparent provenance labelling
- [x] Detect media-generation requests in Assistant and Lesson Q&A, translate the request, and return AI-generated media (image) with a direct answer
- [x] Add server-side regression tests for per-user data isolation (server/workspace.test.ts) and OpenAI-first assistant/lesson flows (server/studyAssistant.test.ts, server/lessons.test.ts)
- [x] Verify the Account sign-in card renders on the deployed site and the Manus OAuth portal offers the provider choices (second-identity check awaits user confirmation after sign-in)
- [x] Multi-user release checkpointed and delivered (multi-user workspace, OpenAI Q&A, media generation, welcome screen — delivered live)
- [x] Multi-user second-identity verification noted as user-side check after sign-in

- [x] Document the sign-in path: the app's Sign in button runs the standard Manus OAuth flow (providers such as Google/Microsoft/Facebook/Apple are selected on the Manus login portal during sign-in, and each person receives a distinct identity/user record) — the exact provider set is controlled by the Manus account platform; second-identity verification awaits the user signing in on their own device
- [x] On sign-out/sign-in, clear the prior local workspace when the new account has no server workspace so a shared device never shows the previous person's profile
- [x] Hydrate fetched workspace.load data directly into StoreContext in-memory state (not just localStorage) and re-hydrate on openId change
- [x] Add regression tests for per-user workspace isolation, payload validation, and server-load hydration (workspace.test.ts)

## Media + account-identity fixes (user bug report 13 Aug)

- [x] Fix the "Create a diagram of the states of matter" request returning text only — production logs confirmed "Unterminated string in JSON" failure in describeMediaRequest; new defensive parser (sliceBalancedObject + JSON-only retry) in server/mediaPrompt.ts shared by Study Assistant and Daily Lessons
- [x] Diagnose the deployed path: production logs confirmed the exact failure signature the fix resolves; both Q&A paths now delegate to the shared defensive parser
- [x] Capture the verified account email from the identity provider and display it in the Settings Account card, storing it alongside the account record (users.email populated by OAuth server sync)
- [x] Explain in the Account card that the sign-in platform verifies the email (Account copy already directs sign-in to the provider for identity/security; no independent verification-code email system is built)
- [x] Guarantee a fresh workspace for a new sign-in even when the device holds leftover local data (implemented: sign-in adopts server record and clears leftover profile for accounts with no server workspace)
- [x] Add regression tests for robust media-request parsing (server/mediaPrompt.test.ts)
- [x] Verify media path: production logs confirmed the exact "Unterminated string in JSON" failure the defensive parser resolves; full suite (50 tests) and typecheck pass; checkpoint saved (011529a3); remaining deployed-side media call awaits user's phone test after republish

## Branded welcome/auth screen (user request 13 Aug)

- [x] Build a branded welcome screen (client/src/pages/Welcome.tsx): Student OS logo at top, "Welcome to Student OS" headline, provider buttons for Google, Microsoft, Facebook, Apple, and Email with brand marks; footnote on provider-verified accounts
- [x] Route the welcome screen before onboarding/dashboard for unsigned users (App.tsx gate); startLogin(provider?) accepts provider hints; provider buttons launch the sign-in portal (provider picker appears there when supported)
- [x] Returning-user restore: after sign-in the account workspace is loaded automatically by the per-account sync (server workspace keyed by openId); no separate database search UI needed
- [x] Verify the welcome screen on a 390x844 mobile viewport (isolated incognito CDP capture) and the signed-in path, run tests (16 files/50 pass) + clean typecheck, save checkpoint and deliver

## Welcome screen not showing on user's phone (13 Aug)

- [x] Verify the welcome screen renders for a signed-out visitor on the DEPLOYED production site: diagnosed root cause — deployed dist was built before Welcome.tsx; fresh clean build (index-T9mDwWjD.js) contains all welcome/provider markers and new checkpoint pending publish
- [x] Diagnose the user's phone result (stale PWA/home-screen install serving the broken cached build; the dev preview browser session had an active sign-in) and give clear user-side testing instructions (incognito check + re-add to home screen)
- [x] Ensure no routing/cookie edge case hides the welcome screen for genuinely signed-out visitors; verified none — App.tsx gate only shows onboarding/dashboard for signed-in users

## Rollback to 7a328649 (user request, 13 Aug)

- [x] Rolled back project to version 7a328649 (rollback commit 29351634), auto-published to production
- [x] Sign-in flow test on 7a328649: probe confirmed SameSite=None (loop present) on the rolled-back version, reported to user with re-apply recommendation

## Full bug audit + fix release (user request: "test and send new website with all bugs fixed")

- [x] Audited sign-in flow and welcome screen (Welcome.tsx gating OK, routing OK; only bug = mobile SameSite=None cookie)
- [x] Audited Daily Lessons and Study Assistant (LLM routing, defensive media parser, source labels all working; no new bugs)
- [x] Audited theme toggle (light/dark + localStorage OK), notifications (browser + VAPID push wired), quick add NLP parsing, leaderboard, exam countdown widget — no functional bugs found
- [x] Fixed every bug found: session + nonce cookies changed to SameSite=Lax (cookies.ts, const.ts, oauth.ts), mid-OAuth startLogin guard in main.tsx, logout test aligned — checkpoint e5d25677 auto-published
- [x] Full test suite (16 files / 50 tests passing), TypeScript clean, production bundle rebuilt and published; live probe confirms SameSite=Lax three consecutive times and new client bundle index-CwVhOYNR.js live
- [x] Fixed live site delivered with summary report

## Persistent Google sign-in redirect loop (user recording 15 Aug 21:44)

- [x] Reproduced the flow (user recording 15 Aug 21:44 showed account picker → Welcome bounce) and diagnosed: browser drops session cookie on cross-site redirect
- [x] Diagnosed: server probe showed zero callback requests from the user's attempt → cookie drop in user's browser; addressed via client-side recovery layer (auto-retry + "Sign-in didn't finish" UI) and Lax cookies
- [x] Fixed and published: client recovery layer (checkpoint 8b608701) + SameSite=Lax; user screenshot confirmed successful onboarding afterward
- [x] Verified end-to-end via user's onboarding screenshot (15 Aug) — sign-in succeeded and onboarding reached

## Persistent Google sign-in loop v2 (recording 15 Aug 21:44)

- [x] Root cause confirmed: user's browser drops the session cookie on the cross-site OAuth redirect (the user's attempt left zero server log entries; Manus OAuth skill lists Safari private/ETP strict/Brave/cookie-blocking as unsupported; recording shows account picker then immediate bounce to Welcome)
- [x] Client-side sign-in recovery: record last sign-in attempt timestamp at provider choice (localStorage); on Welcome mount after an OAuth redirect, auto-retry the auth check several times over a few seconds
- [x] Inline recovery UI: when a recent sign-in attempt didn't stick, show "Sign-in didn't finish — Try signing in again" amber card with explanation and gradient retry button instead of silently bouncing to the provider buttons
- [x] Regression tests for the recovery timing/UI logic (welcome.recovery.test.ts), typecheck clean, full suite 17 files / 56 tests passing, production bundle rebuilt with index-CntHsXgh.js containing the recovery UI
- [x] Checkpoint 8b608701 auto-published; live verification complete: production serves new bundle index-t8DFpQIV.js containing the recovery UI text, retry flag, and SameSite=Lax callback confirmed live

## Loading skeletons + animations (user request 15 Aug)

- [x] Located all generation paths (Onboarding step 5 → dashboard build; DailyLesson.tsx pending state) — superseded by the educational-animations release
- [x] Workspace-building animated checklist at onboarding completion (WorkspaceBuilding.tsx) — implemented as an educational animation, not a skeleton bar (per user request)
- [x] Daily-lesson preparation animated scene (orbiting subject icons, floating book, particles, rotating motivational text) — implemented as educational animation replacing the shimmer skeleton (per user request)
- [x] Typecheck clean, 56 tests passing, production build verified; checkpoints 2773b82b + 850ffcf6 auto-published; live bundle index-BGABbPwF.js confirmed with animations present and provider buttons removed
- [x] Verified visually (mobile screenshots of onboarding + live bundle probe) and delivered

## Educational inspiring loading animations (replaces skeleton bars — user request)

- [x] Workspace-building checklist animation in Onboarding step 5 (WorkspaceBuilding.tsx with staggered step cards and checks)
- [x] Remove the five provider buttons from the welcome screen (single generic Sign-in button kept; provider SVG marks removed)
- [x] Replaced DailyLesson skeleton with an educational animated scene: orbiting subject icons (9 icons), floating gradient book, rotating motivational phrases, rising knowledge particles (DailyLessonSkeleton.tsx + index.css keyframes)
- [x] Tests + typecheck + production build + checkpoint auto-published; live bundle index-BGABbPwF.js verified: animations present, provider buttons removed, workspace-building scene present

## Remove five sign-in services (user request 15 Aug — awaiting confirmation of replacement UX)

- [x] User confirmed: remove the five provider buttons (Google/Microsoft/Facebook/Apple/Email) entirely; welcome screen keeps logo/title but no sign-in services (user asked twice and clarified twice)
- [x] Implement: remove PROVIDERS list/buttons from Welcome.tsx; keep startLogin path available without provider hint (sign in uses default portal) if still reachable, else welcome becomes pure branding

## Saved Daily Lessons / bookmarks (user request 15 Aug)

- [x] Plan data model: SavedLesson type in types.ts, savedLessons array in StudyState + emptyState/loadState/importData migrations (storage.ts)
- [x] Save/bookmark button on the Daily Lesson card (bookmark icon in header + Save for review button in footer) with saved/unsaved state (DailyLesson.tsx)
- [x] Saved Lessons collection view under /saved with review UI: learning goals, revision recap, remove action (SavedLessons.tsx)
- [x] Registered in App.tsx routes and the AppShell desktop sidebar + mobile More sheet
- [x] Store actions saveSavedLesson (dedupe by selection key) + removeSavedLesson in StoreContext, persisted locally and included in the per-user workspace sync payload (workspaceSync serialises the full StudyState)
- [x] Tests (savedLessons.test.ts), updated presentation contracts tests, typecheck clean, full suite 18 files / 63 tests passing, checkpoint auto-published, live verification
- [x] Verify visually and deliver
- [x] Answer-source branding: every AI answer (Daily Lessons Q&A + Study Assistant) labelled "Student OS tutor" — never OpenAI — in presentationContracts.ts, DailyLesson.tsx and Assistant.tsx

## Returning-user profile restore bug (user report 15 Aug)

- [x] Diagnose why re-login re-shows onboarding: race condition — a fresh-tab empty state uploaded to the server (last-write-wins) before the account's saved workspace was hydrated, clobbering the profile on the server
- [x] Ensure a returning user's server workspace is loaded and adopted on sign-in: hydration gate (uploads blocked until hydration completes), cancelUpload on new session, useWorkspaceSync as a proper hook (tRPC hooks at component top level), no re-upload for returning users (device already canonical)
- [x] Brand-new accounts (new device / friend shared link) still get the full setup flow (empty server workspace still adopts + clears leftover local data)
- [x] Regression tests (server/workspaceRestore.test.ts, 4 cases pinned on the race), typecheck clean, full suite 19 files / 67 tests passing, checkpoint auto-published
- [x] Verify visually and deliver

## Log out option (user request 15 Aug)

- [x] Log-out feature request cancelled by the user; remove existing visible sign-out controls instead of adding a new one
- [x] Remove all visible Google, Microsoft, Facebook, Apple, and Email provider choices, account-login wording, and sign-out controls from user-facing screens (Settings and legacy DashboardLayout); retain only the existing generic Student OS sign-in entry point
- [x] Full suite passed, TypeScript clean, production build passed, mobile onboarding screen checked; checkpoint auto-published

## Per-user account isolation clarification (user request 17 Aug)

- [x] Returning user: restore only that account's saved profile, tasks, exams, lessons, and preferences on every reopen (server workspace keyed by authenticated account; workspace-ready gate prevents premature routing)
- [x] New user or friend: never expose a prior person's local profile; start from the name, education, subjects, and goals onboarding flow (browser cache is tagged to its owner and forcibly cleared before a different account hydrates)
- [x] Add regression coverage for account-switch and shared-device isolation; typecheck clean, client and server production bundles verified separately under sandbox memory pressure, 20 test files / 70 tests passing, and checkpoint e3b78572 auto-published

## Account isolation final hardening pass (user requested to continue)

- [x] Review authentication-loading, local-cache ownership, and server-hydration edge cases for returning and new accounts
- [x] Add safeguards for account-wide Settings actions: imports save immediately, reset clears the signed-in account's server workspace, and onboarding restart is server-saved before routing; protect the saved-lesson library in onboarding restart regression coverage
- [x] Run full verification: 20 test files / 70 tests passed, TypeScript clean, low-memory client plus server production bundles compiled, and checkpoint 38b909e0 auto-published

## Learning notification system (user request 21 Aug)

- [x] Audit current push subscriptions, browser reminders, service worker, notification preferences, and background scheduling
- [x] Add student-controlled notification categories and quiet-hours/frequency controls for due tasks, exams, focus completion, study plans, streaks, and saved-lesson review
- [x] Implement reliable, deduplicated notifications that persist to the correct signed-in account, including scheduled server-side reminders while the browser is closed
- [x] Test permission, subscription, preference, scheduling, and delivery paths; verified mobile onboarding presentation, full suite, and production build; checkpoint 855c788e auto-published

## Full phone reminder system (confirmed by user 21 Aug)

- [x] Deliver real installed-PWA push notifications while Student OS is closed, scoped to the correct signed-in account and device (account-owned subscriptions + guarded re-registration)
- [x] Add controls for task, exam, focus-session, study-plan, streak, and saved-lesson-review reminders, with a master switch, quiet hours, and a respectful daily cap
- [x] Schedule reminder events with stable dedupe keys, prevent delivery after related work is completed, and avoid sensitive details in lock-screen notification text
- [x] Cover preference, account ownership, scheduling, quiet-hours, cap, and delivery-error cases with tests; verify onboarding presentation on mobile and production compilation; active Heartbeat runs every five minutes with successful recent dispatches; checkpoint 855c788e auto-published

## Daily goals and study streaks (user request 21 Aug)

- [x] Define a daily study-goal target and current/longest streak rules that are resilient to timezone changes and missed days
- [x] Add goal and streak data, progress UI, and account-scoped persistence without exposing another student’s activity
- [x] Add encouraging daily-goal progress, goal-complete, streak-protection, and streak-celebration phone notifications that honor existing quiet hours and daily caps
- [x] Add tests for goal progress, streak calculations, notification deduplication, settings, and responsive UI; 21 test files / 75 tests passed, TypeScript clean, responsive entry routes checked, full production build passed, and checkpoint c538a61a auto-published
- [x] Remove the welcome/sign-in screen and begin essential profile setup immediately for a new device
- [x] Preserve the completed profile workspace on return visits without showing onboarding or sign-in again
- [x] Add regression tests and validate the first-run and returning-device flows on mobile (22 files / 78 tests passed; fresh mobile route opens directly to profile setup)
- [x] Publish the no-sign-in onboarding update with a new live release link (checkpoint 51839011 auto-published)
- [x] Force installed Student OS copies to revalidate the service worker so the removed sign-in screen cannot remain cached (updateViaCache disabled; 22 files / 78 tests passed)
- [x] Add an optional profile-picture picker to initial Student OS setup, with clear privacy and file guidance
- [x] Validate, store, and persist each chosen profile picture securely for the device-local student workspace
- [x] Display the saved profile picture throughout the completed workspace and cover the new flow with regression tests (24 test files / 83 tests passed; mobile layout and separate client/server production bundles verified)
- [x] Publish the profile-picture onboarding update (checkpoint 2ad07de1 auto-published)
- [x] Verify profile-picture file signatures server-side before storage, then republish the hardened upload flow (24 test files / 84 tests passed; server production bundle verified; checkpoint 963c4f70 auto-published)
- [x] Diagnose and fix Chrome/PWA reopening a stale old workspace instead of honoring the no-sign-in first-run and current-profile flow (one-time v2 workspace reset; fresh v3 device-local store; browser migration verified)
- [x] Audit startup routing, local persistence, service-worker cache migration, and data-reset behavior across browser and installed-PWA contexts
- [x] Remove legacy account and signed-in-device wording from settings and restore copy so the no-sign-in device-local model is communicated accurately
- [x] Audit every core student workflow, settings control, profile-picture path, and notification subscription path for reproducible defects (tasks, planner, focus start, flashcards, notes, exams, progress, goals, budget, assistant, timetable, profile upload, and permission state checked; real-phone delivery remains user-side validation)
- [x] Reduce avoidable Daily Lessons AI fallbacks by tuning the overly short generation timeout and covering the timeout contract
- [x] Correct singular streak labels on the dashboard so one-day streaks read naturally
- [x] Add regression coverage for each resolved audit defect and complete mobile plus production verification (25 test files / 88 tests passed; startup migration, profile-picture persistence, mobile first-run, settings, dashboard, and separate client/server production bundles verified)
- [x] Publish the audited reliability update after all reproducible issues are resolved (checkpoint efd0dca7 auto-published)
- [x] Diagnose and repair the public studentos-jmnrfmj9.manus.space HTTP 404 outage (production domain rechecked after routing propagation and now serves the release)
- [x] Verify the repaired public link opens the current first-run profile setup on a phone browser (public route verified)
- [x] Publish and record the verified public-domain restoration (current audited release efd0dca7 is live)
- [x] Add a Custom notifications area where students can create, edit, pause, and remove their own reminder messages
- [x] Support one-time and daily custom reminders while honoring phone permission, quiet hours, and the daily notification cap
- [x] Add regression tests for custom reminder persistence, scheduling, validation, and duplicate prevention
- [x] Use local calendar dates for custom reminder defaults and date limits so time zones cannot block a same-day reminder
- [x] Complete a final end-to-end Student OS verification for onboarding, profile pictures, workspace tools, lessons, settings, notifications, service-worker updates, and mobile routes
- [x] Resolve every final reproducible issue and publish the completed Student OS release
- [x] Raise the accepted profile-photo source size and automatically compress oversized onboarding uploads before transfer
- [x] Preserve server-side image-signature validation while enforcing a safe post-compression avatar payload limit
- [x] Add regression tests for compression decisions, output limits, and profile-photo upload validation
- [x] Verify and publish the improved large-photo onboarding experience
- [x] Remove the visible profile-photo source-file size cap and automatically optimize every supported selected image before upload
- [x] Diagnose the reported phone-notification failure across permission, service worker, subscription, scheduler, and push delivery paths
- [x] Fix and regression-test every reproducible notification reliability defect
- [x] Verify the repaired live notification setup and publish the reliability update
- [x] Diagnose why a device with granted notification permission does not receive Student OS reminder delivery
- [x] Add device-scoped notification delivery history for accepted, sent, failed, and expired reminder outcomes
- [x] Display recent delivery history in Settings without exposing private study content in notification records
- [x] Add regression tests for delivery-history retention, status mapping, and Settings presentation
- [x] Verify and publish the Student OS notification delivery-history enhancement
- [x] Send a real “We’ve got you on check” push notification immediately after reminder activation succeeds
- [x] Add regression coverage for the activation confirmation payload and its delivery-history entry
- [x] Verify and publish the reminder-activation confirmation enhancement
- [x] Add a stored vibration-pattern preference with accessible labels and Android-compatible push delivery
- [x] Explain that notification sound selection remains controlled by the learner’s phone and browser settings
- [x] Add regression coverage for vibration preference persistence and service-worker push options
- [x] Verify and publish the notification-feedback preferences enhancement
- [x] Add per-category vibration preferences for every scheduled Student OS reminder type and custom reminders
- [x] Provide understandable Settings controls with global fallback behavior for category vibration choices
- [x] Add regression coverage for category-specific vibration payloads and preference migration
- [x] Verify and publish the per-category vibration preference enhancement
- [x] Diagnose why Lesson Q&A and Study Assistant answers fail to arrive in Student OS
- [x] Harden server-side OpenAI request handling, timeouts, and learner-visible error recovery
- [x] Add regression coverage for successful and failed Lesson Q&A and Study Assistant response paths
- [x] Verify and publish the AI response reliability update
- [x] Add private local usefulness ratings for Lesson Q&A and Study Assistant answers
- [x] Add accessible thumbs-up and thumbs-down controls with learner acknowledgement
- [x] Add regression coverage for answer-rating persistence and interaction behavior
- [x] Verify and publish the learner feedback enhancement
- [x] Create a private feedback summary page showing past Lesson Q&A and Study Assistant rating activity
- [x] Add private navigation to the feedback summary with clear rating and source presentation
- [x] Add regression coverage for summary aggregation, ordering, and empty-state behavior
- [x] Verify and publish the private feedback summary enhancement
- [x] Define concise optional reasons for unhelpful AI answers and keep them device-local
- [x] Add an accessible thumbs-down reason selector to Lesson Q&A and Study Assistant responses
- [x] Show the selected reason in the private feedback summary and support changing or removing it
- [x] Add regression coverage for private reason persistence, replacement, and migration behavior
- [x] Verify and publish the optional thumbs-down reason enhancement
- [x] Diagnose the failed network request from the Settings real-phone push test
- [x] Repair the real-phone test request path and provide actionable in-app error handling
- [x] Add regression coverage for real-phone test request failures and successful activation delivery
- [x] Verify and publish the combined push-test repair and optional feedback-reason enhancement
- [x] Create a complete downloadable Student OS source archive with project code, tests, migrations, and configuration
- [x] Verify the archive includes all source files and excludes generated dependencies, build output, logs, and protected secrets
- [x] Read every requirement in the comprehensive engineering specification and map it to the current implementation
- [x] Audit application bootstrap, routing, authentication, storage ownership, APIs, push infrastructure, service worker, and tests
- [x] Establish a secure multi-user workspace lifecycle that never renders stale cross-account data
- [x] Harden AI, push, profile upload, import, and server workspace interfaces with ownership and schema validation
- [x] Unify theme handling, local persistence, backup migration, and PWA update behavior
- [x] Repair feature-integration, mobile UX, data consistency, and error-handling defects identified in the specification
- [x] Add security, data integrity, and critical user-journey regression coverage
- [x] Run full project verification: type checks, tests, build, PWA, responsive, persistence, and endpoint validation
- [x] Publish the comprehensive Student OS hardening release with documented device-only checks
- [x] Implement real multi-user authentication with account-bound cloud workspaces and local-first device copies
- [x] Prevent account-switch leakage with a locked bootstrap stage, scoped persistence, and cloud reconciliation
- [x] Implement offline sync queue, conflict detection, versioning, and visible sync status for authenticated workspaces
- [x] Add responsive week and day agenda views to the timetable with date navigation and existing event integration
- [x] Add an account-synced currency setting and localized money formatting across the Budget workspace
- [x] Add regression coverage for agenda navigation, event grouping, currency migration, and formatting
- [x] Verify and publish the detailed calendar agenda and local-currency budget enhancement
- [x] Add a navigable monthly timetable calendar that maps recurring weekly events onto calendar dates
- [x] Let learners open the existing day agenda from a monthly calendar date
- [x] Add regression coverage for month construction, weekday event mapping, and month navigation
- [x] Verify and publish the monthly timetable calendar enhancement
- [x] Audit authentication, cloud persistence, local cache ownership, synchronization, offline recovery, and new-device restoration paths
- [x] Add regression proof for authenticated restore, local-first queued changes, offline recovery, and cross-account isolation
- [x] Run controlled save, restore, conflict, and account-switch integration checks against the workspace contracts
- [x] Publish a verification record only after every testable core-system guarantee passes

## Connected Student OS product upgrade (master specification)

- [x] Audit existing dashboard, planner, exams, sessions, flashcards, notes, assistant, focus, progress, timetable, notifications, search, and budget features against the master specification without changing the verified cloud/authentication foundation
- [x] Define an account-synced subject/topic and learning-evidence model that safely connects exams, tasks, sessions, notes, flashcards, quizzes, and recommendations
- [x] Implement P0 command-center recommendations, adaptive daily plan, exam-linked revision planning, connected study sessions, genuine spaced repetition, quizzes, and evidence-based progress
- [x] Implement P1 mastery and weak-topic intelligence, minimal-context AI recommendations, reviewable AI learning-material generation, explicit-consent study-material processing, and daily/weekly reviews
- [x] Integrate P2 calendar, reminders, goals, habits, focus, budget, and global search with the unified student model while preserving mobile-first performance and accessibility
- [x] Prepare P3 sharing, school/class, Ghana-first academic-content, advanced-analytics, and cross-device extension boundaries without releasing an unmoderated social network
- [x] Add regression tests, mobile/desktop reviews, performance checks, production build validation, and an evidence-only release record for each completed increment
- [x] P0.1 Add backward-compatible account-synced topics, learning evidence, persistent study plans, quizzes, quiz attempts, and conflict-safe collection merges
- [x] P0.2 Add deterministic offline-capable mastery estimation, ranked next actions, adaptive exam-plan drafts, command-center recommendation, Today’s Plan, four-grade flashcard scheduling, and a reviewable practice-quiz flow
- [x] P0.3 Connect plan items to scheduled sessions and re-balance missed plan work within remaining capacity without overwriting completed work
- [x] P0.4 Link notes, sessions, flashcards, and quiz attempts to canonical topic IDs across the primary study workflow
- [x] P1.1 Add transparent mastery, weak-topic, daily-review, and weekly-review workspaces grounded in quiz, recall, and completed-session evidence
- [x] P1.2 Add a protected, rate-limited structured AI quiz-draft service that receives only learner-selected topic context and requires explicit review before saving
- [x] P1.3 Add account-owned PDF/plain-text material uploads with strict validation, account-scoped storage keys, and an explicit guarantee that upload alone never authorizes AI processing
- [x] P1.4a Add an explicit post-upload consent action for account-verified PDF summary drafts with signed server-side file access and structured output validation
- [x] P1.4b Add explicit-consent material-derived flashcard draft generation and learner-controlled saving
- [x] P2.1 Extend global search across connected quizzes, materials, revision plans, and canonical topics alongside existing tasks, notes, goals, exams, sessions, and timetable events
- [x] P2.2 Connect calendar, reminders, goals, habits, focus, and budget surfaces to ranked next actions and the daily-plan context without duplicate scheduling

## Real-world validation checkpoint

- [x] Prepare non-production representative PDF fixtures and document which checks require a real authenticated device or second account
- [x] Validate PDF upload, account-scoped storage, consent-gated summary behavior, invalid files, large-file boundary, and offline failure handling
- [x] Validate account isolation, bidirectional cloud restoration, and offline local-first recovery using safe controlled workspace contracts
- [x] Validate notification ownership and flows; explicitly separate automated evidence from manual physical-device checks
- [x] Analyze production bundle composition and implement safe lazy loading or code splitting without changing functional behavior
- [x] Run complete regressions, TypeScript, configured lint, production build, responsive reviews, and live protected-route probes
- [x] Publish an evidence-only validation table that identifies every manual-device requirement and every observed limitation
- [x] Prevent the mobile floating Quick Add control from overlapping study-material and PDF-summary form controls

## Uploaded architecture-audit reconciliation

- [x] Reconcile the audit’s cloud-sync, authentication, conflict, PDF, AI, profile-photo, and push findings against the current source and identify any stale snapshot assumptions
- [x] Prove or repair the active StoreContext cloud lifecycle, account gate, account-local cache scope, and revision-conflict merge behavior
- [x] Prove or repair protected ownership enforcement for AI, profile photos, push devices, reminders, delivery history, and study materials
- [x] Run controlled account A/B, second-device restoration, offline, and endpoint-access validation without touching learner data
- [x] Document remaining P1/P2 architecture risks: JSON workspace growth, IndexedDB migration path, timezone discipline, backup/reset, budget, Quick Add, and legacy cleanup
- [x] Publish an evidence-only audit-reconciliation table and complete a hardened verification checkpoint before further feature work

## Product evolution specification — coherent academic intelligence

- [x] Map every requested product-evolution capability to the current intelligence, planning, exam, mastery, material, review, reminder, recovery, portability, performance, and accessibility implementation
- [x] Define one shared deterministic priority and student-context contract without creating a parallel brain, scheduler, notification system, AI context store, or account-data path
- [x] Implement the highest-value missing execution-coach and priority improvements through the existing local-first StoreContext and learning intelligence engine
- [x] Extend existing sessions and plan items with backward-compatible start, pause, resume, complete, skip, reschedule, actual-duration, and optional-reflection outcomes
- [x] Route active or scheduled study sessions through the existing ranked priority engine and show one explainable execution-coach card on Today
- [x] Add regression coverage for execution selection, capacity-safe priority behavior, persistence validation, and non-completion evidence rules
- [x] Use learner-confirmed actual duration, when recorded, in completed-time, goal, and review calculations without altering planned capacity
- [x] Extend only genuine gaps in exam readiness, mastery evidence, material review/library linkage, review queue, reflection, analytics, and adaptive plan feedback
- [x] Derive an actionable exam-readiness briefing from existing topic mastery and topic coverage without introducing a separate exam progress store
- [x] Surface one cross-subject due-review queue from the existing flashcard scheduler in Reviews without duplicating card scheduling state
- [x] Audit and strengthen approved reliability, recovery, backup/import, reminder, timezone, performance, mobile, and accessibility boundaries; explicitly defer private class spaces pending server-side moderation design
- [x] Validate the coherent increment with regression coverage, build, responsive review, and an evidence-only report before publishing a new source archive

## Ultimate engineering, reliability, and product-evolution mission

- [x] Consolidate every mission requirement, prior audit finding, architecture constraint, and existing capability into a current evidence-backed engineering baseline
- [x] Verify production database workspace capacity against declared limits; test valid small-to-near-limit payloads plus malformed and oversized rejection
- [x] Migrate the production workspace column from MySQL TEXT to a capacity compatible with the validated workspace payload ceiling, then prove safe near-limit and over-limit behavior
- [x] Implement and prove deletion-aware, deterministic, idempotent entity-level conflict handling that cannot resurrect deleted data across offline devices
- [x] Add backward-compatible canonical tombstones for synchronized entity deletions and ensure every existing delete action records the correct collection and entity identity
- [x] Make conflict merge deletion-wins, deterministic, and idempotent for delete-vs-edit, delete-vs-delete, create-vs-create, nested-card removal, and repeated merge scenarios
- [x] Audit every authenticated route and direct storage path for IDOR, forged ownership, stale-session, cross-account update/delete/export, and unauthorized access failures
- [x] Add a direct unauthenticated router matrix for profile photo, study-material, push, AI, and workspace private procedures
- [x] Eliminate the concurrent push-registration race that could otherwise reassign an opaque endpoint across accounts after a stale ownership read
- [x] Keep learner AI answer ratings device-private as promised instead of serializing that feedback history into the cloud workspace
- [x] Run controlled Account A/B, OAuth/session, multi-tab, cross-device restore, and offline/reconnect scenarios; explicitly separate simulated proof from manual-device requirements
- [x] Remove stale unscoped browser identity residue so a signed-out or switched account cannot leave prior name or email data in shared local storage
- [x] Remove dead workspace-owner helper APIs while retaining one-time legacy-key cleanup for older shared-browser installs
- [x] Audit the unified command center, execution coach, prioritization, study-session, mastery, material, review, and AI workflows for gaps, duplicate logic, and unsafe fallbacks
- [x] Make shared daily-context sorting immutable so Dashboard and Today cannot silently reorder canonical tasks, sessions, or events
- [x] Remove in-place workspace-state sorting from Study Assistant personalization so a read-only answer path cannot silently mutate exam ordering
- [x] Make ranked flashcard actions use the same next-review due calculation as the unified review queue
- [x] Prevent adaptive plans from creating multiple study-plan items at the same time on one day when remaining capacity supports several blocks
- [x] Reject overlapping active study-session intervals consistently for manual creation, editing, plan-item start, and rescheduling
- [x] Audit reliability, retries, recovery, import/export, reminder behavior, observability, performance, PWA caching, mobile UX, and accessibility; fix reproducible defects
- [x] Remove the heavyweight AI-chat renderer that pulls syntax and diagram engines into a 939 kB deferred lesson Q&A chunk while retaining readable safe Markdown basics
- [x] Defer the dashboard bundle behind the existing route suspense boundary so sign-in and onboarding do not eagerly load daily lesson and dashboard code
- [x] Recalculate the Daily Lesson AI chat message viewport after mobile resize or orientation changes instead of freezing its initial height
- [x] Bound scheduled push transport retries with durable backoff and terminal retirement so a persistent failure cannot repeatedly deliver or churn forever
- [x] Scope the active focus-completion reminder cache to the authenticated account so another learner cannot inherit or re-sync it on a shared device
- [x] Correct the malformed Daily Lesson loading apostrophe discovered in mobile visual validation
- [x] Scope the Daily Lesson browser cache to the authenticated account so shared devices cannot reuse another learner’s generated lesson content
- [x] Make account-cache clearing fail safely when browser local storage is blocked or throws during a reset/logout path
- [x] Retry an unsynchronized device push plan when the browser returns online without relying on an unsafe periodic timer
- [x] Restrict push-notification click navigation to same-origin Student OS routes instead of trusting an arbitrary payload URL
- [x] Maintain targeted and full regression tests for every repair, then complete evidence-only validation, source archive, and checkpoint before release

## Production-excellence master transformation mission

- [x] Read and reconcile every requirement in the new 1,140-line master specification against actual source, behavior, tests, deployment, and prior claims
- [x] Perform an adversarial secrets, authentication, authorization, storage, API, scheduled-job, AI, and account-isolation audit; treat any discovered credential artifact as compromised
- [x] Repair live duplicate push-reminder rows and enforce unique device-level dedupe keys so a race cannot schedule the same learner notification repeatedly
- [x] Remove or neutralize any secret-bearing project configuration artifact from source packaging and verify it cannot be committed or exported
- [x] Enforce safe source-archive exclusions for project configuration, environment files, dependencies, builds, logs, and coverage
- [x] Fail closed when the JWT/session secret is absent or unsafe so session signing and verification cannot use an empty configuration value
- [x] Allow valid OAuth identities without a display name to retain a session and remove raw OAuth callback exception logging
- [x] Bind verified session payloads to the current application identifier and redact JWT/OAuth user-sync exception details from logs
- [x] Refuse OAuth user-sync responses whose account identity does not match the already verified session claim
- [x] Fail closed when the server-side LLM credential is absent and prevent upstream response bodies from reaching learner-facing errors or logs
- [x] Remove raw AI exception objects from server logs so provider or learner context cannot be emitted during fallback handling
- [x] Replace raw exception logging in consented material and quiz-draft AI paths with privacy-safe operational categories
- [x] Replace remaining database, storage, and push transport raw error-object logs with privacy-safe operational categories
- [x] Remove raw upstream bodies and exception objects from owner-notification logging
- [x] Deny encoded and alternate-separator private storage paths in the generic proxy before presigning
- [x] Add direct scheduled-push callback authorization regressions for rejected and approved Heartbeat identities
- [x] Rate-limit immediate push delivery tests per registered device so a repeated click or malicious authenticated caller cannot create notification spam
- [x] Reject browser-controlled internal, non-HTTPS, credentialed, and nonstandard-port push endpoints before they can be stored or reached by the server
- [x] Remove session-cookie values from OAuth diagnostic-script output so developer logs cannot expose bearer credentials
- [x] Add a repeatable source secret scan to the release verification path so credential literals block future delivery
- [x] Strengthen Student OS as one connected loop from student goals and subjects through schedule, work, learning evidence, risk, adaptation, and next best action
- [x] Add backward-compatible task work estimates, partial progress, subtasks, dependencies, recovery state, topic linkage, and focus-objective links in the canonical workspace
- [x] Extend the single learning-intelligence engine and Today command center with truthful task recovery and next-action guidance
- [x] Make Focus completion record its selected task/topic objective and transparent time evidence without claiming mastery from time alone
- [x] Make Today a truthful guided execution and recovery command center for planned, partial, missed, skipped, postponed, and rescheduled work
- [x] Audit and evolve adaptive planning, mastery, AI reliability, materials, quizzes, feedback, notifications, and real-world product flows without creating duplicate intelligence or state systems
- [x] Persist reviewable answer-level quiz evidence and provide post-attempt remediation without inflating mastery claims
- [x] Connect reviewed material-summary questions to a learner-editable practice-quiz creation path
- [x] Prevent a transient AI model-catalog failure from permanently disabling quiz/material drafts and avoid unsupported reasoning parameters on fallback model families
- [x] Expose recent direct quiz evidence and a truthful next remediation action within topic-level mastery detail
- [x] Reduce anonymous bootstrap cost by deferring authenticated shell and onboarding code behind the already authenticated route boundary
- [x] Ensure all remaining transitions, timer motion, and decorative effects honor the learner’s reduced-motion preference
- [x] Exclude protected storage responses from service-worker caching so a shared device cannot retain account-owned files outside authorization checks
- [x] Run adversarial, regression, integration, responsive, accessibility, security, and controlled runtime validation; identify manual-device requirements explicitly
- [x] Publish an evidence-only transformation report, checkpoint, and verified complete source archive after each major milestone

## 59449904 production hardening directive

- [x] Trace and make nested study-plan-item and exam-topic deletion tombstones deterministic across create, edit, deletion-marker persistence, hydration schema, retry, and multi-device conflict reconciliation
- [x] Audit every nested workspace entity for resurrection risk and record identity, parent, tombstone, merge, conflict, and test-coverage semantics
- [x] Add explicit multi-device, repeated-merge, unrelated-change, and hydration regressions proving nested study-plan-item and exam-topic deletions cannot resurrect stale copies
- [x] Correct and verify every PWA manifest, service-worker, notification icon, and badge asset reference against the production public asset tree
- [x] Harden service-worker update/cache behavior against obsolete build shells while preserving network-first navigation and offline fallback correctness
- [x] Re-audit production bundling, generated module relationships, lazy chart routes, and bootstrap runtime without reintroducing forced vendor chunks; retain authenticated chart traversal as a manual boundary
- [x] Remove unresolved analytics placeholders from production HTML and add build-level coverage for configured and unconfigured analytics behavior
- [x] Re-audit protected procedure ownership, account-scope handling, offline conflict behavior, replay safety, and sensitive private-asset access
- [x] Reconcile stale release evidence, TODOs, test/migration/bundle claims, and create one canonical current validation and manual-acceptance record
- [x] Run the full validation matrix, verify the deployed build, and create an exact release-matched safe source archive for the completed hardening release

## Mobile OAuth callback repair

- [x] Reproduce and diagnose the reported mobile `invalid oauth state` callback failure without weakening CSRF/state binding
- [x] Implement a secure callback-compatible state/cookie repair with explicit replay, mismatch, expiry, and redirect validation
- [x] Add focused OAuth regression tests and run the complete validation matrix
- [x] Verify the deployed unauthenticated login surface and publish the fix with exact manual provider/device acceptance steps; retain real provider/device completion as manual

## Source archive policy

- [x] Export and verify the exact complete source ZIP for the published OAuth repair release
- [x] Preserve the project archive workflow so every future major update produces an exact release-matched ZIP before delivery

## Authentication-screen experience

- [x] Add a welcoming login-screen message that is visible before and during authentication
- [x] Add an accessible loading animation and disabled state while authentication startup is in progress
- [x] Add regression coverage, publish the update, and export the exact matching source ZIP

## Confirmed OAuth redirect loop

- [x] Trace account selection, callback state validation, session-cookie issuance, and frontend session hydration for the confirmed return-to-login loop; recording shows retired `nj9.manus.space`, while active release serves `studentos-jmnrfmj9.manus.space`
- [x] Add controlled regression proving a successful callback establishes a verifiable session cookie; existing state tests cover invalid and replay-resistant callback bindings
- [x] Publish and verify the active-domain authentication flow, then export the exact matching source ZIP

## Current login-session failure

- [x] Reproduce the user-reported login-session failure on the active deployment and identify the stale service-worker/client generation as the cause of the retired OAuth flow being launched
- [x] Apply and regression-test the narrowest secure authentication repair without weakening OAuth state or account isolation; advance the worker to v9 and serve it from a distinct no-store endpoint
- [x] Revalidate, publish, and export the exact current source archive with release and SHA-256 evidence

## Provider permission-denied login failure

- [x] Verify the active OAuth app ID, portal target, callback URI, deployment release, and provider authorization boundary; owner-account denial remains provider-side
- [x] Distinguish provider-side access denial from Student OS callback/session failure and apply only a safe app-side repair if evidence supports one; no secure app-side bypass is appropriate
- [x] Re-run authentication regressions and publish/export any required release with exact evidence

## Comprehensive development audit

- [x] Inventory current architecture, routes, data model, migrations, tests, deployment markers, and prior evidence
- [x] Audit authentication, provider authorization, session hydration, PWA cache lifecycle, and runtime failures
- [x] Audit core student workflows, cloud synchronization, AI flows, notifications, reminders, and account isolation
- [x] Audit accessibility, responsive layouts, loading/error/empty states, and interactive controls across the app
- [x] Repair source-verifiable defects and add focused regression tests without weakening security boundaries
- [x] Run complete validation, publish the verified release, and export the exact current source archive

### Audit finding: profile photo upload ceiling

- [x] Replaced the obsolete 2 MB server avatar ceiling with safe post-compression transport limits and added regression coverage for larger optimized images

## Maximum-execution transformation directive

- [x] Parse all supplied directives into a traceable requirement ledger covering implementation, test, and verification status
- [x] Baseline the current release with every available install, test, check, lint, build, security, and bundle-metric command without inventing unavailable results; baseline recorded 194 files / 493 tests, type and secret checks passed, lint was added for audited files, and the build warning remains tracked
- [x] Audit authentication, provider authorization, session lifecycle, account isolation, PWA cache boundaries, storage ownership, and stale-client recovery; source is hardened, while owner OAuth permission remains provider-blocked
- [x] Audit the complete capture-to-understand-to-plan-to-execute-to-measure-to-recover student operating loop and cross-feature contracts through Today, learning intelligence, tasks, exams, plans, focus, quizzes, mastery, materials, reviews, and reminders; remaining gaps are preserved in the ledger
- [x] Strengthen the academic profile, country/system/level catalogue model, curriculum provenance, canonical subject/topic identity, and custom-subject preservation; explicit country/system onboarding and custom preservation are implemented, while the ledger honestly retains the narrow official catalogue gap
- [x] Audit and unify the quiz lifecycle around level-aware subject/topic selection, exactly 50 validated questions, trusted scoring, grading boundaries, evidence-based analysis, mastery, and next actions; exact-50 AI assessment generation and duplicate rejection are now enforced
- [x] Audit every AI entry point for intent routing, context minimization, strict output validation, prompt-injection resistance, rate limits, retries, timeouts, cost controls, cancellation, and honest fallbacks; lesson Q&A, assistant, material, quiz, schedule, and media paths are covered with bounded behavior
- [x] Audit notifications, reminders, material/PDF flows, media generation, offline recovery, synchronization conflicts, and persistence guarantees; source and targeted tests pass, with physical delivery manual
- [x] Perform adversarial IDOR, replay, race, stale-state, upload, SSRF, prompt-injection, secret-leak, and cross-account tests with regression coverage; targeted matrix and scans pass, live/device cases remain explicit
- [x] Audit mobile UX, accessibility, performance, navigation, loading/error/empty states, and real-user flow boundaries; responsive login and shared loading states are verified, authenticated device traversal remains manual
- [x] Perform an independent final quality gate and publish an evidence-backed release plus exact secret-free source archive

### Audit finding: assistant answer contamination

- [x] Remove client-side unrelated personalization from the primary AI answer path and verify that direct answers remain direct while intentional planning context stays available

### Audit finding: missing lint gate

- [x] Add a repository lint script that runs a deterministic source-format check and make its result part of release validation for the audited source surface

### Audit finding: curriculum label normalization

- [x] Normalize official catalogue labels consistently so casing and whitespace do not create duplicate subject identities or lose provenance

### Audit finding: academic profile context is optional-only

- [x] Add explicit country and education-system choices with a verified-catalogue-aware subject flow, while preserving unclassified/custom learners and existing workspace compatibility

## Independent quality-gate findings

- [x] Return the server-authoritative material-summary consent timestamp instead of writing a divergent client timestamp
- [x] Scope trusted-assessment resume storage by authenticated account identity and add cross-account regression coverage
- [x] Audit every startLogin call site and remove any legacy OAuth starter usage or render-phase invocation
- [x] Add a midnight-boundary mastery-recency regression after confirming date helper semantics; local-calendar semantics are consistent and no source defect was found

## Active OAuth authorization-record investigation

- [x] Verify the active Manus OAuth app identity, redirect registration, project-owner mapping, and portal authorization response for the confirmed owner account
- [x] Apply the required project-side repair after live provider exchange succeeded; no unsupported provider configuration change or insecure bypass was used
- [x] Validate the successful provider handoff to the Student OS callback/session boundary and publish/export the application change

## Owner-completed callback session investigation

- [x] Correlate the completed owner OAuth callback with live deployment logs, callback response headers, redirect target, and session-cookie issuance
- [x] Reproduce and repair the state-binding defect while preserving state binding, secure cookies, and account isolation
- [x] Validate the repaired real login handoff through a live provider callback, signed cookie issuance, auth.me response, and authenticated workspace rendering; archive delivery remains pending final URL cleanup deployment
- [x] Correlate the observed generic OAuth callback failure with the exact post-state-validation lifecycle stage and a privacy-safe server error category
- [x] Accept the platform-provisioned 22-byte session secret through deterministic SHA-256 HMAC-key derivation while retaining a 128-bit minimum input-entropy guard
- [x] Remove an obsolete OAuth error query from the address bar only after auth.me confirms the browser has a valid signed session

## Autonomous OAuth trace requirements

- [x] Trace the active authorization URL, redirect URI, callback state binding, provider return, and browser cookie handoff with privacy-safe evidence
- [x] Preserve a rejected-state regression proving no session is created when the nonce or callback URL is invalid
- [x] Distinguish and repair the Student OS callback/session failures with timestamped lifecycle evidence; the provider exchange itself completed successfully

## Owner delivery condition

- [x] Do not deliver the OAuth repair until automated source validation, live-release checks, and a release-matched source ZIP SHA-256 verification are complete

## Final deep hardening cycle — new master directives

- [x] Audit and accurately reconcile create-account versus log-in semantics, including provider limitations, session restore, logout, expiry, cancellation, duplicate-click, and onboarding behavior (implemented; third-party provider completion remains an external/manual boundary)
- [x] Audit live source/frontend/API/callback release identity and OAuth cookie/state/redirect behavior against the active deployment (source verified; active domain still serves stale worker route, explicitly recorded as a deployment-propagation boundary)
- [x] Make workspace reset/cache refresh failure-safe so cloud recovery is validated before local replacement and pending writes are preserved
- [x] Repair tombstone overflow so confirmed deletions remain representable to stale devices
- [x] Repair date-specific habit completion merge semantics and same-record multi-device conflict handling
- [x] Make focus timer state durable across refresh, suspension, backgrounding, and process death
- [x] Prevent study-time double counting and separate scheduled, actual, focus, and academic-evidence metrics
- [x] Make import reporting durable-success-aware and add safe corrupt-local-data recovery without presenting data loss as a new user
- [x] Strengthen semantic cross-field workspace/import validation and reference integrity
- [x] Guarantee offline access to unvisited lazy routes through reliable precaching or equivalent fallback
- [x] Audit AI cancellation, transient/permanent retry classification, capability-based model routing, context minimization, and document prompt-injection defenses
- [x] Strengthen AI quiz semantic quality validation, editable drafts, durable practice answers, and unified quiz workflow (exact-50 validation and draft integrity covered by regression suite)
- [x] Expand curriculum/topic provenance honestly and enforce subject-to-topic-to-quiz-to-mastery consistency (catalogue provenance and canonical labels validated; unsupported external catalogue expansion remains manual)
- [x] Add structured AI intent/context selection, privacy-preserving relevant context, assistant persistence/retry, and safe rich-text rendering (bounded prompts, account-scoped context, retries, and rendering safeguards covered)
- [x] Audit media capability labels so unsupported video is never represented as generated (image generation is capability-gated; video remains explicitly unsupported)
- [x] Repair notification timestamps, actionable deep links, and safe clear/undo behavior (delivery history, same-origin targets, vibration, and failure states covered; OS-level delivery remains device-dependent)
- [x] Expand search coverage, relevance ordering, keyboard navigation, and result deep links
- [x] Audit small-height sidebar navigation, unsaved-change protection, destructive-action UX, currency history, session lifetime, SRS behavior, dependencies, gamification idempotency, streak copy, analytics terminology, retention labels, and mastery evidence (source/test audit completed; physical device and provider behavior remain manual)
- [x] Audit React lifecycle misuse, dead/template code, duplicate systems, meaningful static analysis, bundle performance, mobile behavior, accessibility, offline failure timing, and cross-account authorization (automated gates and live shell verification passed; production propagation mismatch remains open)
- [x] Execute the required end-to-end and failure-path test matrix, verify the real deployed release and manual boundaries, publish only after all applicable gates pass, and export an exact-release source ZIP with SHA-256 (automated matrix complete; provider/device/deployment propagation boundaries recorded)

## Hardening delivery condition

- [x] Do not claim this hardening cycle complete until defects are fixed or explicitly classified as still open/manual/external with evidence (open boundaries are documented in live-verification-notes.md and final report)
- [x] Produce the exact final release source archive after the final checkpoint and verify it contains no secrets, dependencies, builds, logs, or real user data

## Hardening evidence record

- [x] Create a final evidence report matching the required defect-found, defect-fixed, still-open, manual-validation, test-results, release-identity, and production-readiness sections

- [x] Propagate protected HTTP disconnect signals into all upstream AI and image-generation calls so abandoned requests stop work without surfacing false success

## Attached directive follow-up backlog — 2026-08-28

- [x] Reconcile Attachment 1 P0 assessment submission atomicity and target-bound idempotency against the current server transaction and retry implementation (transactional finalization, submitted-state confirmation, and cross-target conflicts implemented and tested)
- [x] Verify Attachment 1/2 focus academic-link restoration, fixed-duration semantics, and evidence attribution through the real UI flow (persisted subject/task/topic/objective fields and clock-anchored duration are covered; physical background/device completion remains manual)
- [x] Verify all document-processing AI paths share explicit untrusted-document prompt defenses, including PDF/material summary, Q&A, quiz, flashcard, and explanation flows (material PDF summary/practice paths now include explicit boundaries and signal forwarding; other AI surfaces retain equivalent delimiters)
- [x] Verify quiz semantic validation, editable draft fields, practice-state persistence, result-to-mastery flow, and unified quiz information architecture end to end (exact-50 validation, reviewed editable drafts including difficulty/subtopic, resume state, result/mastery handoffs, and focused regressions verified; full learner journey remains manual)
- [x] Verify curriculum provenance, country/education-system hierarchy, and selected-subject consistency across every feature (canonical topic/provenance checks and onboarding/catalogue tests verified; unsupported new official sources require manual review)
- [x] Verify AI intent/context selection minimizes account data and excludes budgets, secrets, tokens, unrelated files, and personal data (request-specific context and account-scoped prompt contracts verified in source/tests)
- [x] Verify notification timestamp precision, ownership-checked targets, clear/undo behavior, and material storage cleanup (delivery history, endpoint ownership, target validation, and storage lifecycle tests verified; device delivery remains manual)
- [x] Verify navigation grouping, canonical dashboard routing, notes autosave/discard protection, destructive-action safeguards, dependencies, currency history, session semantics, and SRS Again interval (source and focused integrity audits verified; short-height/mobile/device sweep remains manual)
- [x] Verify project-wide React lifecycle, static analysis, dead-code/duplicate-system audit, performance, mobile breakpoints, accessibility, and micro-behaviors against Attachment 2 (TypeScript, lint, integrity suite, production build, PWA checks, and public-shell rendering verified; full viewport/device matrix remains manual)
- [x] Execute attachment-required adversarial, two-user isolation, new-account, returning-account, learning, multi-device, offline, provider, device, and deployment-release validation matrix (automated adversarial/integrity matrix executed; OAuth provider, push/device, second-device, screen-lock, and stale-deployment checks remain explicitly manual)
- [x] Reconcile both attachment inventories into a final traceability matrix and updated evidence report before the next release archive (attachment-reconciliation-matrix.md created and updated with current fixes and boundaries)

## Picture-based defect queue — awaiting START

- [x] Picture 1: Replace generic/free-text university subject examples with education-level-aware programme and discipline choices; selecting University now offers appropriate degree/course pathways rather than school-subject labels.
- [x] Picture 1a: Define one canonical level-aware academic catalogue with explicit labels, source/provenance status, degree/programme groupings, and custom-entry fallback; school-subject presets are prevented from appearing for tertiary learners.
- [x] Picture 1b: Persist academic-selection kind and validate it across onboarding, profile updates, import/sync, Daily Lessons, search, plans, notes, materials, flashcards, exams, mastery, and AI inputs.
- [x] Picture 2: Replace the separate Quizzes and AI quiz drafts destinations with one AI Quiz destination; repair the unavailable selector, filter its label/options to the learner’s onboarding-selected subjects or university courses, add a typed-topic field, and generate an answerable, gradeable AI quiz from the selected learner context.
- [x] Picture 3: Repair real phone push registration, permission/subscription guidance, device persistence, reminder scheduling, failure recovery, and the immediate “We’ve got u on check” activation test so notification setup works rather than stopping at “Register this device.” Manual boundary retained: actual browser permission, OS notification presentation, and phone delivery must still be validated on a real installed device against the propagated production release; no delivery success is claimed from source tests alone.

## B52 — Transition Decision & Preparation Bridge

- [x] Seed stage-aware transition preparation tasks for JHS, SHS, and later-stage journeys
- [x] Promote transition preparation steps into the canonical task system with stable provenance
- [x] Prevent duplicate promotion of the same transition preparation step
- [x] De-duplicate normalized result subjects before WASSCE best-six selection
- [x] Preserve the transition safety boundary: preparation work never changes academic identity
- [x] Record the dependency-verification limitation explicitly before release claims
