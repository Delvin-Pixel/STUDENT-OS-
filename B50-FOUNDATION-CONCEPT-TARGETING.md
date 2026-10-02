# B50 — Concept-Targeted Foundation Monitor

## Goal

Foundation checks now target specific historical concepts when Student OS has explicit academic-level tags on its knowledge graph.

## Behavior

- Current academic level is never changed by a foundation check.
- Historical topics must be explicitly tagged with `academicClassLevel` to be selected as historical targets.
- Current-level topics that declare a historical topic as a prerequisite increase that prerequisite's diagnostic priority.
- Topics with weak recent direct evidence are prioritized.
- Topics with no direct assessment evidence are also prioritized.
- Older evidence receives a modest freshness boost.
- If no level-tagged historical topics exist, the system safely falls back to a subject-level diagnostic instead of guessing.

## Data additions

`SubjectTopic.academicClassLevel?`
`FoundationCheck.focusTopicIds?`
`FoundationCheck.focusConcepts?`

## Verification note

A full project test/typecheck/build was not run because the current extracted source environment does not contain the required Node dependencies/type definitions. This archive is a source candidate, not a production/live release.
