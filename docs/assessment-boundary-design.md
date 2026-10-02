# Protected assessment boundary design

The current local practice runner remains canonical for offline practice, quiz drafts, scoring presentation, and workspace learning evidence. A future server-authoritative assessment boundary must be additive rather than a replacement.

## Proposed relational entities

`assessment_sessions` would be account-owned by `openId`, identified by an opaque idempotency key, and contain a bounded assessment definition reference, status, issued-at, expiry, and version. `assessment_submissions` would be account-owned through the session, unique on `(sessionId, submissionKey)`, and contain a validated answer payload, server-computed score, submitted-at, and immutable result version. A separate `assessment_events` table is optional only if audit replay is required; it must not copy private workspace blobs.

## Security and correctness invariants

Every procedure would use `protectedProcedure` and derive ownership only from `ctx.user.openId`. Session creation would be idempotent on the account and caller key. Submission would use a transaction and a unique constraint so retries return the original result rather than awarding duplicate evidence or XP. Server scoring would use a server-held assessment definition and never trust a client-provided score. Expiry, maximum attempts, answer count, payload size, and status transitions would be bounded by zod and database constraints.

## Integration boundary

The server result would be projected into the existing StoreContext learning-evidence path only after accepted submission, with a deterministic dedupe key. The local quiz runner would continue to work offline and would not be silently converted into a server session. A full implementation requires migration SQL, db helpers, router procedures, ownership tests, idempotent retry tests, and explicit product decisions about assessment-definition storage before schema changes are applied.

## Current status

This is a design boundary, not an implemented feature. No database migration or server procedure should be added until the assessment-definition contract, attempt policy, and evidence projection are fully specified and tested.
