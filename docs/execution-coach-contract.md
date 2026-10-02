# Student OS execution-coach and priority contract

## One intelligence layer

The only prioritization source remains `client/src/lib/learningIntelligence.ts`. It consumes the canonical account-scoped `StudyState` already used by Dashboard, Today, Reviews, adaptive exam plans, and the reminder planner. AI may explain selected deterministic signals, but it must not calculate a competing priority score or receive the full workspace.

| Concern                              | Single source of truth                                                           | Consumer surfaces                                                                  |
| ------------------------------------ | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Next-action priority and explanation | `getRankedNextActions(state, today)`                                             | Dashboard, Today, Reviews, execution coach, reminder selection, AI compact context |
| Study capacity and rescheduling      | Existing sessions, plans, timetable, and `rebalanceMissedPlanItems`              | Study planner, execution coach, reminder planner                                   |
| Learning strength                    | `getTopicMastery` over quiz/practice/flashcard/session evidence                  | Mastery, exam readiness, priority engine, reviews                                  |
| Notification scheduling              | `planDevicePushReminders`                                                        | Device push synchronization only                                                   |
| AI context                           | Selected compact derived context from the existing priority/mastery/exam results | Protected AI endpoints only                                                        |

## Bounded execution data

The first increment extends existing `StudySession` and `StudyPlanItem` records rather than creating a second task engine. All new fields are optional and legacy-safe.

| Record            | Optional extension                                                                                                                      | Purpose                                                                                                  |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Study session     | `startedAt`, `pausedAt`, `resumedAt`, `finishedAt`, `actualDuration`, `executionStatus`, `skipReason`, `rescheduleReason`, `reflection` | Captures a bounded execution lifecycle and learner feedback without inventing automated activity claims. |
| Study-plan item   | `skipReason`, `rescheduledAt`                                                                                                           | Preserves why a planned item changed and feeds future review/rebalance messaging.                        |
| Learning evidence | `kind: reflection` only if a reflection produces a bounded score; otherwise retain reflection inside the session                        | Avoids treating subjective reflection as an objective test result.                                       |

Valid execution states are: `planned`, `in_progress`, `paused`, `completed`, `skipped`, and `rescheduled`. Completion remains the only state that records study-session learning evidence. A skipped or rescheduled session must not increase mastery, streak, or completion analytics.

## Deterministic priority explanation

Priority remains a private internal ordering, not a learner-facing numerical score. Every surfaced candidate includes up to three human-readable reasons from the following stable signals: overdue deadline, due-today deadline, near exam, weak measured topic, estimated weak topic, overdue flashcard review, planned-session commitment, low recent activity, and learner-set priority.

Available time is interpreted conservatively: existing planned sessions and timetable events reduce the displayed suggested capacity; the engine must never promise capacity it cannot verify. A reschedule only seeks genuinely free slots before an exam/deadline and reports any unallocated work honestly.

## Privacy and reliability constraints

The execution coach remains entirely local-first and account-synced through the existing StoreContext mutation path. It does not introduce a background process, a separate scheduler, or a second server database. AI receives only an explicitly selected compact context—such as the one action, its reasons, relevant exam, mastery summary, and available duration—after protected authorization. Reflections and skip reasons are private workspace data; they are not sent to AI by default.

## First UI increment

The first UI delivers a single **Execution Coach** card from the top ranked action. It shows the action, subject/topic, planned duration, reasons, state, and next appropriate control. It supports start, pause, resume, complete, skip with a lightweight reason, and reschedule. Existing Study remains the full schedule editor; Today remains the daily read model and surfaces the coach without duplicating schedules.
