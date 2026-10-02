# B37 — Knowledge Gap → Learning Path

## Purpose

Turn an evidence-backed knowledge gap into an ordered, bounded learning path.

## Decision chain

Evidence → Mastery → Knowledge Gap → Ordered prerequisites → Target topic → Verification

## Guarantees

- Explicit prerequisite links are authoritative.
- Weak prerequisites are ordered before the dependent topic.
- Ready prerequisites are skipped.
- Missing direct evidence routes the learner to learning rather than pretending a mastery score exists.
- Topics with an available study material may route to the material surface for the learning step.
- Low-readiness topics route to targeted practice; higher-readiness topics get short review/verification.
- Cyclic prerequisite graphs are protected with an in-progress set and cannot recurse forever.
- The function is deterministic and read-only: it never creates or mutates sessions, tasks, evidence, mastery, or profile state.

## Public API

`getLearningPath(state, topicId, today)` returns a `LearningPath | null`.

Each step contains an opaque topic ID, action, route, duration, and reason so UI layers can render or execute the recommendation without trusting display text.

## B37 regression coverage

- weak prerequisite ordered before target
- missing direct evidence produces a learning step
- ready topic gets a verification step
- prerequisite cycles terminate safely
