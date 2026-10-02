# Student OS — Consolidated Hardening, Architecture, Security, Reliability & Product-Readiness Specification

> **Source basis.** This document merges the two uploaded `pasted_content.txt` audit prompts. It is the authoritative release gate for Student OS until every P0 item has a recorded evidence outcome. It preserves the first audit's concerns about stale source snapshots, active sync wiring, endpoint ownership, PDF reality, data scale, and usability; it also preserves the later prompt's comprehensive P0–P2 test and product criteria.

## 1. Governing Rules

Student OS must be an **authenticated, account-backed, local-first, cloud-synchronized student workspace**. A visible feature, a green TypeScript check, a test suite, or a production build is not sufficient evidence that this requirement is met. Every conclusion must distinguish among source inspection, automated regression, controlled runtime integration, live endpoint validation, and physical-device observations.

No new major feature expansion may proceed before P0 findings are reconciled, repaired where necessary, and evidenced. The app must not be described as production-ready merely because static validation passes. Any check that cannot be observed in a real installed browser/PWA, on a second physical device, or through a live provider must be marked **REQUIRES MANUAL DEVICE TEST**.

| Evidence class         | What it can establish                                                                               | What it cannot establish alone                                                   |
| ---------------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Source audit           | Active code path, guard, validation, data flow, and dead-code status                                | Live provider, browser, device, or deployment behavior                           |
| Automated regression   | Repeatable contract and known failure-path behavior                                                 | Real OAuth, push receipt, storage/provider availability, or physical offline use |
| Controlled integration | Actual persistence, restore, conflict, ownership, and storage/AI behavior under controlled accounts | Every browser/device-specific condition                                          |
| Live probe             | Deployed route availability and unauthenticated boundary responses                                  | A signed-in user's full private flow                                             |
| Manual-device test     | Installed PWA, OS permission, receipt, offline/reconnect, and second-account reality                | General server correctness beyond the tested scenario                            |

## 2. Required Architecture Baseline

Before a material code change, record the current architecture for frontend entry, routes, auth, server procedures, StoreContext, local persistence, workspace cloud persistence, database schema, storage, PDF workflows, AI, push, notifications, service worker, offline behavior, search, stateful learning features, and bundle boundaries. Search the active source for `TODO`, `FIXME`, placeholders, development-only behavior, mock/fake success states, dead routes, dead components, unused synchronization code, public procedures, direct storage references, local/session storage use, authentication bypasses, swallowed errors, and silent fallbacks.

The audit must explicitly reconcile the older inspected snapshot against the current source. A finding can be classified as **confirmed defect**, **partially addressed / residual risk**, **stale snapshot finding**, or **not reproducible with current evidence**. A stale claim must still be treated respectfully: the report must show the current path and evidence that supersedes it rather than simply asserting that it is incorrect.

## 3. P0 — Authentication and Private Workspace Authority

The real startup chain must be:

```text
Unauthenticated visitor → account sign-in → authenticated identity resolves
→ account-scoped local cache + protected cloud workspace load → validated hydration
→ Student OS routes and account-owned services
```

It must not be possible for a signed-out user to render a prior learner's workspace, nor for a new account to briefly adopt a prior account's in-memory or cached query result while the new account is being resolved. Server-derived identity, not a browser-supplied identifier, remains the security authority for every protected resource.

| P0 requirement             | Required proof                                                                                                                                                |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Signed-out safety          | Protected workspace and owned-resource procedures reject unauthenticated direct requests; private routes do not render workspace state while auth is loading. |
| Account-specific hydration | Account A and Account B use separate local cache namespaces, query state, and server workspaces.                                                              |
| Logout and account switch  | Memory state, account-scoped query cache, and UI state cannot expose Account A while Account B begins hydration.                                              |
| Expired-session safety     | An unauthorized protected call fails safely and does not leave an apparently synchronized private workspace.                                                  |
| Server enforcement         | Every user-owned procedure uses protected authentication and derives the acting account from server context.                                                  |

## 4. P0 — Active Local-First Cloud Synchronization

The active StoreContext—not an unused helper—must implement this lifecycle for every persisted workspace collection:

