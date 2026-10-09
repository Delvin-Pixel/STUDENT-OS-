# NEXA 1.66.0 — Branch-Local Vercel Deployment Isolation

NEXA 1.66.0 removes the shared-project deployment conflict that previously required operators to temporarily change the existing `student-os` Vercel project's Output Directory before every NEXA deployment. The root `vercel.json` now explicitly declares `outputDirectory: ".next"` alongside the existing Next.js framework, `npm ci` install command, and `npm run build` build command.

Vercel project configuration remains Student OS-owned and may keep its Vite `dist/public` output setting. NEXA's repository-local deployment configuration takes precedence for NEXA branches, so normal Git-triggered NEXA deployments can build and publish the Next.js application without mutating shared project settings or risking Student OS deployment behavior. This preserves the existing single Vercel project as requested; no replacement project or account is introduced.

The configuration was proven against the existing shared project before release: with the project-level Student OS output setting left in place, the branch-local `.next` override produced a READY NEXA deployment. The release gate now locks the exact framework/install/build/output contract and rejects regressions back to `dist/public`, pnpm, Docusaurus, or generic build-directory assumptions.

This release adds no database migration: migrations 001–041 remain immutable. Student OS `main` and its deterministic `learningIntelligence` authority are unchanged.

---

# NEXA 1.65.0 — AI Gateway Operational Readiness

NEXA 1.65.0 closes the false-green deployment state discovered during live v1.64 runtime verification. A configured `AI_GATEWAY_API_KEY` is no longer treated as proof that model-backed capabilities are usable. Readiness now performs a cached, zero-model-cost AI Gateway preflight that verifies authentication through the credits endpoint, confirms the configured NEXA model is present in the Gateway catalog, confirms that the model currently exposes at least one provider endpoint, and distinguishes available from exhausted Gateway credits without invoking an inference.

The operational probe never returns the API key, raw billing balance, lifetime spend, provider credentials, or model output. Public readiness exposes only bounded safe state: operational/degraded/missing, a coarse reason code, available/exhausted/unknown credit state, configured model identity, model availability, and provider count. Results are cached for 30 seconds and bounded by a short network timeout so provider-control-plane latency cannot turn liveness into an expensive or unbounded dependency.

`GET /api/health/live` remains local and non-billable. `GET /api/health/ready` now requires the database, rate-limit secret, and AI Gateway operational preflight to be healthy before returning 200. The authenticated Student OS bridge health endpoint uses the same operational Gateway state, preventing Student OS from admitting a learner request when NEXA has credentials but cannot actually reach a funded model provider. Configuration-only capability diagnostics remain separate from operational readiness.

This release adds no database migration: migrations 001–041 remain immutable. The release gate adds dedicated AI Gateway readiness contract tests for missing credentials, timeout, authentication failure, exhausted credits, missing model, missing provider endpoints, and the fully operational state. Student OS deterministic `learningIntelligence` remains the sole academic decision authority, and no paid model call is required by CI.

---

# NEXA 1.64.0 — Academic Context Snapshot Binding & Provenance

NEXA 1.64.0 binds every successful Student OS provider response to the normalized deterministic academic context that produced it. When Student OS supplies `academicContext`, NEXA now computes a domain-separated SHA-256 fingerprint over the normalized authority marker, snapshot ID, evidence list, and host constraints. The result metadata carries binding version `sha256-v1`, the bounded snapshot ID, the 64-character fingerprint, and evidence/constraint counts. Requests without academic context keep `metadata.academicContext = null`.

The binding is computed after NEXA's existing context normalization, so insignificant surrounding whitespace does not change the fingerprint while any material snapshot, evidence, or constraint change does. The fingerprint never grants NEXA academic authority: Student OS deterministic `learningIntelligence` remains the sole authority for mastery, readiness, prerequisites, remediation, transitions, and next-best-action decisions. NEXA only proves which host-owned context its conversational output was generated against.

The private Student OS bridge echoes the binding fingerprint through `X-NEXA-Academic-Context-SHA256` on successful responses and on durable idempotent replays. Because the existing bridge request hash already includes the complete request envelope, reusing a request ID with different academic context remains a mismatch and is rejected before provider execution. The authenticated readiness endpoint advertises `academicContextBindingVersion` so Student OS can detect support before enforcing the binding.

