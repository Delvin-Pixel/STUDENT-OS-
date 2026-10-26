# Track C runtime/security integration candidate

## Ownership and reviewed integration order

This candidate belongs to Track C. No source PR is merged and no canonical or
Track A/B branch is changed. Integration order:

1. Track A PR #14 `c59527b7daa668008dc1665ea2b4bd0f0a55e714`, including B59–B62.4.
2. Track C PR #7 `9b3cd56ef558db5051908dc9520f7bea138c9387`: logout cache eviction,
   bounded AI response reading and development dependency patches.
3. Track B PR #15 `55f072b040c75f4ae2deb27d566f0f62c9eb869e`: unwired server bridge.
4. Runtime PR #2 `b0ed6fffc6b2b1a04abeb36216bde33bcd4157fa`: shared Express app,
   Vercel function, routing, emitted-handler smoke and CI checks.

The changes apply without source conflicts. PR #14 modifies OAuth persistence;
PR #7 modifies client cleanup/LLM transport and dependencies; PR #15 adds only
server transport files. PR #2 modifies package scripts but not dependency
versions. The combined lockfile retains PR #7 fixes. No migrations are added.
PR #16 offline preflight and its upcoming persistence adapter remain Track B's
separate work; neither is wired into this candidate.

## Reproducible verification

Select Node from `.node-version` and pnpm 10.4.1, then run:

```bash
bash scripts/verify-local.sh
```

Use a clean worktree without local credentials or environment files. The command
installs frozen dependencies and runs all local source/test/config type checks,
lint, format, migration metadata, credential scan, critical tests, complete
Vitest suite, production build/bundle, emitted Vercel handler and both audits.
It does not connect to a live database or run migrations. GitHub's existing
verification workflow separately provisions MySQL 8.4, applies all migrations,
checks subscription schema and archives the exact verified revision. A green
local run does not replace that exact-revision remote check.

New HTTP tests exercise the shared production app over loopback. Invalid cookies
use real authentication rejection; cross-account and persistence-failure cases
mock only the authenticated identity/dependency. They prove rejection before
workspace reads/writes, not real OAuth, browser cookie storage or live sessions.

## New regression and repair evidence

The HTTP regression first failed because malformed JSON returned an Express HTML
error page. The candidate now returns sanitized JSON for API parser failures,
including unsupported encoding and size errors, retaining private/no-store
headers and existing body-size limits. Seven HTTP regressions cover missing or
invalid sessions, A/B reads and stale writes, authentication persistence failure,
malformed JSON and unsupported encoding. Cross-account identities are mocked;
no production login is claimed.

Thirteen quiz integration regressions use the real transport, JSON parsing and
quiz validator with mocked provider HTTP responses. They cover successful JHS,
SHS and tertiary drafts, HTML, malformed outer/model JSON, missing questions,
invalid options and answer index, oversized response, 402 credit exhaustion,
429 rate limiting and 503 gateway failure. Failure messages and logs must not
include the private upstream fixture marker. The generator does not receive or
mutate a workspace in these tests. Actual deployed quiz generation remains
blocked by runtime/provider configuration.

## Live gate and approved scope

Metadata inspection on 2026-10-26 requested no decrypted values. The only
DATABASE_URL is Secret/Preview restricted to `nexa-main`; Student OS's approved
`audit/b58.1-vercel-runtime` scope has no variables. JWT_SECRET and Student OS
OAuth configuration remain absent. Never broaden the NEXA variables.

The existing approved owner recovery destination remains
`audit/b58.1-vercel-runtime` Preview only. This candidate is not yet approved to
receive live credentials. After independent integration review, explicitly
choose the source/runtime revision and authorize any new branch scope before
live verification. Do not configure Production or assume an automatic Preview
has the correct database merely because it builds.

Minimum owner action: copy the existing connection URL in Manus Student OS task
→ Website → Database → Settings; paste directly in the same owner's desktop
browser into Vercel student-os DATABASE_URL, Secret, Preview, approved branch.
Never send the value through chat, issues, logs or source files. The cloud copy
flow is not retried here. No password rotation or new database is required.

## Required live acceptance evidence (currently BLOCKED)

- Verify provider-approved TLS chain/hostname, connectivity and non-destructive
  schema compatibility against the existing MySQL database. Never apply schema
  changes automatically; compare the 17 committed migrations and subscription
  schema first. A disposable CI migration result is separate evidence.
- Validate exact HTTPS callback allowlist and OAuth state/PKCE/replay rejection.
  Use owner sign-in when required. Never record callback codes or cookies.
- Register/login with two approved test accounts; read back persisted identity,
  refresh/reopen browser, then verify expiry and logout. Confirm failed writes
  cannot issue a session. Record statuses only, not account payloads.
- Verify A cannot load/save B data, including stale requests after switching,
  reconnect and failed retries. Test both tabs and service-worker update cycles.
- Verify protected endpoints return safe JSON, private/no-store headers and no
  account data to anonymous, invalid or expired sessions. Inspect sanitized
  runtime error categories and client bundle secret boundaries.
- Verify actual quiz routing, model schema/fallback, notification activation,
  delivery and deactivation only after their external dependencies are ready.

NEXA is advisory only. No browser-supplied account identity or mastery facts may
be promoted into trusted context. PR #15 still needs Track A's protected,
same-owner, versioned context projection contract before route wiring.

## Rollback and continuation

This branch is review-only; rollback is to stop consuming the candidate or close
its draft PR. No learner data or live credential was changed. For an authorized
future Preview deployment, retain the prior READY deployment and exact source
revision; revert/restore the prior Preview if smoke tests fail. Do not promote
to production, reset a database or run down migrations as rollback.

Next: cross-tab browser lifecycle harness; bounded advisory integration fixtures
once Track A approves the context contract; Track B owns persistence work.
B58.1 remains uncertified. B59–B67 implementation progress is not release
certification; B68–B70 remain blocked and no launch is authorized.
