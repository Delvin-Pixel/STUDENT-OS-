# Student OS B35 — Recovery Intelligence

## Objective

Turn repeated execution friction into a concrete recovery decision instead of repeatedly serving the same plan.

## Decision path

`execution outcome -> friction pattern -> recovery action -> bounded next block`

## Recovery actions

- **Retrieve material** when a session was skipped for missing materials.
- **Prerequisite review** when the learner marks a session as not ready.
- **Reschedule / shrink the commitment** after repeated time pressure or repeated moves.
- **Change method** after repeated difficulty or confusion by switching toward direct practice/recall.
- **Shorten the session** when recent evidence supports a smaller block even without a distinct blocker.

## Safety / integrity

Recovery is a pure planning signal. It does not silently edit sessions, tasks, evidence, mastery, or the learner profile. The deterministic workspace remains the source of truth.

## B35 correction

The prior B31/B34 path contained stale references to `completedCount`, `momentum`, and `friction` inside mastery adjustment. B35 replaces those with the current `ExecutionFeedback` fields (`completedSessions`, `completionRate`, and `struggleRate`) so the execution signal and mastery engine agree on one contract.

## Verification

- Source-level transpile checks can be performed where the TypeScript parser is available.
- Focused regression coverage was added for each recovery branch and the no-evidence case.
- Full dependency-backed test/build verification remains an environment-dependent gate when dependencies are unavailable.