This release adds no database migration: migrations 001–041 remain immutable. The release gate adds a dedicated academic-context binding contract test covering normalization stability, fingerprint sensitivity, bridge propagation, replay propagation, readiness advertisement, and the no-migration boundary.

---

# NEXA 1.63.0 — Privacy-Bounded Student OS Bridge Observability

NEXA 1.63.0 adds dedicated operational telemetry for the private Student OS bridge without mixing external Student OS identities into NEXA account telemetry. Migration 041 creates `student_os_bridge_events`, a bounded event ledger for authenticated bridge traffic covering claim/recovery, admission throttling, idempotency mismatch/in-progress/replay, completion, failure, and ownership-loss outcomes.

The observability ledger deliberately stores no prompt text, response body, arbitrary metadata JSON, or raw Student OS user ID. External user identities are HMAC-pseudonymized with the existing server-only `RATE_LIMIT_SECRET`; stored fields are limited to the pseudonymous user fingerprint, bridge/server request IDs, capability, lifecycle event, HTTP status, bounded duration, optional rate-limit scope, optional provider success state, and timestamp.

Bridge event recording is fail-soft and cannot break request handling. Lifecycle events are emitted only after successful bridge authentication and Student OS identity fencing. Operators can correlate retries and recoveries by request ID, inspect coarse latency/outcome patterns, and retain events independently from the 24-hour replay ledger. Expired observability records are included in the explicit `ops:prune` retention path.

A dedicated PostgreSQL integration test verifies migration 041, confirms the schema contains no raw external identity/prompt/response/metadata columns, enforces the fingerprint constraint, proves lifecycle persistence, and exercises retention deletion. Existing migrations 001–040 remain immutable. Student OS deterministic `learningIntelligence` remains the sole academic decision authority.

---

# NEXA 1.62.0 — Durable Student OS Bridge Idempotency & Replay Safety

NEXA 1.62.0 adds a dedicated durable replay ledger for the private Student OS bridge so repeated delivery of the same accepted bridge request does not trigger a second model call. The ledger is keyed by the external Student OS user identity plus the bounded bridge request ID and stores a canonical request hash, capability, execution lease, terminal response, recovery count, and a 24-hour expiry.

The bridge flow is now: authentication → Student OS user-identity fencing → admission control → durable request claim → provider/model execution → owner-fenced terminal commit. A completed duplicate replays the exact saved JSON response with no provider creation. A live duplicate receives a retryable 409 in-progress response. Reusing the same request ID with a different payload is rejected. If an owner crashes and its 90-second execution lease expires, a later identical request may recover ownership while stale owners are fenced from committing.

Migration 040 creates `student_os_bridge_requests` as a separate external-integration ledger rather than forcing Student OS identities into NEXA account idempotency tables. Existing migrations 001–039 remain immutable. Expired bridge replay records are included in the explicit operator prune path, and a PostgreSQL integration test verifies uniqueness, exact replay storage, lease recovery, stale-owner fencing, and the additive migration.

Admission control still runs before the durable claim, so retries remain subject to the cost-protection ceilings introduced in 1.61. Student OS deterministic `learningIntelligence` remains the sole academic decision authority.

---

# NEXA 1.61.0 — Student OS Bridge Admission Control & Cost Protection

NEXA 1.61.0 hardens the private Student OS bridge against accidental or abusive model traffic without changing the provider contract or Student OS academic authority. Authenticated bridge requests now pass three durable PostgreSQL-backed admission ceilings before a provider is created: a global per-minute ceiling, a per-user per-minute ceiling, and a per-user per-hour ceiling.

The default limits are 300 requests/minute globally, 30 requests/minute per Student OS user, and 300 requests/hour per Student OS user. Each limit is configurable through bounded server-only environment variables. Invalid admission configuration degrades bridge readiness instead of silently disabling protection. Production readiness also requires the existing 32+ character RATE_LIMIT_SECRET used to HMAC bridge bucket identities.

