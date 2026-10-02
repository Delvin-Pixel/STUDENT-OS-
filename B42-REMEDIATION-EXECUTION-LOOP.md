# B42 — Remediation Execution Loop

## Contract

B42 converts the B41 remediation graph into an executable, bounded plan.

`Concept signal → remediation plan → executable block → learner execution → outcome → fresh evidence → reassessment`

## Rules

- Planning is side-effect free; creating a plan never creates a session or evidence.
- A block is bounded to 10–45 minutes.
- Available time can shorten a block but never create a block below 10 minutes.
- Completing a study block proves execution, not mastery.
- `verify` steps explicitly require fresh assessment evidence.
- Existing sessions are reconciled by topic and status; completed work is not repeated.
- Reconciliation can move a plan to `needs_reassessment`, but it never writes mastery.
- No silent task/session mutation is performed by the intelligence layer.

## Why

B41 identified _what_ should be remediated. B42 makes that decision executable while preserving the evidence boundary. Learning claims remain the responsibility of fresh evidence and B38/B39 reassessment layers.
