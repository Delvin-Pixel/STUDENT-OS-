# B45 — Academic Journey & Progression Engine

Student OS now carries an explicit longitudinal academic journey alongside the existing profile.

## Included

- JHS, SHS, tertiary and primary-compatible journey stages.
- Current class/year captured during onboarding (for example JHS 3, SHS 2, Level 200).
- Academic year captured for progression timing.
- Deterministic expected-completion projection where the class/year is understood.
- Transition states: current → approaching_graduation → awaiting_confirmation.
- Graduation remains confirmation-gated; the engine never silently promotes a student.
- Completed stages are retained as history.
- `/journey` transition centre added.
- Dashboard surfaces an approaching/awaiting transition without changing the current academic identity.
- Next-stage profile can be confirmed into JHS/SHS/tertiary with new class/year and subject/course selections.

## Guardrails

- Age alone never determines academic stage.
- A student entering at SHS 2 or JHS 3 is treated as already in that stage, not as a first-year student.
- Manual education-level changes recreate the current journey rather than pretending a graduation occurred.
- Graduation is detected as an advisory milestone and requires explicit confirmation before the active stage changes.

## Next build

The next progression slice should add the transition decision hub: result capture, verified aggregate calculators per examination system, eligibility checks, school/programme comparison with source-aware confidence, and pre-entry preparation before the next-stage environment activates.