Rate-limited requests return HTTP 429 with Retry-After, standard rate-limit metadata, the active NEXA/provider headers, the accepted bridge request ID, and a coarse bridge limit scope. Admission happens only after bridge authentication and user-identity fencing, but before createNexaProviderAdapter or any model execution.

The existing rate_limit_buckets table from migration 010 is reused, so no new migration is required and migrations 001–039 remain immutable. A PostgreSQL integration test proves independent durable global/user minute/hour buckets, ceiling rejection, and expired-bucket reuse. Student OS deterministic learningIntelligence remains the sole academic decision authority.

---

# NEXA 1.60.0 — Bridge Reliability & Operational Readiness

NEXA 1.60.0 hardens the Student OS integration introduced in 1.59 without expanding the provider contract or changing academic authority. The release adds an authenticated, zero-model-cost readiness endpoint at `GET /api/integrations/student-os/health` so deployment operators can verify bridge authentication, AI runtime configuration, provider contract version, capability surface, and Student OS authority metadata before sending a learner request.

Bridge request IDs are now constrained to a header-safe correlation format and echoed back through `X-NEXA-Bridge-Request-Id` after successful admission. Bridge responses also expose the active `X-NEXA-Version` and provider contract version while remaining `Cache-Control: no-store`. The readiness response never returns the configured bridge secret and never invokes a model.

A dedicated `ops:smoke-student-os-bridge` command verifies the deployed readiness endpoint with the server-to-server bridge secret and checks the exact six-capability surface, contract version, NEXA version header, authority marker, and ready state. Existing live provider smoke checks remain separate, so this operational check costs no AI call.

The general capability diagnostics configuration now includes the Student OS bridge readiness state. No database migration is required; migrations 001–039 remain immutable, and Student OS deterministic `learningIntelligence` remains the sole academic decision authority.

---

# NEXA 1.59.0 — Student OS Bridge & Consumer Integration

NEXA 1.59.0 exposes the verified 1.58 provider adapter through a private, server-to-server Student OS bridge. The bridge accepts only the six versioned provider capabilities, requires a dedicated 32+ character bearer secret, requires the authenticated Student OS user identity in both the request body and a matching server-only header, bounds request bodies before JSON parsing, and returns no-store responses.

The bridge delegates directly to `createNexaProviderAdapter`, so Student OS receives the same fail-soft provider result contract while the adapter remains side-effect-free. No browser receives the bridge secret or endpoint credentials, and the bridge does not expose NEXA memory writes, artifacts, workflows, project mutations, external research tools, or the normal NEXA chat persistence path.

Student OS remains authoritative for mastery, readiness, prerequisites, remediation, transitions, and next-best-action decisions. The companion Student OS integration branch derives any academic evidence from its validated workspace and canonical deterministic learning intelligence before calling this bridge. If the bridge is disabled, unavailable, or rejects a request, Student OS keeps its existing server tutor and local fallback behavior.

The release adds no database migration; migrations 001–039 remain immutable.

---

# NEXA 1.58.0 — Student OS Provider Runtime Adapter

NEXA 1.58.0 turns the stable 1.57 provider contract into an actual callable runtime adapter for Student OS. `createNexaProviderAdapter` binds an adapter instance to one Student OS user identity, validates and bounds every request, preserves the six contract capabilities, and maps runtime failures into the contract's fail-soft `unavailable`, `timeout`, `rate_limited`, or `error` results without exposing internal provider errors.

The default adapter uses NEXA's configured AI SDK runtime through `ToolLoopAgent.generate`, but intentionally exposes no NEXA write tools, project mutation tools, memory writes, workflows, artifacts, or external research capabilities. That keeps this first integration path side-effect-free: Student OS can ask NEXA to chat, explain, tutor, generate material or quizzes, and coach without allowing a conversational call to mutate application state.

Academic context remains explicitly subordinate to Student OS's deterministic `learningIntelligence`. The adapter validates the `student-os-learning-intelligence` authority marker, bounds evidence and constraints, treats supplied evidence as data rather than an instruction hierarchy, and repeatedly states that NEXA may not promote, demote, redefine, or override mastery, readiness, prerequisite, remediation, transition, or next-best-action decisions.

