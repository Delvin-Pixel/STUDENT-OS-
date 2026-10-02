# B39 — Evidence Quality & Assessment Trust

## Purpose

Prevent repeated, invalid, or low-information assessment attempts from falsely inflating mastery.

## Rule

`mastery contribution = performance × recency × assessment trust`

Trust is deterministic and separate from mastery. Valid quiz/practice evidence starts strong. Missing/invalid direct scores are rejected. Same-source same-day retries receive a heavy novelty discount. Spaced reassessment retains meaningful weight. Study minutes remain weak context and never become a mastery proxy by themselves.

## Why this matters

A learner can legitimately retry an assessment. Student OS should therefore keep the attempt, but repeated same-source attempts close together must not behave like independent demonstrations of mastery.

## UI

The Mastery page now exposes an evidence-trust summary alongside tracked topics and trusted direct checks, so a high score cannot hide a weak evidence trail.

## Safety boundary

This layer only changes how evidence contributes to estimates. It does not edit learner records, mark topics mastered, or erase attempts.

## Verification

Focused B39 tests cover valid evidence, invalid scores, same-day retries, spaced reassessment, weak study-time evidence, summary counts, and the mastery weighting integration.
