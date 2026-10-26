# Track C browser privacy harness

Base: integration candidate PR #18,
`c2fd004f4a97106cd9c533efde835bbf27351087`. Separate Track C branch; no Track A/B
source branch or runtime credential is changed.

The harness loads the real production frontend in headless Chromium with a
Pixel 5 viewport/touch profile. It is a desktop browser emulation, not physical
Android performance evidence. Every external request is aborted; only loopback
static assets and explicit mocked API responses are allowed. No real users,
OAuth, Manus, billing, database or AI providers are used.

Run with the repository's pinned Node and pnpm:

```bash
bash scripts/verify-local.sh
pnpm exec playwright install chromium
pnpm test:browser
```

Linux hosts missing browser libraries can use Playwright's documented
`install --with-deps chromium` setup with appropriate machine permissions. CI
installs the browser version tied to the locked Playwright package and runs the
browser suite after the production build. No separate paid Work environment is
required. Traces, screenshots and video are disabled; never add real cookies or
storageState to fixtures or source artifacts.

Cases:

- Two same-context tabs seeded with a forged runtime identity, workspace name,
  Premium flag and browser-readable token still show the signed-out boundary
  when server identity is null. No Authorization header or workspace request is
  sent; private marker text stays hidden.
- A failed session request cannot turn local storage into authenticated state.
- The signed-out narrow-screen shell supports sequential keyboard focus and
  does not overflow horizontally.

Limitations: service workers are blocked, so these tests do not certify SW
cache/update behavior. Mocked anonymous responses do not verify real session
expiry or live logout. Authenticated cross-tab logout/account switch, delayed
writes, IndexedDB recovery, offline synchronization, screen-reader output and
physical low-memory Android performance still need their own tests. The existing
Track B sync/persistence work is not duplicated or wired here.

Rollback: stop consuming this draft harness branch. No production state or data
migration exists. Keep all release and live B58.1 gates open.

Local environment limitation on 2026-10-26: the official Chromium headless-shell
archive download failed with an invalid/truncated ZIP error. No browser test is
claimed to pass locally. GitHub's pinned browser-install and test steps are
mandatory; if either fails, this harness remains unverified until repaired.
Do not substitute mock-only Vitest results for browser execution.
