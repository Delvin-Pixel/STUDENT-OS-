# Latest Production Transformation Specification — Remediation Report

This report covers the source-verified P0/P1 repairs made after the latest uploaded specification. It is an evidence record, not a production-readiness certification.

| Area                    | Status                                    | Tested how                                                                                  | Problem found                                                                                           | Fix applied                                                                                                                           |
| ----------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Browser push endpoints  | Completed                                 | Strict endpoint, ownership, schedule, and transport regressions                             | Arbitrary public HTTPS hosts and redirects expanded server-side delivery targets                        | Exact supported browser-push host allowlist and `redirect: "error"` transport policy                                                  |
| AI abuse limits         | Completed                                 | Durable limiter and protected AI route tests; live schema review                            | Process-local counters reset on restart and diverged across instances                                   | Atomic durable account/surface counters in `ai_rate_limits`; unavailable database fails closed                                        |
| Material storage limits | Completed                                 | Upload quota, duplicate, rollback, ownership, and live schema tests                         | Only per-request size was bounded; repeated uploads had no durable account quota or content reuse       | 100-file/50 MB reservation, SHA-256 duplicate reuse, failure rollback, and metadata tables                                            |
| Material lifecycle      | Completed at controlled integration level | Full lifecycle contract, revisioned save/clear, owned access, metadata reconciliation tests | No learner removal control; stale reservations and old removed references retained application metadata | Canonical delete action, tombstones, 10-minute pending grace, aged unreferenced metadata/key release after persisted workspace change |
| Validation              | Completed                                 | `pnpm test`, `pnpm run check`, `pnpm run verify:secrets`, and `pnpm run build`              | Production bundle remains above the 500 kB warning threshold                                            | Warning documented; no unsupported dependency rewrite was introduced                                                                  |

## Final observed results

| Check                  | Result                                                                                                      |
| ---------------------- | ----------------------------------------------------------------------------------------------------------- |
| Regression suite       | **82 test files passed**                                                                                    |
| Type checking          | Passed                                                                                                      |
| Source credential scan | Passed without printing credential values                                                                   |
| Production build       | Passed; primary chunk **765.41 kB** before gzip / **229.14 kB** gzip                                        |
| Database migrations    | `0011_good_veda.sql` and `0012_daily_skullbuster.sql` reviewed and applied; live tables/constraints checked |

## Required manual acceptance

Real provider PDF processing, installed PWA push delivery on each browser family, real provider sign-in, device offline/update lifecycle, and real multi-device material deletion must be observed on physical devices. These are **REQUIRES MANUAL DEVICE / PROVIDER TEST** scenarios, not covered by the controlled automated validation above.

## B42 — Remediation Execution Loop

B42 adds a side-effect-free execution-plan layer between remediation diagnosis and learner-confirmed sessions. It bounds blocks to 10–45 minutes, reconciles existing session state, and explicitly requires fresh evidence before reassessment can close the loop. Execution completion is never treated as mastery evidence.
