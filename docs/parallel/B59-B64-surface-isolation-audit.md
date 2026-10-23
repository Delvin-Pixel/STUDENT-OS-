# Parallel capability and account-isolation audit

Baseline: dd32c31 on parallel/b59-capability-gates. Implementation evidence only;
B58.1 remains uncertified. PRs 1/2/3 stay draft; main is unchanged.

## Remote verification diagnosis

The connector returned an empty list, but GitHub REST returned PR run 39814006268
and push run 39813994946 for dd32c31. The PR job 119947548643 passed setup, frozen
install, all three TypeScript checks, lint, formatting, migration metadata,
credential scan, critical tests, full tests, build/bundle, clean MySQL migrations,
and migration schema verification. Full dependency audit failed on Vite 7.3.6,
GHSA-587h-7wmj-h5pm; the log identifies 7.3.7 as patched. Production audit and
subsequent clean-tree/archive/upload gates were skipped. Empty connector results
must not be treated as absence of runs. Patch Vite without altering audit levels.

## Capability surface inventory

All registered application routes are covered below; aliases share a policy.
These mappings preserve existing functionality. Premium IDs describe **additional**
future service/scale/convenience layers, not permission to lock existing education.

| Existing surfaces                                                               | Canonical baseline           | Optional future capability                                                                                                                          |
| ------------------------------------------------------------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| /, /dashboard, /today, /study, daily lessons and saved lessons (/saved)         | core_learning                | advanced_ai_coach for additional hosted coaching                                                                                                    |
| /tasks, /focus, /timetable, /exams, /goals                                      | core_learning                | advanced_adaptive_planning for additional convenience, never core deterministic planning                                                            |
| /flashcards, /quizzes, /reviews, /quiz-drafts, /ai-quiz, /ai-quiz/library       | core_learning                | advanced_quiz_generation for extra hosted generation, never manual study or assessment                                                              |
| /mastery, /progress, /foundation                                                | core_learning                | advanced_mastery_analytics / advanced_reports for additional presentation, never mastery evidence, remediation, readiness or prerequisite decisions |
| /journey, /transition                                                           | core_transition              | No admission-probability claims or paid access to essential pathways                                                                                |
| /notes, /materials, /material-summary                                           | core_learning                | ai_study_material_generation / expanded_cloud_storage for additional processing and capacity                                                        |
| /assistant                                                                      | ai_assistant                 | advanced_ai_coach beyond the existing baseline                                                                                                      |
| /budget, /leaderboard, /feedback, /notifications                                | core_learning                | No new lock introduced                                                                                                                              |
| /settings, onboarding, account controls, accessibility, data export, Data Saver | core_learning / core_offline | premium_customization for optional cosmetics only; advanced_reports status currently uses FeatureGate                                               |
| Offline shell, local workspace, focus persistence, conflict recovery            | core_offline                 | Essential offline access remains Free                                                                                                               |
| /404                                                                            | core_learning                | No gate                                                                                                                                             |
| Unreleased opt-in experiments (no existing product route)                       | No existing paid surface     | early_access only after server authorization exists                                                                                                 |

Inspection: route registrations in App.tsx, pages/components, shared/entitlements,
shared/capabilityAccess, EntitlementContext, server/entitlements and routers.
No duplicate client plan resolver, isPremium conditional, URL Premium flag, or
localStorage-owned entitlement was found in the inspected production source.
The button style comment using “premium” describes appearance, not authority.
Push subscription objects are transport subscriptions, not billing plans.
The sole current FeatureGate integration is Settings capability status. It shares
the five canonical states. No other route was newly locked or paywalled.

Server entitlement resolution is canonical but B60 authorization wiring is not
complete: existing AI/material/workspace endpoints use baseline safety limits,
not differentiated Premium limits. Do not advertise a Premium upgrade as unlocking
those endpoints or add a fake checkout. Retain all baseline limits for both plans.

## Persistence and replay review

| Mechanism                                                      | Observed ownership / lifecycle                                                         | Finding or action                                                                                                                                                          |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workspace, revision/pending metadata, recovery and conflicts   | localStorage keys encode the exact openId                                              | Existing account-scoped storage retained; regression covers pending/conflict isolation and clearing B while A stays pending                                                |
| Workspace save/reconnect/conflict resolution                   | One StoreContext sync loop; durable pending snapshot plus revision, no separate outbox | Added required expectedAccountId precondition on save/clear; load scope must match session. Reject mismatched queued A request under B before validation/storage           |
| Logout / account switch                                        | StoreProvider keyed by authenticated openId                                            | Added unmount generation invalidation and timer cancellation; stale save completions cannot schedule another retry. Auth/account mismatch stops automatic save retries     |
| Focus timer, reminders, daily lessons, push endpoint reference | Account-scoped keys                                                                    | No cross-account key fallback introduced; retained per-account recovery rather than deleting unsynced A work on switch                                                     |
| Trusted assessment resume                                      | SessionStorage opaque session ID; server owns assessment authorization                 | Replaced lossy underscore normalization with URI encoding of both account and quiz ID; collision regression added. Ambiguous old keys are not migrated into a new identity |
| Service worker                                                 | Shared static shell/cache; no IndexedDB or background-sync write queue found           | Executable VM tests prove /api/... and /storage/... requests bypass the cache handler; existing boundaries unchanged                                                       |
| Academic pack preparation                                      | Pure manifest parser/planner; no persistent pack cache                                 | No additional account data store or competing sync engine introduced                                                                                                       |
| Browser UI preferences                                         | Sidebar width is device-wide                                                           | Non-personal presentation state; not entitlement or academic authority                                                                                                     |

The expected account field is a stale-request precondition, **not** authorization:
the server session remains authoritative and the storage key is always ctx.user.
A forged field cannot select another account. Old clients without the required
workspace precondition fail closed; deploy client/server together when authorized.
No live database or migration is needed for this contract change.

## Explicit limits and next review

Local fixtures prove the workspace and cache-key cases above; they do not prove
all browser/tab/logout timing or live account persistence. PushReminderSync has a
separate in-memory asynchronous reminder refresh loop and server-owned scheduled
notifications. Its cancellation, endpoint reassignment and cookie-switch race need
a dedicated follow-up before claiming comprehensive cross-account isolation.
Other protected mutations and global query-cache lifecycle also require that
follow-up. Do not describe the whole app as proven immune to cross-account replay.
Persisted browser data is not encrypted or protected from same-origin script/XSS;
account-scoped keys are isolation, not an encryption claim.

**BLOCKED BY B58.1 EXTERNAL GATE:** live database, OAuth callbacks, persisted
accounts, sessions, deployed protected APIs and runtime logs. B59/B64/B65/B67
remain implementation milestones, not release-complete.

## Local verification checkpoint

Patched Vite to 7.3.7; its Rollup dependency resolves to 4.65.0. Frozen strict
install passed with Node 22.23.3 / pnpm 10.4.1. Full suite: 733 tests in 243 files
passed. Production build and bundle verification passed (2 precache entries).
The unchanged high-severity audit gate passes; production audit reports no known
vulnerabilities. Development graph retains three moderate findings:
GHSA-rj75-hqrm-r3gf (postcss-selector-parser), GHSA-qxg6-89mg-rqv8 and
GHSA-xp26-3454-mjgp (@vitest/mocker). Track patch updates separately; do not label
the complete dependency graph vulnerability-free.
