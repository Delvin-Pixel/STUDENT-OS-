# B38 — Mastery Reassessment

B38 closes the learning-path loop without giving the AI authority over mastery.

## Flow

`Learning path → completed learning/practice → fresh evidence → deterministic reassessment → updated mastery → next action`

`reassessTopicMastery()` overlays new learner evidence on the canonical workspace and recomputes the same mastery/readiness/confidence signals used by priority and planning. It never mutates persisted workspace state.

`reassessLearningPath()` refreshes the path and determines whether prerequisites and the target now meet the reliable readiness threshold (`readiness >= 70` and `confidence >= 50`). A verification step requires fresh direct evidence.

## Outcomes

- `confirmed` — the target was already reliably ready and fresh evidence confirms it.
- `improved` — fresh evidence raises the signal and/or clears the reliability threshold.
- `still_needs_work` — new evidence exists but reliable readiness is not established.
- `no_new_evidence` — no reassessment claim is made.

## Integrity

No function in B38 creates sessions, marks tasks complete, edits mastery records, or silently changes the workspace. The learner's actual evidence remains the source of truth.
