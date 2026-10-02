# Deferred Assessment and Curriculum Catalogue Contracts

This decision record converts the two deferred Student OS directives into concrete, reviewable contracts. It authorizes **design only**. No database migration, server route, workspace schema change, or user interface is implied by this document.

## Preserved architecture

The existing `StoreContext` workspace remains the sole canonical local-first store for tasks, practice quizzes, attempts, mastery evidence, plans, and learner profile state. `learningIntelligence` remains the sole deterministic recommendation/mastery/planning engine. Any trusted assessment result must be imported as a bounded, read-only evidence fact after server finalization; it must not replace the local practice runner or create another client intelligence engine.

| Decision           | Contract                                                                                                            | Compatibility safeguard                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Existing quizzes   | Keep `StudyQuiz` and local `QuizAttempt` as explicitly local practice.                                              | No existing quiz, attempt, or offline workflow is deleted or reinterpreted as a trusted grade.                |
| Trusted assessment | Introduce a relational, owner-scoped server feature separate from workspace blob persistence.                       | Only a finalized server result may create one linked canonical evidence fact.                                 |
| Curriculum model   | Preserve `profile.subjects: string[]` and add optional context/provenance only after a workspace-version migration. | Existing profiles remain valid and all legacy labels default to `custom` or `unclassified`, never `official`. |
| Catalogue data     | Treat country/system source data as versioned reference data, not model output.                                     | No prompt or AI response may claim that a learner’s custom subject is official.                               |

## Trusted assessment contract

### Relational tables

| Table                    | Required fields                                                                                                                                                                                                               | Ownership and idempotency rule                                                                                          |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `assessment_sessions`    | numeric ID; `openId`; status; source identifier; optional topic/exam identifiers; question count; immutable question-set checksum; `clientStartKey`; `clientSubmitKey`; start/submit/finalize timestamps; score/count summary | Unique `(openId, clientStartKey)` for creation. A finalized session returns the same result for every retry.            |
| `assessment_questions`   | session ID; stable ordinal; prompt snapshot; options snapshot; correct index snapshot; explanation snapshot                                                                                                                   | Unique `(sessionId, ordinal)`. Snapshot is server-written once and never replaced after session creation.               |
| `assessment_responses`   | session ID; question ordinal; selected option index; updated timestamp                                                                                                                                                        | Unique `(sessionId, questionOrdinal)`. Upsert only while the session is `in_progress`.                                  |
| `assessment_submissions` | session ID; `openId`; `clientSubmitKey`; finalized timestamp; score summary                                                                                                                                                   | Unique `(openId, clientSubmitKey)` and unique `sessionId`, so a duplicate submit returns the original immutable result. |

### Protected API sequence

The only allowed route order is **create → read/resume → save response → submit → result**. Every procedure is a `protectedProcedure` and derives owner identity only from `ctx.user.openId`. A request body must not contain a trusted owner field. `create` accepts a bounded server-available assessment source plus `clientStartKey`; `save response` accepts one bounded selected index; `submit` accepts `clientSubmitKey` and performs server-side scoring from the immutable question snapshot in one transaction.

The submit transaction must lock/read the session and submission key, reject another owner, reject expired or non-progressing state, calculate the result from `assessment_questions`, write the final session/submission rows, and then return the same final result for duplicate submits. Browser-provided scores, correct answers, and mastery values are never accepted. A client may receive only the learner-visible question fields before finalization.

### Canonical learning-loop import

After server finalization, a dedicated StoreContext action may import a minimal evidence record only when it receives a stable server assessment ID, matching current topic linkage, score, and finalized timestamp. The action must de-duplicate by `sourceId = assessment:<serverId>`, reject a removed topic without altering a local score claim, and never mutate assessment status. The initial release should display trusted assessment results separately from local practice attempt totals.

## Curriculum catalogue contract

### Reference data and provenance

| Entity                     | Required fields                                                                                                                  | Safety rule                                                                          |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `curriculum_catalogues`    | stable catalogue ID; country code; education-system ID; version; source title; source URL; retrieved/reviewed dates; active flag | A catalogue version is immutable after publication; replacement means a new version. |
| `curriculum_subjects`      | catalogue ID; stable subject ID; display name; education-band applicability; optional parent/branch; source citation reference   | A subject is official only when attached to a published catalogue row.               |
| Profile curriculum context | optional country code, system ID, catalogue ID/version, and subject-provenance mapping                                           | Omit for existing profiles. Context cannot erase the existing string subject list.   |
| Profile subject provenance | label; `catalogue` or `custom` or `unclassified`; optional stable catalogue subject ID                                           | Any unmatched legacy/custom label is never upgraded automatically to `catalogue`.    |

### Backward-compatible workspace migration

The shared workspace schema must first add optional `curriculumContext` and optional subject-provenance fields with defaults. The migration must accept an older workspace blob, preserve `subjects`, annotate nothing as official by default, and write the next schema version only after the compatibility transform succeeds. Local hydration, cloud validation, merge/conflict behavior, profile normalization, onboarding, and tests must change together. The catalogue reference tables are read-only from the learner client; learner-created subjects remain workspace-local custom labels.

## Required implementation gates

No migration should begin until all gates are closed in one reviewed design pass:

1. The exact assessment source eligibility, maximum question count, expiry rules, and data-retention policy are agreed.
2. Server transaction/error semantics are specified and an idempotency/retry test matrix is written.
3. Every ownership-bearing table indexes `openId` and every query filters on it.
4. The assessment-to-local-evidence import is de-duplicated, topic-safe, and labelled distinctly from local practice.
5. Catalogue source data is acquired from authoritative sources, versioned, cited, and independently reviewed.
6. A workspace compatibility fixture covers old offline blobs, cloud revisions, custom subjects, and account-switch hydration.

Until then, the two deferred features remain deliberately **not implemented**. This prevents incompatible data migrations, false official-curriculum claims, and a parallel client assessment engine.
