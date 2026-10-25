# NEXA ↔ Student OS B62 integration readiness audit (25 October 2026)

**Status:** source-grounded discovery and implementation/test plan; **not** a completed live integration, security certification, or passing end-to-end test.

**Isolation:** branch `parallel/nexa-b62-integration-audit-20261025` was created from B62.4 draft PR #10 at `b653696388be102402eddf0881b1174866f762a2`. It does not alter `parallel/b62-4-mastery-governance`, `nexa-main`, B58.1 branches, `main`, schemas, credentials, or deployments.

## Source checkpoints inspected

- Student OS B62.3 [PR #9](https://github.com/Delvin-Pixel/STUDENT-OS-/pull/9): reviewed 25 October, HEAD `1d11a489c9554ef4ade2ed618e2fe2fc0e748c9f`; CI green as recorded in that PR, but live DB/OAuth gates remain open.
- Student OS B62.4 [PR #10](https://github.com/Delvin-Pixel/STUDENT-OS-/pull/10): observed HEAD `b653696388be102402eddf0881b1174866f762a2`; source is an intentionally **non-authoritative** mastery governance/reassessment foundation. CI was not independently asserted for this branch by this audit.
- NEXA `nexa-main`: observed tree `1f80926376dbed136588ca80f9b53f8e54310341`; `package.json` identifies v1.96.0. Its bridge uses provider contract `1.0`, bridge contract `1.0`, and context fingerprint version `sha256-v1`. Version declarations do **not** establish live service health.
- Legacy Student OS consumer: `integration/nexa-1.59.0-student-os-consumer`, including `server/nexaProvider.ts`, `server/nexaAcademicContext.ts`, and tests. This consumer is **not present** in the inspected B62.4 tree.

## Proven compatibility and integration gaps

| ID   | Priority                   | Observation                                                                                                                                                                                                      | Required safe action                                                                                                                                                                                                                                  |
| ---- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I-01 | P0 for activation          | The B62.4 development branch has no `server/nexaProvider.ts` consumer despite the legacy integration branch having one.                                                                                          | Port only scoped, reviewed server-side adapter functionality into an independent integration branch; do **not** merge the stale branch wholesale or change B62.4 logic.                                                                               |
| I-02 | P0 for activation          | NEXA can require explicit `X-NEXA-Bridge-Accept-Contract`; legacy consumer sends no such header. It may receive HTTP 428 when negotiation is required.                                                           | Explicitly offer `1.0`; handle HTTP 428/409 and unsupported server versions as incompatible; fail closed to a deterministic Student OS fallback. No server configuration relaxation.                                                                  |
| I-03 | P0 for evidence trust      | Legacy consumer verifies a minimal successful metadata pair (`contractVersion`, `academicDecisionAuthority`) but does not verify the NEXA academic-context `sha256-v1` fingerprint on return.                    | Bind the *server-owned* academic snapshot to the request and validate returned context metadata/fingerprint. Reject missing, malformed, or mismatched fingerprints for context-bearing requests; do not treat an LLM response as source attestations. |
| I-04 | P0 for mastery             | Legacy context projection labels local `learningIntelligence` estimates `Canonical mastery` and sometimes `evidence-backed`; B62.4 distinguishes those learner-local estimates from officially verified mastery. | Make provenance explicit: local estimate/advisory only. Never map B62.3 learner-generated quizzes to accepted/independent/verified evidence. NEXA-generated quiz answers are learning material, not assessment authority.                             |
| I-05 | P1 for UX                  | Current NEXA runtime may withhold model-serving during security/data-API/AI-gateway degradation; legacy consumer largely collapses HTTP failure classes into fallback reasons.                                   | Maintain fail-closed bridge admission, preserve bounded diagnostics server-side, and provide an accessible Student OS-only experience when NEXA is unavailable. No NEXA dependency for core mastery, plans, or offline essentials.                    |
| I-06 | P1 for multi-level support | Old consumer derives a topic-specific projection from a canonical workspace, not B62 context registry/policy identity.                                                                                           | Extend **only after trusted owner-bound mapping exists** to JHS/SHS/TERTIARY, explicit curriculum version, institution/program, policy scope and history. Do not infer official policy from display labels or send cross-account context.             |
| I-07 | Release blocker            | B58.1's live MySQL credentials/OAuth/session/protected API proofs remain outstanding.                                                                                                                            | Hold all live integration approval until owner-scoped authenticated read/write and server-side account isolation are verified in Preview.                                                                                                             |

## Proposed independent implementation steps (not yet executed)

1. Implement a **server-only**, feature-gated adapter on a dedicated integration branch based on an agreed B62.4 commit. Keep the existing deterministic Student OS `learningIntelligence` engine authoritative, and never allow NEXA writes to mastery, exam readiness, policies, grades, or official academic records.
2. Add explicit bridge negotiation header and version/identity/capability verification; enforce the existing tight byte/timeout/secret boundaries. Require matching academic fingerprint metadata when academic context is sent; reject mismatches without using their response as canonical evidence.
3. Build all academic projections solely from authenticated, owner-scoped server facts, not arbitrary client payloads. Treat `AssessmentEvidenceReview` and `MasteryReadiness` as advisory and read-only until their separate trusted institutional registries and ledgers exist.
4. Keep bridge disabled by default and fail soft to Student OS-only learning actions during HTTP 401/409/428/429/5xx, untrusted metadata, timeouts, offline operation, missing credentials, or NEXA security admission failure.
5. Run the full repository CI and preview authenticated E2E checks **only after** B58.1 credentials and authorization gates are satisfied. Document separate Student OS (MySQL) vs NEXA (Supabase/PostgreSQL) credential ownership.

## Regression acceptance matrix (to implement; not passing claims)

| Case                               | Required assertion                                                                                                                                           |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Version offered                    | Request contains `X-NEXA-Bridge-Accept-Contract: 1.0`; incompatible/required-version responses never become successful tutoring results.                     |
| Context fingerprint                | Valid server-supplied context returns the same `sha256-v1` binding; missing/mismatched metadata results in fallback; fingerprints do not grant mastery.      |
| Account A/B isolation              | A's identity, context, quizzes, and schedule cannot be supplied in B's NEXA request or retrieved by B.                                                       |
| JHS/SHS/tertiary                   | Scope/context mapping preserves explicit level and curriculum identity; tertiary programme required; unapproved context does not grant policy authority.     |
| Forged approvals/100% quiz         | NEXA answer or generated quiz cannot flip `verifiedMastery` or override `authoritativeMasteryEligible: false`.                                               |
| Absent credentials/offline         | Core paths still work without model service, no private browser cache leakage, no retry storm.                                                               |
| 401, 409, 428, 429, 503, timeout   | Fail-closed network result with bounded, useful fallback; no blank UI or fabricated assessment.                                                              |
| Replay, tampering and cancellation | Duplicate request IDs, altered context, oversized/malformed body, and cancelled requests cannot silently produce authoritative state.                        |
| Critical releases                  | Frozen install, TypeScript, ESLint, Prettier, full Vitest, clean MySQL migration CI, secret scan, bundle, full/production audits, authenticated Preview E2E. |

## Go/no-go rule

**NO-GO** for main merge, production enablement, or claims of official verified mastery until independent code review, CI, NEXA security/gateway operational readiness, B58.1 owner-bound database and OAuth/session recovery, and live authenticated Preview tests all pass. A green Vercel build or a green unit test suite alone is insufficient.

**Coordination:** Track A owns B62.4 academic governance and B58.1 release remediation. Track B owns adapter compatibility and regression QA. Changes must be reconciled through draft PRs, never concurrent edits to another track's branch.

## Primary code locations

- Student OS: `shared/academicContext.ts`, `shared/assessmentEvidenceReview.ts`, `shared/masteryReadiness.ts`, `server/assessmentEvidenceReview.ts`, `server/masteryReadiness.ts`, `docs/parallel/B62.4-mastery-governance.md`.
- NEXA: `lib/nexa-provider.ts`, `lib/student-os-bridge-core.ts`, `lib/student-os-bridge-readiness.ts`, `app/api/integrations/student-os/route.ts`.
- Legacy consumer: `server/nexaProvider.ts`, `server/nexaAcademicContext.ts`, `server/nexaProvider.test.ts`, `server/nexaAcademicContext.test.ts`.