A no-provider-cost integration harness exercises request normalization, academic-authority fencing, prompt construction, size limits, failure classification, identity binding, timeout wiring, and side-effect isolation. No database migration is required; migrations 001–039 remain immutable.

---

# NEXA 1.57.0 — Stable Student OS Provider Contract

NEXA 1.57.0 introduces the first stable, provider-neutral boundary between NEXA and Student OS. The contract deliberately keeps Student OS's deterministic `learningIntelligence` layer authoritative for mastery, readiness, prerequisite, transition, and next-best-action decisions; NEXA is an explanatory and conversational assistant and may not override those academic decisions.

`lib/nexa-provider.ts` defines the versioned `NexaProvider` contract with six explicit capabilities: `chat`, `explain`, `tutor`, `generateMaterial`, `generateQuiz`, and `coach`. Requests carry host-owned identity plus optional bounded academic context tagged with the Student OS authority marker. Results use a fail-soft discriminated union so Student OS can remain functional when NEXA is unavailable, timed out, rate limited, or returns an internal error.

The contract includes immutable policy metadata declaring that NEXA cannot override academic decisions and that Student OS core functionality must not require NEXA. A runtime provider guard checks the contract version, exact capability surface, and callable methods before integration. This release adds no database migration and does not connect Student OS runtime code yet; it establishes and verifies the integration seam first.

---

# NEXA 1.56.0 — Trusted Web Research & Durable External Provenance

NEXA 1.56.0 hardens live web research and makes its supporting sources durable. The live `tako_search` tool is now classified as an external, untrusted capability: it consumes the dedicated external-tool budget, duplicate retries are fenced, and returned payloads are wrapped as untrusted context before the model sees them. This aligns runtime behavior with NEXA's existing prompt-injection policy instead of treating web payloads like ordinary trusted reads.

A new bounded provenance collector inspects the raw provider result before trust wrapping and retains only safe source metadata: HTTP(S) URL, title, short excerpt, provider, and an optional source timestamp. Full web payloads, hidden prompts, credentials, and arbitrary page contents are not persisted. Up to eight deduplicated external source snapshots may be attached to a single assistant message.

Migration 039 adds `assistant_message_external_sources` with message/conversation ownership fences, bounded `W1`–`W8` labels, HTTP(S)-only URL checks, per-message URL uniqueness, and message-delete cascade cleanup. External sources are committed in the same fenced transaction as the assistant message, hydrated after conversation reload, exposed as safe source cards with explicit outbound links, and included in account export schema 1.23.

The release gate adds static trust/provenance contracts plus a real PostgreSQL integration test proving owner fencing, URL scheme enforcement, bounded labels, and cascade cleanup. No live paid web call is required by CI.

---

# NEXA 1.55.0 — Canonical Source Promotion

NEXA 1.55.0 promotes the verified application source into ordinary Git-tracked files on the dedicated `nexa-main` branch. Student OS `main` remains separate and untouched. Future NEXA releases branch from `nexa-main` instead of replaying the historical 1.48→current payload reconstruction chain.

The canonical branch runs normal source CI directly against `package.json`, the committed lockfile, migrations, TypeScript, regression suites, PostgreSQL integration tests, integrity checks, and the production build. A dedicated canonical-source contract fails if `.nexa-verify` reconstruction payloads or reconstruction steps reappear.

The canonical CI also upgrades GitHub-hosted action runtimes to current Node-24-compatible majors, preserves verification evidence and a source artifact, and keeps the exact Node 22.16.0 / npm 10.9.2 application toolchain pinned. No application-schema migration is required; migrations 001–038 remain immutable.

---

# NEXA 1.54.0 — Capability Health & Safe Live Smoke Diagnostics

NEXA 1.54.0 closes the deployment-verification gap left intentionally by voice, semantic retrieval, and durable rich-file extraction. Normal liveness/readiness endpoints remain cheap and non-billable; live provider probes live behind a separate deployment-only operator endpoint that is disabled unless `NEXA_DIAGNOSTICS_ENABLED=true` and a 32+ character `NEXA_DIAGNOSTICS_TOKEN` is configured.

