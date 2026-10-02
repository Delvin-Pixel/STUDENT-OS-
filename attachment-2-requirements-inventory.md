# Attachment 2 — Requirements Inventory

## AI context and privacy

Context selection must follow request → intent → required context → minimal context assembly → AI, rather than client keyword matching alone. Relevant context may include upcoming exams, relevant tasks, weak topics, timetable, recent study activity, notes, materials, and subject context. Unrelated budget records, secrets, tokens, unnecessary personal data, and unrelated documents must never be sent.

## Notifications and search

Notification records need true ISO timestamps rendered in the user’s local timezone, not calendar-day-only storage. Notifications should carry a safe target model of targetType, targetId, and targetRoute, with server-side ownership verification before navigation. Exam, task, flashcard, and other reminders should open their source objects. Clear-all needs confirmation or undo.

Search should cover saved lessons, habits, achievements, budget transactions, AI conversations, useful notifications, and files while retaining relevance ranking. Keyboard navigation must support Arrow Up, Arrow Down, Enter, and Escape with accessible focus management. Deep links such as `/tasks?taskId=123` must actually open the target for tasks, notes, exams, goals, timetable, flashcards, quizzes, and materials, using one consistent entity-opening pattern.

## Navigation and editing safety

The information architecture should group, rather than remove, destinations into coherent areas such as Today, Plan, Learn, and Tools. Desktop navigation must independently scroll at short viewport heights; every destination, profile/XP area, and active state must remain accessible. If `/` and `/dashboard` are the same dashboard, one canonical route must be chosen and the other normalized.

Notes need debounced draft persistence and a discard-changes path for meaningful unsaved edits. All destructive operations across tasks, notes, exams, goals, budget, timetable, flashcards, study sessions, habits, saved lessons, and materials need confirmation or undo and safe cloud-sync behavior.

## Storage, currency, session, and learning semantics

Deleting a material must safely clean its cloud object or schedule ownership-checked cleanup, preventing orphaned storage. Each budget transaction must preserve its historical currency meaning when the workspace currency changes. `lastSignedIn` must mean session establishment, not every authenticated API call. Session review should use platform-supported refresh, rotation, revocation, and device/session management where available without unacceptable usability harm, documenting tradeoffs.

Every UI metric must distinguish scheduled time, planned time, actual effort, Focus time, academic evidence, and mastery. Mastery cannot be calculated from study time alone; it must rely on quiz, direct-check, flashcard, practice, recency, and topic-level evidence. Heuristic retention values must be labeled “Recall estimate” rather than scientific probability. Failed SRS cards should receive a shorter “Again” interval than a full day. Task dependency UI must show “Blocked by” and “Blocks” while preserving cycle prevention.

## Gamification, code quality, and architecture

XP, streaks, and achievements must be idempotent across completion, Quick Add, import, sync, retries, duplicate submissions, and restoration. Streak copy must match the real learning-activity algorithm. Dead/template code should be removed only after reference verification. Duplicate date, theme, persistence, sync, XP, notification, validation, and AI-routing systems should be consolidated into canonical utilities.

React side effects must not run inside `useMemo`; the whole repository must be checked and corrected. Static analysis must be meaningful and project-wide, covering ESLint, TypeScript, hooks, unused code, unsafe `any`, and unreachable code without weakening rules. Performance must inspect dashboard/AI/PDF/chart/analytics/heavy dependencies and use lazy loading without breaking offline behavior.

## Mobile, accessibility, micro-behavior, and adversarial testing

Test approximately 320, 360, 375, 390, 412+ pixel widths and desktop across dashboard, navigation, forms, modals, keyboard, flashcards, quizzes, AI, timetable, settings, notifications, and search. Prevent horizontal overflow, clipped text, inaccessible controls, tiny targets, keyboard obstruction, broken scrolling, and unusable dialogs. Audit labels, ARIA names, focus and focus order, keyboard operation, contrast, reduced motion, dialog semantics, and zoom; icon-only controls require meaningful accessible names.

Every button must perform its labeled action, show loading, prevent duplicate submission, fail actionably, update correct state, survive refresh, respect offline behavior, and remain accessible. Every form requires empty/invalid/max/long-text/cancel/unsaved/duplicate/server-failure/persistence checks. Every modal requires Escape, close, keyboard, mobile-height, scrolling, focus, and unsaved-data checks. Every destructive action requires target correctness, confirmation/undo, sync safety, duplicate protection, and recovery.

Adversarial tests must include duplicate clicks/submissions, refresh during saves or AI generation, network loss and recovery, stale devices, simultaneous edits, delete/update conflicts, malformed API and AI responses, oversized data, corrupt storage, invalid parameters/IDs, expired sessions, unauthorized IDs, prompt injection, and malicious documents. Two-user security tests must attempt cross-user access to workspaces, tasks, notes, exams, quizzes, materials, files, notifications, AI conversations, profiles, and push registrations; every unauthorized request must be rejected server-side.

## Required journeys and final reporting

The new-account journey is create account → profile → onboarding → education level → subjects → dashboard. The returning journey is login → existing profile → existing cloud workspace → dashboard. The learning journey is exam → topics → plan → study session → Focus → notes → flashcards → quiz → results → weak topic → remediation → retest. The multi-device journey covers create/sync, second-device sign-in/restore/modification, and update receipt. The offline journey covers disconnect, create/edit/complete, close/reopen, reconnect, and synchronization. Account isolation covers A’s data, logout, B login, and B seeing zero A data.

The final report must include, for every defect fixed, ID/title/root cause/files/fix/tests/regression result; for each open defect, reason/risk/next action; all manual validation requiring OAuth, Android, iOS/Safari, push delivery, live PDF/AI, installed PWA, and a second device; actual TypeScript/lint/unit/integration/E2E/build/security/PWA results without invented numbers; exact release identity for current release, Git, ZIP, SHA-256, deployment, frontend, API, worker, and match status; and exactly one readiness status: READY, READY WITH MANUAL VALIDATION REQUIRED, or NOT READY.

The quality standard is fail-safe behavior: synchronization preserves local data, AI never fabricates success, authentication never bypasses security, stale deployments are identified, invalid imports preserve existing workspaces, conflicts do not silently delete legitimate work, and student errors have recovery paths. The required execution order is P0 first, then P1, then P2, followed by full failure-path testing and an exact-release archive. The final instruction is to inspect, trace, reproduce, fix root cause, test, break the fix, regression-test, and verify again rather than defend earlier claims or stop at superficial test counts.
