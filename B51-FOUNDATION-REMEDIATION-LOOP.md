# B51 — Foundation Monitor Remediation Loop

Student OS now closes the loop after a prior-level foundation check.

## Flow

1. A periodic Foundation Monitor check is completed.
2. Missed response subtopics are retained as weak concept signals.
3. The system links weak concepts back to the targeted historical topic IDs when the concept labels align.
4. A score below 70% creates a `needs_remediation` state.
5. The Foundation page surfaces a targeted repair action instead of another broad old-class quiz.
6. The repair assessment uses fresh questions and the existing `remediation_verification` assessment mode.
7. A repair score of 85%+ closes the immediate gap and returns monitoring to a longer interval.
8. Lower repair scores keep the foundation under active attention and schedule another short pass sooner.

## Safety / semantics

Foundation Monitor never changes the student's academic class. It is diagnostic and longitudinal. A weak historical foundation becomes a targeted support signal, not an academic demotion.

## Verification status

Source implementation only. Full project test/build verification remains blocked by the extracted environment's missing Node dependencies/type definitions.