`GET /api/health/capabilities` reports configured models/capability readiness without calling a provider. `POST /api/health/capabilities` runs only the explicitly requested live checks. Chat and embedding probes use the configured production model paths; rich extraction reuses the same file-signature validation and extraction helper as project knowledge; voice reuses the normal transcription validator and requires an explicit bounded audio fixture. Results return status, model, latency, bounded metadata, and coarse error codes only—never generated text, transcripts, uploaded bytes, credentials, or hidden prompts.

`scripts/smoke-capabilities.mjs` provides a deployment CLI. Its default live set is chat + embedding + a tiny built-in rich-image probe; voice is opt-in with `NEXA_SMOKE_VOICE_FILE`. Smoke fixtures are capped at 512 KB and the endpoint uses `Cache-Control: no-store`. CI verifies the diagnostics contracts but does not make paid external provider calls.

---

# NEXA 1.53.0 — Grounded Answers & Durable Source Provenance

NEXA 1.53.0 makes project-grounded answers inspectable. Retrieval now assigns deterministic `[S1]`…`[S12]` labels to the bounded project evidence actually supplied to the model, instructs the model to cite only those labels when it relies on them, and persists the retrieved source snapshots alongside the assistant message in the same fenced commit path. The database—not model output—remains authoritative about which sources were retrieved for the turn.

Migration 038 adds `assistant_message_sources` with message/conversation ownership fences, bounded source labels, source type/ID, title, excerpt, retrieval mode, relevance, and source timestamp snapshots. Snapshots deliberately do not foreign-key back to mutable project files, memories, artifacts, workflows, or conversations used as evidence, so a grounded answer remains explainable after a source is renamed or deleted. Deleting the assistant message or owning conversation still cascades the provenance rows.

Conversation reloads hydrate source cards under assistant messages, and the web client refreshes the persisted turn after streaming finishes so source cards appear without a manual reload. Account export schema 1.22 includes `assistant_message_sources`. Raw hidden prompts, embeddings, and binary project-file blobs remain excluded.

The release gate adds static grounding contracts plus a real PostgreSQL integration test for owner fencing, bounded source labels, and message-delete cascade behavior. `[S#]` labels describe retrieved project evidence only; live web/tool sources continue to use their provider-specific citation mechanisms.

# NEXA 1.52.0 — Durable Rich Project Knowledge

NEXA 1.52.0 closes the persistence gap intentionally left by 1.49: project knowledge can now keep bounded PDFs and images, not only text-like files. The original rich source is stored in a user/project-fenced `bytea` row with independent size and SHA-256 integrity metadata, while `project_files.content` remains the single derived searchable-text contract used by lexical and semantic retrieval.

Rich-file ingestion validates PDF/JPEG/PNG/WebP/GIF signatures, enforces per-file and per-project plan limits, stores the original without injecting it into unrelated prompts, and runs provider-neutral extraction through the existing AI Gateway. Extraction is fail-soft: a failed or unavailable extractor leaves the source safely stored and retryable; successful extraction atomically replaces the placeholder with bounded derived text, refreshes the content hash/version, and invalidates/rebuilds the semantic index.

The Files workspace can upload rich sources, show extraction state, retry extraction, open the original source through an authenticated no-store endpoint, and continue using the same list/read/search tools. Account export schema 1.21 includes rich-source metadata and derived text but deliberately excludes raw `project_file_blobs` from the one-click JSON export because the binaries can be retrieved individually through the authenticated source endpoint.

The release gate adds rich-file contract tests and a real PostgreSQL integration test proving composite ownership fencing, byte-length integrity, and project/file cascade cleanup. CI does not make an external rich-file extraction call; provider wiring is verified through source/type/build contracts and a live extraction smoke test remains a deployment check.

# NEXA 1.51.0 — First-Class Voice Input

NEXA 1.51.0 completes the provider-neutral voice seam that earlier releases intentionally left unfinished. The web client can now capture a bounded microphone recording, send it to an authenticated transcription endpoint, preview the resulting transcript, and submit that transcript through the same durable chat/idempotency path as typed input.

Voice is transcribe-and-discard: raw audio is never written to NEXA's database or account export. The server validates the declared audio format against binary signatures, applies plan-aware byte/duration/rate limits, uses a hard transcription timeout with bounded retries, and returns only transcript text plus safe language/duration metadata. The chat layer persists the transcript as ordinary user-visible text and avoids injecting the same transcript twice into model context.