```text
User mutation → optimistic in-memory state → immediate account-local persistence
→ debounced/retryable protected cloud save with revision → server outcome
→ visible sync status; conflict merge or an actionable error
```

On startup, authentication resolves first. The application then loads only the authenticated account's local cache and protected server workspace, validates both, compares pending state and revision metadata, chooses an adoption policy, hydrates in-memory state, and only then renders the authenticated workspace. Offline edits must remain available locally and retry after reconnection; a failed cloud operation must not discard local work.

The audit must identify the source of truth, local store, cloud path, offline behavior, second-device restoration behavior, failure behavior, and learner-visible status for tasks, notes, exams/topics, flashcards/reviews, quizzes/attempts, goals, sessions, timetable, budget, habits, settings, saved AI material, notifications, and study materials.

## 5. P0 — Restoration, Isolation, and Conflict Evidence

Controlled disposable test accounts and browser sessions must exercise this scenario without touching learner data:

```text
Account A / Session A: create representative records → wait for a confirmed save
→ prove server persistence → Session B with cleared local cache restores Account A
→ add an independent record in Session B → Session A makes a separate edit
→ prove revision conflict is detected and non-overlapping records survive.
```

Account B must not be able to read, overwrite, resolve, register, disable, or retrieve Account A's workspace, materials, profile photo, AI-owned features, push device/history, notifications, or other private resources. Tests must include direct procedure/API calls and altered identifiers/storage keys, not only hidden UI controls.

The workspace must use revision-aware writes. When the server revision is newer, the client must not blindly overwrite it. The system should preserve independent entity additions through stable IDs and state clearly how same-record edits are resolved. Any remaining same-record policy must be explicit and documented as a limitation rather than silently destructive.

## 6. P0 — Private-Service and Resource Ownership Controls

Every AI operation with private student context must require authentication, validated bounded input, safe timeout/error behavior, and per-account cost/abuse protection. API keys and private provider credentials must never be shipped to browser code, browser storage, or public responses. Relevant surfaces include Daily Lessons, lesson Q&A, Study Assistant, learning/quiz drafts, PDF summaries, and explicit media generation.

Profile-photo upload must require authentication; validate type, binary signature, and bounded size; derive an account-scoped storage key server-side; and avoid unauthenticated or cross-account access. Push-device registration, reminder synchronization, disabling, test delivery, and delivery history must all be bound to the authenticated account and opaque endpoint ownership. A different account cannot manipulate a device record it does not own.

Study materials must be protected end-to-end. Upload must validate accepted types, size, and data format; storage must use server-derived account namespace; opening a material must resolve a temporary URL only after membership in the authenticated workspace is verified; summary processing must confirm material ownership and explicit learner consent before access is passed to the server AI provider.

## 7. P0 — PDF Reality and Review Workflow

The auditable PDF pipeline is:

```text
Authenticated upload → type/size validation → account-scoped storage
→ protected ownership check → explicit per-file AI consent → temporary server-side file access
→ structured review draft → learner review/edit → learner-controlled save
```

Real representative PDFs—not generic responses—must be used to demonstrate storage integrity and a summary that reflects known source concepts. Tests must cover small valid, reasonably large, text-heavy, invalid, unsupported, malformed, transient storage failure, AI timeout/failure, retry behavior, and cross-account access denial. PDF-derived content must remain a draft until the learner approves it. Saved content must retain honest source traceability; page numbers must never be invented.

## 8. P0/P1 — Data, Local Storage, Backup, and PWA Boundaries

The current whole-workspace JSON blob and browser local storage approach must be measured and described honestly. The audit must state payload caps, browser quota risks, growth characteristics, serialization/sync cost, and entity-level conflict limitations. It must not initiate an uncontrolled rewrite. Instead, it must document a backward-compatible migration plan toward versioned IndexedDB local persistence and, if scale requires it, normalized server records for high-growth entities such as tasks, notes, decks/cards/reviews, sessions, materials, quiz attempts, and transactions.

