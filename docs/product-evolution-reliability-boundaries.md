# Product Evolution: Reliability and Boundary Review

**Scope.** This increment extends the existing authenticated, cloud-backed, local-first workspace. It does not introduce a second planner, persistent background process, public class space, independent AI-context database, or new browser trust boundary. The execution coach writes only to the canonical session and revision-plan records; cloud synchronization remains the existing account-scoped StoreContext lifecycle.

## Execution, recovery, and portability

| Area               | Current implementation and release decision                                                                                                                                                                  | Evidence or boundary                                                                                                                                                         |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Execution recovery | A session can be started, paused, resumed, completed, skipped with a reason, or rescheduled. Only completion adds study minutes, XP, linked plan completion, and topic evidence.                             | `StoreContext` actions and lifecycle-schema regression coverage.                                                                                                             |
| Honest metrics     | Completed-time surfaces prefer `actualDuration` when a learner records it; planned duration still drives future capacity. Skipped and rescheduled sessions leave active schedules and capacity calculations. | Daily context, daily-goal, dashboard, review, and assistant summaries share this rule.                                                                                       |
| Offline and sync   | Every execution mutation remains an optimistic account-local state change and uses the established revision-aware cloud retry/merge flow.                                                                    | No new direct API client or persistence store was introduced. **REQUIRES MANUAL DEVICE TEST:** start, pause, and complete while offline, then reconnect on an installed PWA. |
| Export and import  | The current validated backup/export and account-scoped import capabilities remain the portability mechanism.                                                                                                 | The import flow preserves canonical workspace validation. A cloud deletion remains an explicit separate control.                                                             |
| Data scale         | The workspace is still one bounded JSON document with a local-storage cache.                                                                                                                                 | The phased IndexedDB/normalized-data migration remains documented in `data-storage-migration-plan.md`; this release does not claim that scale limit is solved.               |

## Reminders and notifications

The execution coach deliberately does not create new reminder records or schedule a second notification system. Existing task, exam, focus, study-plan, daily-goal, streak, custom-reminder, delivery-history, and browser-push flows retain ownership under the authenticated account. The new coach is a read/write execution surface for canonical sessions, so it can be reflected by the existing reminder logic without duplicating notifications.

> **REQUIRES MANUAL DEVICE TEST:** browser permission, installed-PWA notification receipt, offline/reconnect delivery behavior, account switching, and platform-level quiet-hour behavior cannot be proven by unit tests or a desktop preview.

## Privacy and collaboration boundary

The product specification’s private class spaces, invite links, roster management, group aggregation, anonymous aggregate performance, moderation, role controls, and safety review require new server-side multi-user data models and a moderation design. They are intentionally **deferred**. The present workspace remains personal and account-isolated; no student data is exposed to another learner through this increment.

## Performance, mobile, and accessibility

The execution coach, evidence-based exam briefing, and cross-subject review queue reuse route-local components and deterministic in-browser helpers. They do not add an AI request, charting dependency, client secret, or new always-on process. Desktop and phone-sized visual reviews cover the empty-state command center and review queue; production build analysis remains the release gate.

The new controls use visible labels, native date/time/number/select inputs, named action buttons, and `aria-label` descriptions for dynamic inputs. The one-card execution pattern keeps controls grouped rather than requiring precision drag-and-drop. **REQUIRES MANUAL DEVICE TEST:** keyboard-only completion/reschedule, screen-reader output, reduced-motion behavior, and target-size comfort on a physical phone.
