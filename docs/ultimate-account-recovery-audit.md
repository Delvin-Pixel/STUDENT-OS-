# Ultimate Engineering Mission — Account, Recovery, and Offline Audit

This audit distinguishes deterministic source/test evidence from conditions that require an observed external browser, identity provider, or physical installed PWA.

| Scenario                           | Observed automated evidence                                                                                                                                 | Status                                                                                  |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Returning account on a new device  | Hydration adopts a validated remote workspace when the account-local cache is clean; profile, task, and server revision are preserved.                      | Covered by `workspaceHydration.test.ts`.                                                |
| Offline local work                 | Pending account-local changes remain authoritative while offline instead of being overwritten by the last cloud copy.                                       | Covered by `workspaceHydration.test.ts`.                                                |
| Transient cloud failure            | A previously stored account-local workspace remains visible with recoverable failed-sync state.                                                             | Covered by `workspaceHydration.test.ts`.                                                |
| Stale whole-workspace save         | Server revision checking rejects the stale write; the browser merges records, records deletion tombstones, and retries with the returned revision.          | Covered by `workspace.test.ts`, `workspace.auth.test.ts`, and `workspaceMerge.test.ts`. |
| Offline deletion versus cloud edit | Canonical tombstones make the deletion win, preserve unrelated additions, and stay idempotent on repeated merges.                                           | Covered by `workspaceMerge.test.ts` and `workspaceTombstones.test.ts`.                  |
| Account-local browser cache        | Local workspace and metadata keys are derived from authenticated `openId`; a missing account ID returns an empty state and legacy unscoped data is removed. | Covered by `storage.test.ts` and source review of `storage.ts`.                         |
| Shared-browser identity residue    | The unscoped runtime identity mirror is removed on logout and when authentication becomes absent.                                                           | Covered by `authIdentityCache.test.ts`.                                                 |
| Device-private AI feedback         | Feedback is retained only from the current browser cache and stripped from all cloud writes.                                                                | Covered by `workspacePrivacy.test.ts` and `workspace.test.ts`.                          |

## Required manual validation

The following are intentionally not represented as automated success claims: **REQUIRES MANUAL DEVICE TEST** with two real accounts and at least two browser/device contexts.

1. Complete an OAuth sign-in, then close and reopen the installed PWA to confirm the account session and cloud workspace restore correctly.
2. Sign in as Account A, make an offline change and deletion, then use Account B on another browser/device and verify no profile, task, material, notification history, or push endpoint is visible across accounts.
3. Bring Account A back online after Account B independently edits its own workspace; confirm Account A's pending work synchronizes without a cross-account render.
4. Exercise a real OAuth expiry/logout/login transition, including a browser that blocks third-party cookies or runs private browsing, and confirm the learner receives recovery guidance rather than stale data.
5. Confirm installed-PWA push receipt, signed private-file opening, service-worker update, and browser-specific cache behavior on an actual phone.