The transcription provider is configurable with `NEXA_TRANSCRIPTION_MODEL` and uses the existing AI Gateway. The default is `google/gemini-3.5-transcribe`; deployments can switch providers without changing the chat, persistence, or UI contract. If the gateway is not configured or transcription fails, the request fails closed without consuming a normal chat turn.

## 1.51 Verification Additions

The release gate adds voice contract tests covering authenticated bounded transcription, MIME/signature checks, provider-neutral AI SDK wiring, microphone cleanup, transcript de-duplication, and chat request propagation. No live microphone or external transcription call is required by CI.

# NEXA 1.50.0 — Hybrid Semantic Project Intelligence

NEXA 1.50.0 adds a fail-soft semantic retrieval layer for persistent project knowledge files without replacing the deterministic PostgreSQL full-text path introduced in 1.49. Project files remain the user-controlled source of truth; semantic vectors are derived, hash-fenced, bounded, and disposable.

Migration 036 adds per-file semantic index state plus bounded chunk embeddings. New or edited file content invalidates its previous vectors inside the same database transaction. The active file SHA-256 must match the embedding SHA-256 before a semantic match can participate in retrieval, so stale vectors are never trusted.

Semantic indexing uses the existing AI Gateway through AI SDK embeddings. The default model is `openai/text-embedding-3-small` with 512 dimensions, up to eight sampled chunks per file, bounded retries, and a hard timeout. If the gateway is missing or an embedding call fails, NEXA records a safe failure state and continues using lexical project search.

Project intelligence now merges lexical and semantic file matches, labels each file result as lexical, semantic, or hybrid, and keeps exact file reading behind the existing `read_project_file` tool. The Files workspace exposes semantic status and an explicit Reindex action. Account export schema 1.20 includes semantic index state but deliberately excludes raw embedding vectors because they are derived and can be regenerated.

## 1.50 Verification Additions

The release gate adds semantic contract tests plus a real PostgreSQL integration test proving composite ownership fencing, current-content hash freshness, and cascade cleanup for semantic state/chunks. No external embedding call is required by CI.

# NEXA 1.49.0 — Persistent Project Knowledge Files

NEXA projects can now own persistent textual knowledge files that stay available across conversations. Files are isolated by user and project, size-bounded by plan, integrity-hashed with SHA-256, versioned for safe updates, searchable through PostgreSQL full-text indexes, visible in a dedicated Files workspace, and readable by NEXA through capability-aware tools.

Supported 1.49.0 project knowledge types are text, Markdown, CSV, JSON, HTML, CSS, JavaScript/TypeScript, Python, SQL, and XML. Binary/PDF/image persistence is intentionally deferred so this release keeps retrieval deterministic and auditable while the storage layer remains PostgreSQL-backed.

## Project Knowledge Files

Migration 035 adds the additive `project_files` schema without modifying migrations 001–034. Project files use a case-insensitive per-project filename uniqueness guard, a full-text search index, exact UTF-8 byte accounting, content hashes, and optimistic versions. The project intelligence retriever now ranks matching project files alongside conversations, artifacts, memory, and workflow state.

NEXA exposes read-only `list_project_files` and `read_project_file` tools for project-backed requests. File creation, rename, replacement, and deletion remain explicit user workspace actions through bounded APIs, preserving the distinction between user-provided project knowledge and assistant-generated artifacts.

## 1.49 Verification Additions

The release gate adds static project-file contract tests and a real PostgreSQL integration test covering full-text retrieval, case-insensitive filename uniqueness, and project-delete cascade behavior. Account export schema 1.19 now includes project files.

## Execution Attempt Lifecycle Events

Every leased workflow execution now receives a durable execution attempt ID. The attempt records its lifecycle state, acquisition time, heartbeat time, and terminal reason. Lease heartbeats update the attempt, lease loss marks it terminal, and workflow shutdown paths finalize it as completed, failed, cancelled, aborted, or lease_lost.

