# Academic pack preparation — not release certification

This milestone remains isolated from the live B58.1 runtime. It adds a pure
manifest contract and load planner, not a downloader, a published curriculum,
a content-verification service, or a second academic authority.

## Contract and budgets

`shared/academicKnowledgePack.ts` validates schema version 1, semantic pack
versions, exact country/system/level/subject/curriculum scope, source references,
explicit topic coverage, chunk sizes, and SHA-256 digest declarations. Unknown
fields, missing source references, duplicate identifiers, and coverage without
content are rejected. HTTPS source references cannot contain embedded credentials.
A structurally valid pack still has **unverified** provenance. A source URL or
claimed digest does not establish official authority or content authenticity.

The parser limits manifests to 64 KiB of UTF-8 before JSON parsing. Content budgets
are 1 MiB per chunk and 8 MiB per pack. The deterministic planner selects requested
topics only within an exact curriculum scope, excludes already loaded chunks,
and caps each batch at 128 KiB in Data Saver or 1 MiB otherwise. Oversized chunks
remain explicitly deferred; Data Saver never silently downloads them. Inputs are
not mutated. Call the planner only with a successfully validated manifest.

These are preparation budgets, not measured device performance claims. The planner
does not fetch content, verify downloaded bytes, persist a cache, or schedule work.
Before runtime integration, implement digest/actual-size checks, cancellation,
verified provenance review, safe rendering, cache eviction, and explicit handling
of deferred content. Do not automatically treat a source URL as a fetch target.
Any future account-specific cache/outbox must use account isolation and durable
acknowledgements; auth/API responses must remain outside service-worker caches.

## Academic invariants

The existing curriculum catalogue is a scoped selection reference, not evidence
of complete curriculum coverage. This contract makes no comprehensive coverage
claim and ships no new curriculum content. `learningIntelligence` remains the sole
deterministic academic authority. A regression test verifies saved/completed lesson
activity changes neither topic mastery nor exam readiness nor assessment evidence.
NEXA remains advisory. No admission-probability model or claims are introduced.

## Verification boundary

Deterministic tests cover schema/version rejection, provenance references, coverage,
unsafe URLs, UTF-8 limits, chunk/pack budgets, scope matching, Data Saver deferral,
progression past loaded chunks, and input immutability. The learning-intelligence
regression uses local fixtures only.

Local milestone results: 728 tests in 243 files passed; TypeScript app/tests/config,
lint, formatting, 17 migration metadata checks, credential scanning, production
build, and production bundle verification passed. Node 22.23.3 and pnpm 10.4.1 use
the unchanged frozen dependency installation from milestone 1. GitHub Actions,
clean-MySQL migration application, and dependency audits are separate CI evidence;
no CI PASS is claimed for this milestone.

**BLOCKED BY B58.1 EXTERNAL GATE:** live database, OAuth callback authorization,
persisted accounts, sessions, deployed protected APIs, and live runtime errors.
This milestone does not certify B62, B63, or B64, or advance any release gate.
