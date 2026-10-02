# B47 — Versioned Transition Rules + Recommendation Engine

Student OS now separates transition rules from the decision engine and adds transparent option ranking.

## Added

- Versioned Ghana JHS → SHS and SHS → tertiary rule-pack registry.
- Safe BECE handling: no invented official aggregate formula.
- B46 WASSCE aggregate/evaluation compatibility functions restored and tested.
- Transparent `rankTransitionOptions()` fit bands: stronger fit, possible fit, borderline fit, requirements gap, insufficient evidence.
- Recommendations are planning signals, never admission probabilities.
- Official/verified/learner-entered confidence remains visible and affects ranking.

## Safety invariant

`verified rule -> deterministic check -> transparent recommendation -> human confirmation`

Never:

- fabricate admission odds;
- turn an estimate into a guarantee;
- silently change academic identity;
- treat missing requirements as eligibility.
