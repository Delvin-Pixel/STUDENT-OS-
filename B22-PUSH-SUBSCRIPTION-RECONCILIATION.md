# Student OS B22 — Push Subscription Reconciliation

## Problem

A browser push subscription can rotate. If the new endpoint is registered while the previous endpoint remains enabled, the same account can retain two active delivery targets and receive duplicate reminders. The existing sync path also separated registration from reminder replacement, creating a partial-state window.

## Fix

- Added `reconcilePushDevice()` to atomically reconcile the current subscription and reminder plan.
- Accepts an optional `previousEndpoint` and disables/de-schedules only that endpoint when it is owned by the authenticated account.
- Preserves other devices belonging to the same account.
- Re-checks endpoint ownership before updating a current subscription.
- Uses the current subscription credentials as the authoritative registration state.
- Client remembers the last successfully reconciled endpoint per account cache scope.
- Client passes the previous endpoint only when the browser reports a different current subscription.
- Client now uses the atomic reconciliation mutation instead of separate register + reminder-sync operations.

## Security properties

- A previous endpoint is never disabled across accounts.
- The authenticated server identity remains the source of authorization; the browser cache scope is not trusted for ownership.
- Endpoint validation remains enforced for both current and previous endpoints.
- Multiple devices for one account remain supported.

## Verification performed

- TypeScript transpilation/syntax check passed for all changed source/test files.
- Source-level regression assertions added for rotation ownership and router contract.

## External verification still required

Full Vitest/project build requires the project's dependency tree and registry access. Real duplicate-delivery behavior requires a deployed HTTPS environment and at least one real browser push subscription rotation.
