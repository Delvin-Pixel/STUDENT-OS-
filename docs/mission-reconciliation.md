# Student OS mission reconciliation

This document is an evidence-led working reconciliation of the uploaded Student OS product specification against the current implementation and checklist. It is not a claim that every requirement is complete.

## Canonical architecture

Student OS is required to remain one authenticated, cloud-backed, local-first workspace. StoreContext remains the sole canonical client workspace and learningIntelligence remains the deterministic learning engine. AI is an intelligence layer, not the source of truth: generated content requires bounded server-side handling and learner review before canonical mutation. The implementation must not add parallel stores, score engines, planner engines, browser-held secrets, or client-authorized server ownership.

## Product priorities

The specification prioritizes a connected command center and daily plan over isolated feature count. Core P0 domains are account/cloud, local-first synchronization, tasks, exams, subjects, study planning, study sessions, flashcards, quizzes, and progress. P1 domains are mastery, weak-topic detection, AI recommendations, AI flashcard and quiz generation, study-material processing, daily briefing, and weekly review. P2 domains are calendar/timetable, notifications, goals, habits, focus, budget, and search. P3 domains are shared resources, school/class spaces, Ghana-specific academic content, advanced analytics, and cross-device enhancements.

The intended learning loop is learn, practice, test, identify weakness, review, retest, and improve. Exams should connect to topics, plans, sessions, flashcards, quizzes, timetable, reminders, focus, and analytics. Quiz results and other meaningful evidence should feed recommendations and mastery; time alone must not be treated as mastery. Notes, materials, tasks, focus sessions, flashcards, and quizzes should use canonical subject/topic links where available, and stale links must not create orphaned evidence.

## Reliability and data integrity

Every canonical mutation must be bounded against the shared workspace schema, reject malformed or stale targets before mutation, avoid silent false success, and preserve editable or reviewed learner input after rejection. Duplicate-submit claims must be released when a canonical write is rejected. Conflict merging must preserve independent nested changes while retaining deletion-wins semantics. Collection limits, timestamps, local calendar dates, and optional fields must be tested against the shared schema rather than only UI constraints.

Narrow integrity repairs already verified in the evidence ledger include session and event overlap acceptance, transaction and goal validation, local-date review attribution, nested conflict merges, task topic linkage, notification disable reconciliation, note and deck stale-topic reconciliation, exam validation and capacity protection, quiz reviewed-draft recovery, material upload recording, Focus evidence handling, goal progress bounds, and note lifecycle validation. The task lifecycle repair remains in progress after a validator and acceptance path were added: impossible dates, remaining optional schema fields, and TaskDialog retryability require final verification before checkpointing.

## UX, performance, and accessibility boundaries

The product specification requires mobile-first interaction, clear empty/loading/error/offline/retry states, accessible labels and focus behavior, adequate contrast, zoom, reduced motion, touch-sized controls, responsive forms and calendars, and lazy loading for heavy charts, AI interfaces, PDF processing, and analytics. Source tests and production builds can prove code contracts and bundle characteristics, but actual physical-device behavior, screen-reader behavior, keyboard/touch interaction, zoom, offline transitions, installed-PWA updates, push delivery, OAuth/provider responses, and multi-device conflict behavior remain manual acceptance boundaries.

## Deferred architectural boundaries

Two explicit broad items remain deferred until their contracts are designed against the existing architecture: a protected relational, idempotent, server-authoritative assessment session/submission system that does not replace the local practice runner; and an optional provenance-aware country/education-system catalogue that preserves custom subjects and backward-compatible workspace sync. These must not be implemented as an unbounded rewrite or by duplicating canonical engines.

## Evidence policy

Each implemented defect must have a narrowly worded checklist item added before coding, focused regression coverage, TypeScript validation, full Vitest validation, credential-literal scanning, production build validation, an append-only factual ledger entry, a checkpoint, and a matching complete-source archive. Claims about live providers, real push delivery, OAuth, storage providers, devices, accessibility, timezone behavior, and multi-device synchronization must remain explicitly manual unless directly accepted.
