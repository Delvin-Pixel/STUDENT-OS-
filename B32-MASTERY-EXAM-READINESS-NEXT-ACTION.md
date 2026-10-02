# Student OS B32 — Mastery → Exam Readiness → Next Best Action

## Objective

Turn the B31 mastery signal into a deterministic exam strategy so Student OS can explain not just **how ready** a student appears, but **what to do next** and why.

## Implementation

- Added `getExamStrategy()` to rank every exam topic using readiness weakness, exam pressure, evidence confidence, and topic status.
- Added action classification: `learn`, `practice`, `review`, or `maintain`.
- Added bounded session durations so recommendations fit realistic study blocks.
- Extended `getExamReadiness()` with exam-level confidence, count of high-priority topics, and a concrete `nextMove`.
- Reused the existing evidence/mastery pipeline; manual exam checklist state remains a fallback planning signal, not measured performance evidence.
- Preserved deterministic ordering and tie-breaking by topic name.

## Decision chain

`Evidence → Mastery → Confidence/Freshness → Exam pressure → Topic priority → Action type → Next best move`

## Verification status

Focused B32 regression tests were added. Full dependency-backed test/build execution still requires the project's normal pnpm dependency environment and has not been claimed as passed here.
