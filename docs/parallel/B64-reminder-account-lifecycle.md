# Reminder and entitlement account lifecycle

This follow-up remains on the isolated parallel branch. B58.1 is uncertified;
PRs 1/2/3 remain draft and main is unchanged.

## Resolved remote CI checkpoint

Both runs for 6bd16a62cae3d5aec4203b54b4b6a84df03dcd1a passed every required
step: PR run 39816280152 and push run 39816268552. This includes frozen install,
all TypeScript checks, lint/format, secrets, critical/full tests, build/bundle,
17 migration metadata checks, clean MySQL migrations/schema, both dependency
audits at their existing thresholds, clean tree and verified source artifacts.
The earlier dd32c31 audit failure is resolved by the Vite patch. Three moderate
development dependency findings remain documented in the preceding audit.

## Changes

- push.syncReminders requires expectedAccountId and rejects a mismatch with the
  authenticated server identity before touching device registration or reminders.
  Both general reminder refresh and Focus reminder refresh supply their origin
  account. This also covers an endpoint that has not yet been registered.
- Both existing refresh loops invalidate their asynchronous lifetime on unmount.
  Work resumed after a browser subscription lookup stops when cancelled. General
  reminder refresh also stops before writing completion metadata after unmount.
  The existing serialized/latest-plan mechanism remains the sole reminder loop;
  no durable queue, new sync engine, or service-worker caching change is added.
- entitlements.me requires the same account precondition. EntitlementContext
  supplies the account associated with its query key. A cookie identity change
  can no longer cause a server snapshot for B to be labelled as A by the caller.
  The field is a consistency check; only the server session authorizes access.
- Existing endpoint-ownership checks still reject account takeover and prevent
  Account B from reading or disabling Account A's endpoint.

The server precondition handles requests already sent before client cleanup.
It does not cancel a server operation that was already authenticated as Account A;
that operation remains restricted to A. Client and server changes must be deployed
together; older clients without the required field fail closed.

## Evidence and limits

Full deterministic suite: 735 tests across 243 files passed. New router tests
assert mismatched reminder plans do not reach reconciliation or create an owner,
and mismatched entitlement requests do not reach the entitlement lookup.
Existing account-ownership, workspace, capability and cache-boundary tests remain
in the full suite. TypeScript, lint and production build/bundle passed.

Review of remaining query keys found assessment reads keyed by opaque session ID,
profile-photo reads keyed by owned storage key, and push history carrying account
cache scope. A broader global query-cache/logout/cross-tab lifecycle review is
still needed before claiming complete app-wide account isolation. Explicit push
activation/deactivation and notification delivery after logout also need dedicated
lifecycle tests. No real device notification or live session test is claimed.

**BLOCKED BY B58.1 EXTERNAL GATE:** live database connectivity and schema, OAuth
callback authorization, persisted accounts, sessions, deployed protected APIs,
and runtime log verification. B59/B64/B65/B67 are not release-complete.
