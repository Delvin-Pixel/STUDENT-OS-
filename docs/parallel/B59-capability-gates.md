# Parallel implementation checkpoint

This branch starts at verified B58.1 source
`d09e0e0405654922bc934419707a9648929b9247` and does not advance release gates.
B58.1 remains uncertified. PRs #1/#2, main, and the verified/runtime branches
must remain unchanged. Do not retry Manus copy without a new supported fix.

## B59 milestone 1

- Shared capability registry with exhaustive canonical feature coverage and a
  regression check against server Free capabilities.
- One account-scoped entitlement provider and `useCapability` hook, consuming
  the existing authenticated server snapshot. No StudyState or browser-storage
  plan authority, no checkout, and no billing changes.
- Reusable FeatureGate with loading, allowed, locked, offline_unverified, and
  error_fallback states plus structured reasons. Denied children are not rendered.
- Settings displays an optional capability status without gating existing Free
  routes or claiming an unimplemented payment flow.
- Premium display fails closed for offline, stale, expired, failed, and mismatched
  account snapshots. One expiry timer per snapshot; no network polling or retries.
- This is presentation only. Protected operations still require server-side
  authorization; the UI gate is not a security boundary.

## Local evidence

Node 22.23.3, pnpm 10.4.1; frozen strict install passed.
Full suite: 714 tests in 242 files passed, including server entitlement,
academic intelligence, account isolation, tombstone, and service-worker tests.
TypeScript app/tests/config, lint, format, migration metadata (17 migrations),
credential scan, production build, and bundle verification passed.
Remote CI for this revision must be checked separately. Clean MySQL migration
application and dependency audits are required CI checks, not implied by local
migration metadata validation.

## Blocked release verification

**BLOCKED BY B58.1 EXTERNAL GATE:** original live DATABASE_URL recovery,
OAuth callback authorization, persisted account creation/login, sessions,
protected API behavior against the deployed database, and live runtime logs.
Production billing and production release are not authorized. B59/B62–B67 are
not certified complete by these implementation checks.

## Next safe parallel tasks

1. Complete B59 capability-surface inventory before gating any additional existing
   UI. Preserve Free core education; verify server authorization independently.
2. B62: specify an Academic Knowledge Pack manifest with version, provenance,
   curriculum scope, coverage, and bounded content; never infer official authority
   from learner-provided provenance. Existing learningIntelligence remains the
   sole academic authority; lesson/chat opens are not mastery evidence. No
   admission-probability claims.
3. B63/B64: inspect progressive pack loading, Data Saver, bounded caches and
   account-scoped durable outbox. Keep auth/API responses outside service-worker
   caches. Test offline/reconnect and cross-account transitions without live DB.
4. B65–B67: continue static security, accessibility, deterministic regression and
   bundle-budget checks. Device performance and real browser interaction remain
   separate evidence from server-rendered component tests.

Reconcile this branch only after B58.1 closes; no automatic merge or release.