Backups must use a versioned envelope containing schema version, application version, export timestamp, and workspace data. Import must validate type, size, and schema. Reset/delete UI must distinguish local-cache reset from a protected cloud wipe, describe exactly what will be removed, and require a deliberate confirmation. Service-worker policies must never cache protected API responses as public offline data. Offline startup, reconnection, refresh, PWA reopen, and expired-session behavior must be tested or marked manual.

## 9. P1 — Connected Learning Integrity

These items are evaluated only after P0 is evidenced. Existing implementation must be inspected before any replacement is proposed.

| Capability                 | Required integrity rule                                                                                                                                                                                                                            |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Today / execution coaching | Start, pause, resume, complete, skip, and reschedule must use actual plan/session data; skips collect a lightweight non-judgmental reason; redistribution respects remaining capacity, deadline, exam proximity, weakness, duration, and priority. |
| Exams and readiness        | Syllabus/topics, coverage, confidence, practice/quiz performance, recency, weak topics, and proximity may inform a transparent readiness signal; manual status alone is not measured mastery.                                                      |
| Flashcard scheduling       | Again, Hard, Good, and Easy must update review history, next date, interval, ease/retention, and lapse data. Do not label a simple difficulty toggle as spaced repetition.                                                                         |
| Mastery                    | Combine measured quiz/practice/recall evidence, confidence, and recency; keep self-reported confidence distinct from observed performance.                                                                                                         |
| AI context                 | Send only learner-selected and relevant context—not a full workspace—to protected server AI calls. All generated drafts require review before permanent save.                                                                                      |
| Daily Lessons              | Apply explicit timeouts and bounded retries; label every result accurately as AI-generated, cached, or fallback; avoid partial state writes and preserve existing learner data on failure.                                                         |

## 10. P2 — Quality, Validation, and Performance

The audit must make a deliberate—not speculative—assessment of navigation hierarchy, legacy/dead code, lazy-route coverage, bundle composition, source archive freshness, and mobile accessibility. It must verify local date/timezone semantics using a single documented UTC/storage and local-display policy.

Budget controls must clearly distinguish income, spending, and balance; validate positive finite values, reasonable bounds, decimal precision, category, date, and currency; and warn without blocking when spending exceeds available income. Quick Add must show a clear confirmation before it commits ambiguous inferred changes, especially study sessions or financial transactions. Fallback content must never be represented as a live AI result.

## 11. Mandatory Verification and Release Gate

Before a hardening checkpoint, run the current full regression suite, TypeScript validation, production build, responsive desktop/mobile route review, live public-route check, and protected-boundary probe. Validate the final complete source ZIP against its intended contents. The ZIP must include project source, frontend, backend, configuration, shared schemas, migrations, tests, and documentation while excluding dependencies, builds, logs, version-control internals, and secrets.

The final report must contain exactly this table format and must not substitute general reassurance for evidence:

| Area | Status | Tested how | Problems found | Fix applied |
| ---- | ------ | ---------- | -------------- | ----------- |

The report must separately list all **REQUIRES MANUAL DEVICE TEST** items, including real OAuth account switching where unavailable, installed-PWA offline/reconnect, push permission/receipt/disable, and live AI-provider reliability. It must report unresolved limitations, particularly workspace-blob scale limits, with a safe next-step plan. It must not claim production readiness unless P0 has actually been completed and the remaining manual tests are clearly understood.

## 12. Priority Sequence

1. **P0, before any major feature:** current-source reconciliation; auth gating; account-switch cache isolation; active StoreContext sync; restoration; conflict merge; protected/owned AI, photo, push, and material routes; PDF reality; account A/B tests.
2. **P1, after P0 evidence:** data/IndexedDB migration plan; connected-learning integrity; timezone and PWA/offline hardening; provider reliability; reviewed material workflows.
3. **P2, after P1 scope is agreed:** navigation polish; backup/reset copy; budget validation; Quick Add confirmation; dead-code cleanup; additional bundle optimization.

No P1 or P2 work should obscure, replace, or defer a real P0 defect. Every remediation must add or update a regression test where deterministic coverage is possible and then be validated against a controlled runtime scenario where the risk is integration-dependent.