The Activity Trace exposes only the safe attempt identity and lifecycle status. Operator stale recovery marks expired running attempts as recovered before removing their lease, while maintenance pruning and account export include the new operational records.

The existing PostgreSQL execution lease remains authoritative for single-owner workflow execution; the attempt ledger adds durable identity and observability without replacing the lease guard.

## Execution Liveness & Watchdog State

Running execution attempts now expose bounded, database-derived liveness state: heartbeat age, lease remaining time, and a health classification of healthy, heartbeat_delayed, or lease_expired. The Activity Center surfaces degraded execution state without performing recovery automatically; operator stale recovery remains the recovery authority.

## Execution Health Policy & Detail View

Execution heartbeat grace is now bounded and configurable through NEXA_EXECUTION_HEARTBEAT_GRACE_MS (5–60 seconds, default 15 seconds). The Activity Center surfaces a bounded live execution-health view with heartbeat age and remaining lease time while preserving the existing operator-only recovery model.

## Release verification

NEXA 1.48.1 is a hardening-only patch built from the immutable 1.48.0 FINAL baseline. It keeps the same product surface while tightening release reproducibility and database-upgrade assurance: the committed lockfile is the only dependency input, migration SQL is SHA-256 pinned, historical upgrade fixtures cover migrations 028/031/034, telemetry fences can be validated after legacy repair, verification evidence is preserved as release artifacts, and AI SDK 7 compatibility aliases are replaced with their native names.

The PostgreSQL integration test proves stale chat-turn ownership is fenced, a response insert rolls back if the lease expires before terminalization, recovered turns preserve the original conversation/user message and quota marker, and a successful recovery stores exactly one assistant response.

## Execution Attempt History

Adds bounded, cursor-paginated conversation execution-attempt history and keeps loaded Activity timeline pages during background refresh.

## Execution Attempt Detail

Adds a bounded, conversation-scoped execution-attempt detail endpoint and Activity Center view keyed by immutable attempt ID. Lifecycle events are presented in deterministic sequence order without exposing raw event details.

## Exact Execution Correlation

AI and tool telemetry may now carry the durable execution attempt ID for workflow-backed requests. Indexed nullable foreign keys keep non-workflow telemetry supported, while Activity Timeline/Trace and account export preserve the safe correlation identity.

The operator execution-integrity check also validates AI/tool telemetry ownership against the linked attempt.


## Exact Correlation Write Guard

AI and tool telemetry now validates execution-attempt ownership (user, workflow, and conversation) inside the same transaction as the telemetry write. Invalid cross-context attempt IDs are rejected without exposing internal database details.


## Attempt-Scoped Execution Trace

An immutable execution attempt can now be inspected through a bounded trace that merges its AI telemetry, tool telemetry, and lifecycle events without exposing raw prompts, tool arguments, hashes, or internal errors.



## Workflow Telemetry Correlation Enforcement

Workflow-linked AI and tool telemetry must include a valid durable execution attempt. Correlation is enforced inside the telemetry transaction; non-workflow telemetry may omit an attempt ID. Terminal or recovered attempts are fenced from new telemetry writes.

Attempt-scoped trace reads now use a repeatable-read, read-only PostgreSQL snapshot. Pagination cursors carry the snapshot boundary so later pages remain point-in-time consistent.


## Execution Fencing

Workflow-linked AI and tool telemetry is now fenced to running execution attempts. PostgreSQL also enforces workflow/attempt identity at the schema boundary for new writes, while NOT VALID constraints preserve compatibility with historical telemetry that predates durable attempt correlation.


## Attempt-Addressed Cancellation

Workflow cancellation can now target a specific active execution attempt. The server locks the workflow and attempt together, rejects stale attempt IDs, and treats repeated cancellation of the same attempt as idempotent. The Activity Center sends the immutable attempt ID when available.


## Cancellation Event Ordering Correction

Attempt-addressed cancellation now records the terminal lifecycle event while the attempt row is still running, then commits the terminal status in the same transaction. This preserves the lifecycle-event writer's terminal-state guard.

## Historical release — AI execution-attempt terminal fencing

AI run terminal updates are now fenced by the linked execution attempt. Late provider callbacks cannot complete or fail AI telemetry after the attempt becomes terminal.


