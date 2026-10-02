# B58 — Free/Premium Entitlement Foundation

## Outcome

B58 introduces one server-authoritative Free/Premium entitlement model without adding live billing or paywall UI yet.

The architecture is intentionally split:

```text
Authenticated account
      ↓
server-owned subscription row
      ↓
provider-neutral entitlement resolver
      ↓
capabilities + usage-limit snapshot
      ↓
B59 UI gates / B60 server authorization
```

The synchronized `StudyState` remains academic workspace data. It does **not** contain plan, subscription, or Premium authority. A forged local workspace therefore cannot become the source of truth for Premium.

## Canonical plan model

`shared/entitlements.ts` defines:

- `free | premium`
- subscription status (`active`, `trial`, `past_due`, `canceled`, `expired`)
- provider abstraction (`none`, `paystack`, `hubtel`, `manual`)
- a stable entitlement capability list
- baseline usage ceilings
- the agreed Ghana launch catalogue price of **GHS 49/month** for Premium
- deterministic effective-plan resolution

Premium is granted only from server-owned subscription state. Missing/inactive/ended data resolves to Free. A canceled subscription remains Premium only until a recorded future paid-period end. If the entitlement store is unavailable, resolution fails closed to Free and marks authority as unavailable rather than trusting the client.

## Durable subscription storage

B58 adds the `subscriptions` table and migration `0014_student_os_entitlements.sql`.

Stored provider identifiers are server-side metadata only. The public entitlement snapshot does not return provider customer/subscription IDs.

There is intentionally no client mutation route for subscription state in B58. Future payment webhooks/reconciliation own those writes.

## Protected API

`entitlements.me` is a protected tRPC query keyed exclusively from `ctx.user.openId`.

It accepts no account ID and no client plan/status input.

## Usage limits

B58 centralizes the existing production safety ceilings in the entitlement model, but deliberately does **not** raise Premium limits yet. AI, workspace, and study-material limits still use the same safe baseline for both plans.

B60 will connect per-plan usage authorization after cost/load validation. This avoids accidentally making a new Premium plan an unlimited-cost path.

## B56/B57 debt fixed during the pre-B58 audit

- Fixed the B56 `addDays(...)` string/`.toISOString()` type defect.
- Removed a duplicated ~900-line workspace-schema copy that had been accidentally bundled inside `transitionDecision.ts`; `shared/workspaceSchema.ts` is again the single workspace validator.
- Corrected the WASSCE science-track regression fixture: the sample grades sum to 17, not 16.
- Capacity below 10 minutes now schedules nothing instead of exceeding the learner's stated limit.
- Oversized fitted steps now advance across days instead of stacking multiple full-capacity blocks on the same day.
- B57 now scopes completion to transition-linked subjects instead of allowing unrelated strong foundation checks to close the loop.
- Due transition-linked foundation checks require a fresh recheck.
- Removed the unused B57 normalization debt by using normalized subject scoping.
- Simplified next-step selection to the first execution step.
- Wired adaptive execution + closed-loop status into the Transition UI.
- Repaired a pre-existing syntax defect in the service-worker activation integrity test so the full source tree parses cleanly.

## Transition provenance hardening

- A locally calculated WASSCE aggregate is now labeled `calculated_local`, not `official`.
- Typing a source URL no longer auto-promotes an option to `official`.
- Manual UI cannot mark a source as Student-OS-verified official.
- `official` confidence is trusted only when both a HTTPS source URL and a `sourceVerifiedAt` timestamp exist.
- Unverified official claims no longer receive the official ranking boost and keep transition readiness evidence-gated.

## Verification target

Automated tests were added for:

- Free fallback
- active Premium
- canceled-until-period-end Premium
- expired/past-due fail-closed behavior
- agreed Premium catalogue price
- server entitlement lookup and store-unavailable fail-closed behavior
- protected `entitlements.me` account binding
- sub-minimum execution capacity
- oversized multi-day fitting
- unrelated foundation evidence isolation
- due foundation recheck behavior
- unverified official-source provenance

Verification completed in the extracted B58 workspace:

- 492 TypeScript/TSX source and test files (excluding declaration files) transpile with **0 syntax diagnostics**.
- Focused runtime assertions passed for entitlement resolution, transition provenance/readiness, B56 adaptive scheduling, and the B57 closed loop.
- Drizzle journal/snapshot JSON parses successfully and the B58 snapshot contains the `subscriptions` table.
- Credential/source secret scan reports no likely credential literals.

The full dependency-backed `pnpm check`, Vitest suite, and production build remain blocked in this environment because project dependencies cannot be restored from the npm registry. This checkpoint therefore does **not** claim a full-suite/build pass.

## Next checkpoint

**B59 — Premium UX + feature gates**

B59 should consume `entitlements.me`; it must not create a second client-owned Premium source of truth.
