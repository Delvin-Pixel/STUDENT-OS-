# B40 — Assessment Intelligence

## Purpose

Turn retained quiz responses into deterministic **concept signals** that can localize repeated misses and feed targeted remediation.

## Core rule

`assessment score != diagnosis`

A score tells Student OS how the student performed. Response evidence can add a **localized concept signal**, but the engine must not claim a specific misconception without stronger evidence.

## Signal rules

- Group responses by question `subtopic` when available.
- Count misses and distinct questions, not just attempts.
- Repeated misses across multiple distinct questions are stronger than one isolated miss.
- Same question repeated alone is not treated as proof of a conceptual gap.
- Severity combines accuracy, evidence breadth, recurrence, and attempt depth.
- Recommended remediation is deterministic: review → practice → recheck.

## Product behavior

Mastery surfaces the strongest assessment signal and remediation without automatically changing mastery, evidence, tasks, or sessions.

## Verification boundary

B40 focused tests cover repeated multi-question misses and the single-miss caution case. Full project build/test verification still requires the project's dependency environment.