## Historical release — Attempt-fenced assistant message persistence

Workflow assistant responses are now stored with their durable execution attempt ID. Message persistence locks the matching workflow attempt and requires it to remain running, preventing cancelled, recovered, lease-lost, or otherwise terminal attempts from appending late assistant messages.

## Historical release — Chat-turn idempotency claim correctness

Durable chat-turn idempotency now distinguishes the request that successfully inserts a new turn from concurrent duplicate requests. The first request owns the new `running` record and proceeds; only later requests with the same key are reported as in progress or replayed after terminalization.

Pre-stream workflow conflicts now terminalize any claimed chat turn before returning, preventing durable idempotency rows from remaining stuck in `running`. The web client also limits automatic retries to transport uncertainty and explicit `in-progress` duplicate responses instead of retrying deterministic HTTP failures.

The pre-release audit also repaired three compile-time correctness defects: outer chat error finalization now retains the authenticated user ID safely, workflow lease assertions are explicitly imported, and tool telemetry recovery context carries `workflowId`. The TypeScript `@/` source alias is now declared in `tsconfig.json`.

The same compiler-guided pass repaired stale execution-attempt API helper imports, a missing workflow-route database import, request-boundary typing for memory/artifact metadata, activity cursor field naming, execution trace rank typing, event-cursor narrowing, and the `PoolClient` type import.



## NEXA 1.47.0 — Crash-safe chat-turn recovery

Durable chat turns now carry a renewable execution lease and immutable owner-attempt token. A duplicate request still receives `in-progress` while the current lease is healthy, but a request whose owner disappeared can be reclaimed after the lease expires instead of remaining blocked for the full 24-hour idempotency TTL.

Recovered ownership is fenced through quota admission, user-message initialization, workflow attachment, and the final assistant-message commit. The assistant response and chat-turn completion are committed in the same database transaction, so a stale process cannot append a late response after another request has taken ownership. Quota consumption and the initial conversation/user-message write are also durable per turn, preventing recovery from double-charging daily usage or duplicating the user message.

Workflow-backed chat recovery may explicitly supersede the previous workflow execution lease when that lease belongs to the request whose expired chat-turn lease was reclaimed. The replaced workflow attempt is terminalized as `lease_lost`, preserving the existing attempt-level fencing and lifecycle audit trail.

The web client keeps the same idempotency key across bounded retries long enough to cross the 15-second chat-turn lease window, allowing a transport-interrupted request to replay a completed response or reclaim a truly stale execution without generating a second logical turn.


## NEXA 1.48.1 — Reliability and provenance hardening

This patch intentionally adds no product features. The release gate now treats `package-lock.json` as frozen input, verifies the lockfile remains byte-identical through install, checks every migration file against `db/migration-checksums.json`, records/verifies migration digests in `schema_migrations`, validates telemetry correlation fences, exercises populated historical upgrade fixtures for migrations 028, 031 and 034, preserves a release manifest/SBOM/verification log, and uses AI SDK 7-native `isStepCount` / `onStepEnd` APIs.

Operational rule: migrations 001–034 are immutable. `NOT VALID` telemetry fences must only be marked valid after the integrity checks report no historical mismatches.

## NEXA 1.48.0 — Dependency-backed release verification

This release candidate converts the previous verification limitation into an executable CI contract. `npm run verify:deps` checks that every direct dependency is installed at the exact version declared in `package.json`. `.github/workflows/verify.yml` uses Node 22.16.0, npm 10.9.2, and PostgreSQL 17; generates a lockfile for the run; restores it with `npm ci`; applies the full migration chain; and runs `npm run verify:ci`.

`npm run test:postgres-chat-recovery` is a real database integration test for the 1.47 crash-safe chat-turn design. It reclaims an expired owner, confirms the stale owner cannot continue, deliberately lets the recovered lease expire after inserting an assistant message to prove the surrounding transaction rolls that message back, renews ownership, commits the response, and verifies one user message, one assistant message, one quota charge, and a valid replay lookup.

NEXA 1.48.0 FINAL is the immutable source baseline for this patch line. Do not regenerate its dependency tree or edit migrations 001–034; any future application-schema change must be additive and use a new migration number.
