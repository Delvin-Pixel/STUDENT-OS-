# B43 — Closed-Loop Learning Verification

## Purpose

B43 verifies whether a remediation intervention actually changed the learner's evidence-backed state.

## Core rule

Completing a study session is execution evidence, not learning proof.
A remediation gap can only close when fresh trusted direct assessment evidence supports the canonical mastery/readiness thresholds.

## Flow

Assessment signal → Remediation plan → Execution → Fresh direct assessment → Reassessment → Verify outcome → Close OR escalate

## Outcomes

- `closed`: fresh trusted evidence meets the readiness/confidence threshold.
- `improved`: learning signal moved upward but remains below the closing threshold.
- `still_needs_work`: fresh evidence exists but does not establish sufficient improvement.
- `regressed`: fresh signal is materially weaker than baseline.
- `insufficient_evidence`: intervention cannot be judged from available direct evidence.
- `no_new_evidence`: no post-intervention evidence was supplied.

## Escalation

Verification can request more practice, prerequisite review, a method change, varied assessment, or teacher support. These are recommendations only; B43 is read-only and does not silently mutate sessions, tasks, evidence, or profile state.

## Trust boundary

Fresh evidence is deduplicated before verification. Repeated identical source attempts do not become multiple independent proofs. Rejected assessment evidence cannot close the loop.
