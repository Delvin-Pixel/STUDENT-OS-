# B46 — Transition Decision Hub

Student OS now has a persistent transition decision workspace between academic stages.

## Included

- Result capture with core/elective classification and grade validation.
- WASSCE six-subject aggregate calculation for SHS→tertiary decision support.
- Source-aware options for schools, programmes, universities and courses.
- Deterministic eligibility checks against stored subject/minimum-grade and aggregate requirements.
- Confidence labels: official, verified secondary, learner entered, unverified.
- Preparation checklist retained alongside the transition decision.
- `/transition` route linked from the Academic Journey centre.
- Results/options remain separate from current academic identity.

## Guardrails

- Student OS never invents missing grades.
- A calculated aggregate is decision support; institution-specific admission calculations remain authoritative.
- Eligibility means only "meets the stored stated requirements"; it is not a guarantee of admission.
- Source URLs are optional for learner-entered planning but must be HTTPS when supplied.
- Graduation/academic-stage transition remains confirmation-gated.

## Ghana notes

- Current official University of Ghana undergraduate guidance states a six-subject aggregate for admission and publishes programme-specific subject requirements; Student OS should consume those requirements as a versioned source rather than hard-code one institution's rules into the global engine.
- CSSPS is the placement system for graduating JHS candidates; Student OS should integrate placement data through a source-backed Ghana pack when that data is available.
- BECE aggregate/placement rules remain an explicit curriculum-pack responsibility because the placement system, not Student OS, is the authoritative source for actual placement outcomes.
