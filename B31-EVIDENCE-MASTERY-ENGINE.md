# Student OS B31 — Evidence → Mastery Engine

## Objective

Make learning evidence produce a transparent mastery signal that downstream planning can trust without treating sparse or indirect activity as proof of mastery.

## Implementation

- Extended `TopicMastery` with `confidence`, `freshness`, `decayMultiplier`, `latestDirectScore`, `latestEvidenceAt`, `readiness`, and `examPressure`.
- Kept quiz/practice outcomes as the strongest direct evidence; flashcards remain a secondary signal; study minutes remain capped supporting evidence only.
- Centralised newest-evidence recency calculation and exposed the decay multiplier without hiding it inside the score.
- Confidence is driven by direct-check count and freshness, with topics lacking direct checks explicitly remaining estimates.
- Exam pressure is derived deterministically from the nearest future exam that contains the topic.
- Priority decisions now consume readiness, freshness, confidence, and topic-specific exam pressure.
- Added the missing B30 schedule-gap functions back into the working source after the B30 archive contained a corrupted `learningIntelligence.ts` entry; preserved the B30 tests and Today integration.
- Mastery UI now exposes readiness, exam pressure, confidence, and freshness alongside the familiar mastery score.

## Verification status

Automated dependency-backed verification could not be rerun in this environment because the archive has no installed dependencies and `pnpm` is unavailable. A direct `tsc --noEmit` attempt reached the project but stopped on missing `@types/node` and `vite/client` type definitions. The source changes and focused regression tests are present in the archive; they still require the project's normal dependency environment for execution.

## External gates unchanged

Real-device PWA push, third-party OAuth completion, deployed artifact propagation, and offline/service-worker lifecycle acceptance remain external gates.
