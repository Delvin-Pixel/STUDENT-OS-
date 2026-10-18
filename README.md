# NEXA 1.94.0 — Data API Remediation Readiness

NEXA 1.94.0 makes the Supabase Data API security blocker operationally actionable without pretending the connected runtime can alter provider-owned defaults. General readiness and authenticated Student OS bridge readiness now expose a bounded remediation state alongside effective Data API security.

The remediation state reports only four things: whether remediation is unnecessary, requires an account-owner action, requires security review, or is unavailable; the recommended bounded action; whether SQL remediation is feasible; and a coarse attestation reason when the plan cannot be determined. Raw ACL rows, role names, object names, privilege counts, credentials, API keys, prompts, response bodies, and user data are never returned by runtime readiness.

When the Data API platform is disabled, remediation is `no-action`. When the platform is enabled and future-default risk exists, NEXA evaluates whether the current database identity is actually authorized to alter the owner of those risky defaults. A protected owner yields `owner-action-required` with the recommended action `disable-data-api-in-dashboard` and SQL feasibility `blocked-by-default-owner`. NEXA does not attempt `ALTER DEFAULT PRIVILEGES`, `GRANT`, or `REVOKE` automatically.

Authenticated Student OS bridge health mirrors the same bounded state through JSON plus remediation status/action/SQL-feasibility headers. The existing effective-security gate is unchanged: insecure Data API state still blocks model-backed bridge admission. This release only makes the correct remediation path explicit.

No database migration is introduced; migrations 001–047 remain immutable. NEXA provider, fallback, and bridge transport contracts remain unchanged, and Student OS deterministic `learningIntelligence` remains the sole academic decision authority.

---

# NEXA 1.93.0 — Effective Data API Security Reconciliation

NEXA 1.93.0 reconciles Supabase Data API platform state with the existing PostgreSQL isolation attestation so security readiness reflects the effective attack surface instead of treating dormant ACL risk as active exposure after the Data API is disabled.

A new shared effective-security classifier combines the bounded platform state (`enabled`, `disabled`, or `unavailable`) with the existing isolation state (`isolated`, `future-default-risk`, `exposed`, or `unavailable`). When the Data API platform is disabled, effective Data API security is `secure` even if dormant PostgreSQL default grants remain visible in the raw isolation attestation. The raw isolation state is still exposed for operator review and future re-enable risk; it is not erased or rewritten.

When the platform is enabled, NEXA remains fail-closed exactly where it matters: `isolated` is secure, current exposure is insecure, future-default risk is insecure, and an unavailable isolation attestation is unavailable. If the platform probe itself is unavailable, effective security is unavailable regardless of ACL state.

Global readiness and authenticated Student OS bridge admission now use the same effective-security classifier. Runtime-role security keeps precedence over the Data API boundary. Authenticated bridge readiness exposes raw platform state, raw isolation evidence, and the effective security result separately so Student OS can distinguish active security from latent configuration risk.

Additive migration 047 extends only the privacy-bounded bridge event reason constraint with `data_api_platform_unavailable`. No new table, row payload, prompt, response body, user identity, API key, balance, provider credential, or arbitrary metadata is introduced.

Migrations 001–046 remain immutable. NEXA provider, fallback, and bridge transport contracts remain unchanged, and Student OS deterministic `learningIntelligence` remains the sole academic decision authority.

---

# NEXA 1.92.0 — Supabase Data API Probe Semantics

NEXA 1.92.0 corrects the Data API platform-state probe introduced in 1.91. The previous probe targeted Supabase's exact `/rest/v1/` OpenAPI root with a publishable key. Supabase intentionally restricts that root to elevated API keys, so a valid publishable key can receive HTTP 403 even while the Data API is enabled. Treating that response as rejected credentials created a false-negative readiness state.

The runtime now uses a fixed, intentionally non-existent relation path with `limit=0` and a fixed non-existent column. This canary never requests application rows. When PostgREST is active, the probe recognizes bounded PostgREST schema-cache responses such as `PGRST205` (missing relation) or `PGRST204` (missing column) as evidence that the Data API is enabled. A disabled or non-exposed schema state is distinguished through bounded disabled-path responses such as `PGRST106` or an unhandled 404/410 without a PostgREST object code.

The probe reads at most 2 KiB from the response and extracts only a `PGRST###` code. It never records response messages, table data, row data, object names from the server, credentials, API keys, prompts, user identities, or arbitrary response bodies. The existing project URL validation, publishable-key boundary, five-second timeout, and 60-second cache remain unchanged.

An invalid opaque publishable key still fails as HTTP 401 and remains `credential_rejected`. Unexpected 403/5xx responses remain unavailable rather than being guessed as enabled. This preserves fail-closed behavior while removing the known false-negative caused by the admin-only OpenAPI root.

No database migration is introduced; migrations 001–046 remain immutable. Runtime-role security, Data API isolation attestation, Data API security admission, NEXA provider/fallback/bridge contracts, and Student OS deterministic academic authority remain unchanged.

---

# NEXA 1.91.0 — Supabase Data API Platform-State Readiness

NEXA 1.91.0 adds a read-only runtime probe for the Supabase Data API platform edge so NEXA can distinguish a reachable/enabled Data API from a disabled integration or an unverifiable platform state. The probe requests only the project Data API root, uses the project publishable client key, never names a table, never reads rows, and cancels the response body immediately after receiving the HTTP status.

The platform state is bounded to `enabled`, `disabled`, or `unavailable`. Missing configuration, rejected credentials, unexpected HTTP responses, and network failures remain fail-closed through bounded reason codes. The probe is cached for 60 seconds and uses a short configurable timeout. The configured Supabase URL must be an HTTPS root URL on a 20-character `.supabase.co` project hostname, preventing the readiness path from becoming a general outbound fetch primitive.

Public readiness now exposes `dataApiPlatform` and `dataApiPlatformReason`. The existing ACL isolation attestation remains independently visible as `dataApiIsolation`. This release is intentionally conservative: global readiness still requires database ACL state `isolated`, and Student OS bridge security admission remains unchanged. A future release may combine a verified disabled platform state with ACL evidence after compatibility testing.

The runtime requires `NEXA_SUPABASE_URL` and an active `NEXA_SUPABASE_PUBLISHABLE_KEY`. The publishable key is a client credential intended for public applications; NEXA still does not use it to read or mutate any application data. Direct PostgreSQL through `nexa_runtime` remains the application data path.

No database migration is introduced; migrations 001–046 remain immutable. NEXA provider, fallback, Student OS bridge transport, runtime-role security, Data API ACL attestation, and Student OS deterministic academic authority remain unchanged.

---

# NEXA 1.90.0 — Supabase Data API Remediation Planning

NEXA 1.90.0 turns the Data API security blocker into a bounded, read-only operator remediation plan. The new `npm run ops:plan-data-api-remediation` command combines the existing Data API isolation attestation with PostgreSQL default-ACL ownership evidence so operators can tell whether the live risk is safely remediable through the connected database role or requires an account-owner platform action.

The planner never runs `GRANT`, `REVOKE`, `ALTER DEFAULT PRIVILEGES`, or any Supabase platform mutation. Automatic remediation is permanently reported as `false`. It returns only bounded status, recommended action, SQL-remediation feasibility, isolation status, and aggregate owner counts. It does not return default-owner names, raw ACL rows, object names, credentials, API keys, prompts, responses, or user identities.

When the Data API boundary is already isolated, the plan is `no-action`. A current exposure produces `security-review-required`. A future-default-only risk produces `owner-action-required` and recommends `disable-data-api-in-dashboard`, which matches NEXA's architecture because NEXA uses direct PostgreSQL through `nexa_runtime` and does not depend on Supabase REST or GraphQL Data API endpoints.

The SQL-remediation feasibility check is intentionally conservative. If one or more risky default-ACL owners cannot be managed by the connected database role, the plan reports `blocked-by-default-owner`. Even when the current role could technically manage every risky owner, automatic remediation remains disabled and the supported platform action remains preferred.

Live production evidence before this release shows `future-default-risk`, one risky default-ACL owner, zero alterable risky owners from the connected `postgres` role, and therefore the expected plan is `owner-action-required / disable-data-api-in-dashboard / blocked-by-default-owner`.

No database migration is introduced; migrations 001–046 remain immutable. Runtime-role security, Data API fail-closed bridge admission, NEXA provider/fallback/bridge contracts, and Student OS deterministic academic authority remain unchanged.

---

# NEXA 1.89.0 — Data API–Aware Student OS Bridge Security Admission

NEXA 1.89.0 extends the authenticated Student OS bridge security boundary from PostgreSQL runtime-role security to Supabase Data API isolation. Model-backed bridge execution now requires both a secure `nexa_runtime` role and a fully `isolated` Data API state before NEXA proceeds to AI Gateway admission, rate limits, idempotency claims, provider creation, or model execution.

The security classifier remains fail-closed and ordered. Runtime-role security is evaluated first. If the runtime role is secure, Data API state is then evaluated: `isolated` proceeds, `future-default-risk` is rejected with `data_api_future_default_risk`, `exposed` is rejected with `data_api_current_exposure`, and an unavailable attestation is rejected with `data_api_isolation_unavailable` plus a short retry hint.

Security rejections remain privacy-bounded. The bridge returns only a generic security status, a bounded source (`runtime-role` or `data-api`), and the coarse reason. Authenticated bridge readiness exposes the bounded Data API state and reason so Student OS can preflight the integration without attempting model-backed work.

A Data API security rejection does not invoke NEXA's model fallback directive because NEXA's own security boundary is not ready. Student OS remains free to continue through its deterministic `learningIntelligence` path outside NEXA, which remains the sole academic decision authority.

Additive migration 046 widens only the existing `student_os_bridge_events.operational_reason` constraint so privacy-safe observability can persist the three new Data API security reasons. No new table or sensitive event field is introduced, and migrations 001–045 remain immutable.

The live Supabase project is currently `future-default-risk`, with zero current schema/table/sequence/function exposure but future-object default ACL risk. Therefore, after this release, model-backed Student OS bridge requests are expected to fail closed until the supported Data API/default-privilege remediation is completed. NEXA's general liveness and direct PostgreSQL runtime remain unaffected.

---

# NEXA 1.88.0 — Supabase Data API Runtime Readiness

NEXA 1.88.0 promotes the v1.87 Supabase Data API isolation attestation into the public runtime readiness contract. The runtime executes the same read-only PostgreSQL evidence query as the operator attestation and caches the bounded result for 60 seconds so ordinary readiness can detect Data API exposure drift without repeatedly scanning ACL catalogs.

The bounded readiness state is `isolated`, `future-default-risk`, `exposed`, or `unavailable`. `isolated` means current NEXA public objects are unreachable through the checked Data API principals and future public-schema defaults are also clean. `future-default-risk` means current objects remain isolated but future objects could inherit Data API access. `exposed` means at least one current public-schema exposure path exists or the evidence is malformed. `unavailable` means the attestation query could not be completed.

Public readiness exposes only `dataApiIsolation` and a coarse `dataApiIsolationReason`: `future_default_privilege_risk`, `current_data_api_exposure`, or `attestation_unavailable`. It does not expose object names, role names, raw ACL rows, table counts, schema counts, credentials, prompts, API keys, or user identities.

Global NEXA readiness now requires Data API state `isolated` in addition to database availability, secure runtime-role state, operational AI Gateway state, and the configured rate-limit secret. This release does not yet add a direct Student OS bridge admission rule for Data API state; bridge-specific enforcement remains a separate compatibility step.

The live Supabase project currently has zero current schema/table/sequence/function exposures but non-zero future-object default ACL exposure, so the expected production state after this release is `future-default-risk` until supported Supabase/default-privilege remediation is performed. The release is intentionally read-only and performs no automatic platform remediation.

No database migration is introduced; migrations 001–045 remain immutable. NEXA provider, fallback, and Student OS bridge transport contracts remain unchanged, and Student OS deterministic `learningIntelligence` remains the sole academic decision authority.

---

# NEXA 1.87.0 — Supabase Data API Exposure Attestation

NEXA 1.87.0 turns the v1.79 Supabase Data API hardening into a continuously measurable security boundary without pretending the connected runtime can manage Supabase's platform integration settings. The new read-only operator attestation distinguishes current effective exposure from future-object default-privilege risk for NEXA's `public` schema.

The attestation inspects only the Data API principals that can expose NEXA data directly: `PUBLIC`, `anon`, and `authenticated` when those roles exist. Current exposure covers schema `USAGE`/ `CREATE`, any effective privilege on public tables or sequences, and executable public functions. Future risk covers default ACL groups in the `public` schema that grant those principals access to newly created tables, sequences, or functions. Supabase-managed schemas such as `storage`, `graphql`, and `graphql_public` are deliberately outside the NEXA attestation boundary.

The bounded status has three states. `isolated` means current public objects are unreachable and no public-schema default ACL exposure is configured. `future-default-risk` means current NEXA objects remain isolated but future objects could inherit Data API access. `exposed` means at least one current public-schema access path exists or the evidence is malformed. The command reports aggregate counts only; it does not return object names, row data, prompts, credentials, API keys, user identities, or raw ACL rows.

This release is intentionally read-only and performs no automatic platform remediation. In the live Supabase project, current NEXA public objects are isolated, while `supabase_admin` owns broad public-schema defaults for `anon` and `authenticated`, so the expected production state is `future-default-risk` until the supported platform Data API configuration is explicitly remediated. NEXA itself continues using direct PostgreSQL through `nexa_runtime` and does not depend on Supabase REST or GraphQL data endpoints.

No database migration is introduced; migrations 001–045 remain immutable. Runtime-role security from v1.86 remains independently secure, NEXA provider/fallback/bridge contracts remain unchanged, and Student OS deterministic `learningIntelligence` remains the sole academic decision authority.

---

# NEXA 1.86.0 — Exact Runtime Default Privilege Surface

NEXA 1.86.0 extends the dedicated `nexa_runtime` least-privilege contract from existing PostgreSQL objects to the default privileges that govern future objects. A runtime role can be exact today and silently widen tomorrow if `ALTER DEFAULT PRIVILEGES` drifts, so runtime security readiness and the operator attestation now inspect `pg_default_acl` directly.

Every default grant group to `nexa_runtime` must be scoped to the `public` schema, must carry no grant option, and must match one exact approved privilege set. Future tables may grant only `SELECT`, `INSERT`, `UPDATE`, and `DELETE`; future sequences may grant only `USAGE` and `SELECT`; future functions may grant only `EXECUTE`. At least one configured default grant group for each of those three object classes must remain present.

Any extra privilege, missing object-class default, grant option, unsupported default object class, or default grant outside `public` makes runtime security insecure. Because Student OS bridge admission already consumes the shared runtime-security readiness state, default-privilege drift automatically blocks model-backed bridge admission before provider creation or model execution.

The PostgreSQL regression normalizes an exact default-ACL baseline, then deliberately widens future table privileges, future sequence privileges, grant options, and another schema one at a time. Each drift must fail attestation with bounded evidence; restoring the exact defaults must return security to green. Live production evidence before this release showed exactly one `public` default group for tables, sequences, and functions with no grant options and no extra privileges.

No database migration is introduced; migrations 001–045 remain immutable. NEXA provider, fallback, and Student OS bridge transport contracts remain unchanged, and Student OS deterministic `learningIntelligence` remains the sole academic decision authority.

---

# NEXA 1.85.0 — Exact Runtime Privilege Surface

NEXA 1.85.0 turns the dedicated `nexa_runtime` PostgreSQL role from a minimum-access check into an exact least-privilege contract. The runtime must still retain the application privileges NEXA needs, but it must also remain free of table and sequence privileges that are not part of the intended server runtime surface.

For public tables, the runtime continues to require `SELECT`, `INSERT`, `UPDATE`, and `DELETE` coverage. It must now have zero `TRUNCATE`, `REFERENCES`, `TRIGGER`, or PostgreSQL 17 `MAINTAIN` grants. For public sequences, the existing `USAGE` + `SELECT` coverage remains required while `UPDATE` is explicitly forbidden.

Both cached runtime security readiness and the detailed operator attestation enforce the same exact privilege boundary. Any forbidden privilege count above zero makes runtime security insecure and therefore also blocks model-backed Student OS bridge admission through the security-aware admission layer introduced in v1.82.

The PostgreSQL regression creates isolated table and sequence probes. It grants each forbidden privilege one at a time, proves the attestation fails with the matching bounded check, revokes the privilege, and proves the runtime returns to secure before testing the next one. Live production evidence before this release showed zero `TRUNCATE`, `REFERENCES`, `TRIGGER`, `MAINTAIN`, and sequence `UPDATE` grants for `nexa_runtime`.

No database migration is introduced; migrations 001–045 remain immutable. NEXA provider, fallback, and Student OS bridge transport contracts remain unchanged, and Student OS deterministic `learningIntelligence` remains the sole academic decision authority.

---

# NEXA 1.84.0 — Runtime SECURITY DEFINER Isolation

NEXA 1.84.0 closes a function-execution privilege path that ordinary grants and object-ownership checks cannot detect. The dedicated `nexa_runtime` role must not be able to execute any public PostgreSQL function declared `SECURITY DEFINER`.

A `SECURITY DEFINER` function runs with the privileges of its owner rather than the calling runtime role. That means a function owned by a more privileged role could become an escalation path even when `nexa_runtime` is non-superuser, owns no database objects, cannot create schema/database objects, and otherwise has only the intended application grants.

Both cached runtime security readiness and the detailed operator attestation now count public functions that are simultaneously `SECURITY DEFINER` and executable by `nexa_runtime`. Any non-zero count makes the runtime security state insecure. Public readiness remains bounded to `secure`, `insecure`, or `unavailable`; detailed counts and failed-check names remain operator-only evidence.

The PostgreSQL regression creates a temporary executable `SECURITY DEFINER` function, proves the attestation fails with `noExecutableSecurityDefinerFunctions`, converts the same function to `SECURITY INVOKER`, and proves the security state returns to green. Live production evidence currently shows zero public functions and therefore zero executable `SECURITY DEFINER` exposure.

No database migration is introduced; migrations 001–045 remain immutable. Student OS bridge security admission continues to consume the shared runtime-security readiness result, so future `SECURITY DEFINER` drift automatically blocks model-backed bridge admission. NEXA provider, fallback, and bridge transport contracts remain unchanged, and Student OS deterministic `learningIntelligence` remains the sole academic decision authority.

---

# NEXA 1.83.0 — Runtime Object Ownership Isolation

NEXA 1.83.0 closes an ownership-based privilege path that ordinary grant checks cannot detect. The dedicated `nexa_runtime` PostgreSQL role must now remain a pure application runtime identity: it may use the NEXA data surface through explicitly granted privileges, but it must not own the database, the `public` schema, any public relation, or any public function.

Both the cached runtime security readiness check and the detailed operator attestation enforce the same ownership boundary. The database-owner check detects ownership of the current database, the schema-owner check detects ownership of `public`, relation ownership covers public tables, partitioned tables, sequences, views, materialized views, and foreign tables, and function ownership covers public routines represented in PostgreSQL's procedure catalog.

Ownership drift is fail-closed because object owners can retain control even when CREATE or ordinary privilege checks appear restricted. Public readiness remains privacy- and security-bounded: it continues to expose only `secure`, `insecure`, or `unavailable` with a coarse reason. Detailed ownership evidence and failed-check names remain available only through `npm run ops:attest-runtime-role`.

The PostgreSQL verification suite deliberately transfers ownership of a temporary public table to `nexa_runtime`, verifies that the attestation becomes insecure with `noPublicRelationOwnership`, removes the probe object, and verifies that security returns to green.

No database migration is introduced; migrations 001–045 remain immutable. Student OS bridge security admission from 1.82 continues to consume the same runtime-security readiness result, so ownership drift also blocks model-backed bridge admission. NEXA provider, fallback, and bridge transport contracts remain unchanged, and Student OS deterministic `learningIntelligence` remains the sole academic decision authority.

---

# NEXA 1.82.0 — Security-Aware Student OS Bridge Admission

NEXA 1.82.0 extends the v1.81 runtime-role security boundary into the authenticated Student OS bridge itself. A direct bridge request can no longer bypass general NEXA readiness when the dedicated `nexa_runtime` PostgreSQL role is insecure or its least-privilege attestation is unavailable.

After authentication, contract negotiation, and bounded request validation establish a privacy-safe observation context, the bridge now performs runtime-role security admission before AI Gateway admission, rate limits, idempotency claims, provider creation, or model execution. A secure runtime role proceeds normally. An insecure role is rejected with the bounded reason `runtime_role_security_violation`; an unavailable security attestation is rejected with `runtime_role_security_unavailable` and a short retry hint.

Security rejection does not create a NEXA fallback directive because the NEXA runtime itself is not trusted to serve the bridge in that state. The response instead marks bridge serving mode as `unavailable`; Student OS remains free to continue through its own deterministic `learningIntelligence` path outside NEXA.

Authenticated bridge readiness now includes the bounded runtime-role security state. Model-backed serving mode `nexa` requires both secure runtime-role security and an operational AI Gateway. Deterministic Gateway fallback is offered only while runtime-role security remains secure. Any insecure or unavailable runtime-role attestation forces the bridge serving mode to `unavailable`.

Additive migration 045 extends the existing privacy-bounded `operational_reason` constraint with the two runtime-security reasons. The event ledger still stores no prompt, response body, authorization material, API key, Gateway balance, provider credential, raw Student OS user ID, or arbitrary metadata. Existing HMAC user pseudonymization and fail-soft observability behavior remain unchanged.

Migrations 001–044 remain immutable. NEXA provider, fallback, and bridge transport contracts remain unchanged, and Student OS deterministic `learningIntelligence` remains the sole academic decision authority.

---

# NEXA 1.81.0 — Runtime Security Readiness

NEXA 1.81.0 promotes the v1.80 PostgreSQL least-privilege attestation from an operator-only check into the runtime readiness contract. NEXA now performs the same read-only privilege assessment through the shared database connection and caches the result for 60 seconds so ordinary readiness can detect privilege drift without repeatedly scanning PostgreSQL catalogs.

Readiness requires the dedicated `nexa_runtime` role to remain login-capable but non-superuser, unable to create roles or databases, unable to replicate, unable to bypass RLS, unable to create objects in the public schema, and free of inherited database-role memberships. It also requires the intended application access to remain complete: public schema usage, database connect, CRUD access across public application tables, sequence usage/select coverage, and execute coverage across public functions.

The public readiness response intentionally exposes only a bounded security state: `secure`, `insecure`, or `unavailable`, plus the coarse reason `least_privilege_violation` or `attestation_unavailable`. Detailed privilege evidence remains available only through `npm run ops:attest-runtime-role`. Public readiness does not disclose failed check names, table counts, role memberships, or grant details.

An insecure or unavailable runtime-role attestation degrades readiness even when the database is reachable. The AI Gateway, database connectivity, and rate-limit checks remain unchanged. No database migration is introduced; migrations 001–044 remain immutable. NEXA provider, fallback, and Student OS bridge contracts are unchanged, and Student OS deterministic `learningIntelligence` remains the sole academic decision authority.

---

# NEXA 1.80.0 — Runtime Role Least-Privilege Attestation

NEXA 1.80.0 turns the dedicated `nexa_runtime` PostgreSQL role boundary into a continuously verifiable security contract. The release adds a read-only operator attestation that inspects the effective runtime role instead of assuming migration-time grants remain safe forever.

The attestation requires `nexa_runtime` to exist and remain login-capable while proving it is not a superuser, cannot create roles or databases, cannot replicate, cannot bypass RLS, cannot create objects in the `public` schema, cannot create at the database level, and inherits no other database roles. It also verifies that the runtime role still has the application access NEXA intentionally needs: schema usage, database connect, full CRUD coverage on public application tables, sequence usage/select coverage, and execute coverage on public functions.

Database TEMP privilege is reported as evidence but is not treated as an escalation failure because temporary objects are session-local and may be required by database tooling. The release does not grant or revoke live production privileges and introduces no database migration; migrations 001–044 remain immutable.

`npm run ops:attest-runtime-role` provides a read-only operator check against the configured `DATABASE_URL`. Canonical verification includes both a pure contract suite and a PostgreSQL integration test that proves privilege widening is detected. In the integration database, temporarily granting schema CREATE flips the attestation to insecure, and revoking it restores the secure result.

This release extends the Supabase Data API isolation work from 1.79 without changing NEXA provider behavior, Student OS bridge contracts, deterministic fallback semantics, or Student OS academic authority.

---

# NEXA 1.79.0 — Supabase Data API Isolation

NEXA 1.79.0 closes the Supabase public Data API surface around NEXA's server-owned PostgreSQL schema. The live project uses a dedicated `nexa_runtime` PostgreSQL login from the server runtime and does not use `@supabase/supabase-js`, browser anon keys, or client-side PostgREST access for NEXA data.

Additive migration 044 revokes `PUBLIC`, `anon`, and `authenticated` access to the `public` schema and its existing tables, sequences, and functions. It also updates the migration owner's default privileges so newly created NEXA tables, sequences, and functions do not silently reopen Data API access. The migration explicitly preserves current and future table/sequence/function privileges for `nexa_runtime`.

The migration is role-aware and portable: Supabase-specific roles are handled only when present, while canonical PostgreSQL CI can apply the same migration without requiring Supabase role creation. Default-privilege changes follow `current_user`, so they bind to the actual schema migration owner in each environment rather than hardcoding a provider-specific owner.

This release intentionally does not enable blanket RLS policies on NEXA's server-side tables. `nexa_runtime` is not a BYPASSRLS role, so blindly enabling RLS would risk breaking the application. Instead, NEXA removes those tables from the Supabase Data API access path while preserving least-privilege server access.

The release gate includes a real PostgreSQL regression that recreates vulnerable `anon`/`authenticated` grants, reapplies migration 044, proves those roles lose schema/table/sequence/function access, proves `nexa_runtime` retains access, and verifies the same isolation for objects created after the migration. Existing migrations 001–043 remain immutable, Student OS `main` is unchanged, and Student OS deterministic `learningIntelligence` remains the sole academic decision authority.

---

# NEXA 1.78.0 — Explicit Negotiation Enforcement Evidence Gate

NEXA 1.78.0 adds a read-only operator assessment for deciding whether bridge-negotiation enforcement has enough evidence to be considered for human review. The assessment consumes the privacy-bounded v1.77 adoption report and never changes `NEXA_STUDENT_OS_BRIDGE_NEGOTIATION_REQUIRED`.

NEXA deliberately does not choose a traffic threshold. Operators must provide `--min-requests` explicitly, and the command accepts only a bounded positive integer. This keeps deployment policy outside the runtime and prevents a hard-coded rollout threshold from becoming an accidental product decision.

The assessment returns one bounded decision: `insufficient-traffic`, `insufficient-observability`, `legacy-default-observed`, or `reviewable`. A result is reviewable only when the operator-supplied minimum sample is met, evidence coverage is complete, and no legacy-default traffic is present. Even then, `automaticPolicyChange` is always false; reviewable means the evidence may be reviewed, not that enforcement should be enabled.

A zero-traffic window is always `insufficient-traffic` for every valid minimum sample. Partial or unobserved evidence cannot become reviewable regardless of explicit-adoption percentages. The command is read-only and performs no insert, update, delete, environment mutation, or deployment action.

Assessment output remains aggregate-only and returns no raw Student OS user ID, user fingerprint, request ID, prompt, response body, authorization material, API key, Gateway balance, provider credential, or raw event row. No database migration is introduced; migrations 001–043 remain immutable, and Student OS deterministic `learningIntelligence` remains the sole academic decision authority.

---

# NEXA 1.77.0 — Negotiation Adoption Evidence Coverage

NEXA 1.77.0 makes the v1.76 negotiation-adoption report explicit about whether its adoption sample is actually trustworthy. An empty adoption sample is no longer ambiguous: the report now separately measures total Student OS bridge traffic and negotiation-observability coverage inside the same reporting window.

The new `evidenceCoverage` block reports only aggregate counts and one bounded status: `no-traffic`, `unobserved`, `partial-observability`, or `covered`. It distinguishes requests whose lifecycle events are fully negotiation-observed from requests with no negotiation metadata and requests with mixed lifecycle observability. `coveragePercent` measures only fully observed bridge requests; a zero-traffic window returns null rather than implying 100% coverage.

The existing adoption fields remain backward-compatible: explicit and legacy-default request totals, percentages, whether legacy-default traffic was observed, and aggregate counts by bridge contract version. The database query still counts bridge request IDs only inside SQL and never returns request IDs or raw event rows.

This release intentionally does not recommend or automatically enable `NEXA_STUDENT_OS_BRIDGE_NEGOTIATION_REQUIRED`. In particular, `no-traffic` is evidence of no traffic, not evidence of explicit-negotiation adoption. Operators must wait for real, sufficiently covered bridge traffic before making a compatibility-policy decision.

The report remains privacy-bounded: it returns no raw Student OS user ID, user fingerprint, request ID, prompt, response body, authorization material, API key, Gateway balance, provider credential, or arbitrary metadata. No database migration is introduced; migrations 001–043 remain immutable, and Student OS deterministic `learningIntelligence` remains the sole academic decision authority.

---

# NEXA 1.76.0 — Privacy-Bounded Negotiation Adoption Reporting

NEXA 1.76.0 turns the v1.75 negotiation-adoption ledger into a safe operator decision-support report. The new `ops:report-student-os-bridge-negotiation-adoption` command reads PostgreSQL and returns only aggregate bridge-request counts grouped by negotiation source and transport contract version.

The report counts distinct bridge request IDs inside SQL so multiple lifecycle events for one request do not inflate adoption. Output contains only the bounded reporting window, aggregate explicit and legacy-default request totals, percentages, whether any legacy-default traffic was observed, and per-contract aggregate counts. It does not return request IDs, user fingerprints, prompts, response bodies, authorization material, API keys, Gateway balances, provider credentials, or raw event rows.

The default reporting window is 7 days and operators may request an integer window from 1 through 90 days. A zero-sample report returns null percentages rather than implying zero adoption. The report deliberately does not auto-enable `NEXA_STUDENT_OS_BRIDGE_NEGOTIATION_REQUIRED` or declare a sunset threshold; policy changes remain an explicit operator decision based on observed evidence.

No database migration is introduced. Migrations 001–043 remain immutable, the bridge/provider/fallback contracts remain `1.0`, and Student OS deterministic `learningIntelligence` remains the sole academic decision authority.

---

# NEXA 1.75.0 — Bridge Negotiation Adoption Observability

NEXA 1.75.0 makes the legacy bridge-negotiation sunset measurable before enforcement is enabled. Successful authenticated Student OS bridge requests now attach two privacy-bounded fields to the existing observability ledger: the negotiated bridge transport version and whether that version came from explicit negotiation or the legacy implicit default.

Additive migration 043 introduces `bridge_contract_version` and `contract_negotiation_source` on `student_os_bridge_events`. Historical rows remain valid with both fields null. New runtime observations write the pair together, with database constraints allowing only version-shaped values and the bounded sources `explicit` or `legacy-default`. A partial index supports aggregate adoption analysis by negotiation source, contract version, and time.

The ledger still stores no prompt, response body, authorization header, API key, raw Student OS user ID, Gateway balance, provider credential, requested-version list, or arbitrary metadata. Existing user pseudonymization, fail-soft telemetry behavior, and retention pruning remain unchanged.

This release gives operators the evidence needed to decide when `NEXA_STUDENT_OS_BRIDGE_NEGOTIATION_REQUIRED` can safely move from `false` to `true`. It does not change that policy itself: legacy implicit `1.0` remains allowed by default. Provider, fallback, and bridge transport contracts remain `1.0`; Student OS deterministic `learningIntelligence` remains the sole academic decision authority.

---

# NEXA 1.74.0 — Bridge Negotiation Policy & Legacy Sunset Readiness

NEXA 1.74.0 adds a validated policy for eventually requiring explicit Student OS bridge contract negotiation without breaking current clients. The new `NEXA_STUDENT_OS_BRIDGE_NEGOTIATION_REQUIRED` setting defaults to `false`, so existing clients that omit the negotiation header continue to receive the legacy implicit `1.0` bridge contract exactly as before.

When the policy is enabled, authenticated Student OS requests must send `X-NEXA-Bridge-Accept-Contract`. A missing or blank header is rejected with HTTP 428 before request-body parsing, operational admission, rate limits, idempotency claims, provider creation, or model execution. Malformed headers remain HTTP 400, while well-formed but unsupported contracts remain HTTP 409.

The policy parser accepts only explicit `true` or `false` values. Invalid server configuration fails closed with HTTP 503 rather than silently changing compatibility behavior. Authenticated bridge readiness exposes whether explicit negotiation is required, whether the legacy implicit default is allowed, and whether the policy configuration is valid. Matching health headers let Student OS discover the policy before sending a capability request.

This release changes no provider semantics, fallback semantics, request schema, capability set, academic authority, or database schema. The provider contract remains `1.0`, fallback contract remains `1.0`, bridge transport contract remains `1.0`, and migrations 001–042 remain immutable.

---

# NEXA 1.73.0 — Contract-Bound Idempotency Replay Safety

NEXA 1.73.0 binds durable Student OS bridge idempotency to the negotiated bridge transport contract so a future transport revision cannot accidentally replay a cached result produced under another contract version.

The current bridge contract remains `1.0`, and its idempotency hash is intentionally preserved byte-for-byte: `1.0` continues hashing the original Student OS bridge envelope exactly as v1.62–v1.72 did. That preserves compatibility with existing in-flight and terminal replay records during the 24-hour idempotency retention window.

For any future negotiated bridge contract other than the current legacy `1.0`, NEXA hashes a canonical object containing both `bridgeContractVersion` and the request envelope. The durable request ledger therefore treats identical request IDs/payloads under different transport contracts as key-reuse mismatches rather than cross-contract replays.

The route passes the negotiated bridge contract into the hash before durable claim. Rate-limit admission still occurs before the claim, provider creation still occurs after the claim, and no model call is added. The provider contract remains `1.0`, fallback contract remains `1.0`, and bridge transport contract remains `1.0`.

No database migration is introduced; migrations 001–042 remain immutable. Student OS deterministic `learningIntelligence` remains the sole academic decision authority.

---

# NEXA 1.72.0 — Student OS Bridge Contract Compatibility Negotiation

NEXA 1.72.0 adds explicit compatibility negotiation for the private Student OS bridge transport without breaking existing clients. Updated Student OS consumers can send `X-NEXA-Bridge-Accept-Contract` with one or more comma-separated bridge transport versions they support. NEXA selects the first compatible version and returns the negotiated version in `X-NEXA-Bridge-Contract`.

The current bridge transport contract remains `1.0`, and `1.0` is the only supported version in this release. Legacy clients that do not send the negotiation header continue using an implicit `1.0` default. This preserves the existing integration while giving future Student OS versions a safe way to detect transport incompatibility before provider behavior changes.

Malformed negotiation headers are rejected with HTTP 400. Explicit requests that contain no supported bridge version are rejected with HTTP 409 and a bounded `supportedContracts` response. Both rejection paths occur after bridge authentication but before request-body parsing, operational admission, rate-limit admission, idempotency claims, provider creation, or model execution.

Authenticated bridge readiness now exposes `supportedBridgeContractVersions`, and bridge responses advertise `X-NEXA-Bridge-Supported-Contracts`. The smoke verifier requires readiness body/header agreement so transport-version discovery cannot silently drift.

The NEXA provider contract remains `1.0`, the deterministic fallback contract remains `1.0`, and the bridge transport contract remains `1.0`. Student OS deterministic `learningIntelligence` remains the sole academic decision authority. No database migration is introduced; migrations 001–042 remain immutable.

---

# NEXA 1.71.0 — Student OS Bridge Transport Contract Versioning

NEXA 1.71.0 introduces an explicit version for the private HTTP transport contract between Student OS and NEXA. The bridge transport is now versioned independently from the NEXA provider semantics and the deterministic fallback directive, so those layers can evolve without being incorrectly treated as one protocol.

The bridge contract starts at `1.0` and is advertised on every Student OS bridge response through `X-NEXA-Bridge-Contract`. Authenticated bridge health also exposes `bridgeContractVersion` in its machine-readable body, and the deployment smoke verifier requires the body and header to agree.

The existing NEXA provider contract remains `1.0`, and the deterministic fallback contract remains `1.0`. No request schema, capability set, provider behavior, fallback authority, idempotency rule, admission rule, or academic decision rule changes in this release. Student OS deterministic `learningIntelligence` remains the sole academic decision authority.

This release adds no database migration; migrations 001–042 remain immutable. Canonical verification separately guards the bridge transport version, provider contract version, and fallback contract version to prevent accidental cross-layer coupling.

---

# NEXA 1.70.0 — Student OS Preflight Failover Readiness

NEXA 1.70.0 makes the authenticated Student OS bridge health check explicitly describe how the integration can serve a request before Student OS sends one. Full model-backed readiness remains `ready` with serving mode `nexa`. When the AI Gateway is operationally unavailable but the bridge can still safely hand control back to Student OS, readiness remains honestly `degraded` while exposing serving mode `student-os-deterministic` and the same bounded fallback directive introduced in 1.69.

The health endpoint keeps its existing HTTP semantics: full readiness returns 200 and degraded readiness returns 503. It now adds `X-NEXA-Bridge-Serving-Mode`, and when deterministic fallback is available it also adds `X-NEXA-Bridge-Fallback-Contract`. This lets Student OS preflight the integration and choose its deterministic `learningIntelligence` path without first attempting a model-backed bridge request.

The bridge smoke verifier now treats both states as valid integration outcomes: fully ready NEXA, or an authenticated and correctly structured deterministic-fallback state. A zero-credit AI Gateway therefore remains visible as degraded model readiness without being misclassified as a broken Student OS integration.

This release also adds branch-local Vercel Git deployment rules for NEXA source: `nexa-main` remains enabled, while temporary `stage/nexa-*` and verification `nexa-*` branches do not auto-deploy. Student OS branches are unspecified and therefore unchanged. This prevents verification-only NEXA branches from generating noisy failed-preview emails when branch-restricted runtime secrets are intentionally unavailable.

No database migration is introduced; migrations 001–042 remain immutable. The NEXA provider contract remains `1.0`, the fallback contract remains `1.0`, and Student OS deterministic `learningIntelligence` remains the sole academic decision authority.

---

# NEXA 1.69.0 — Deterministic Student OS Fallback Signaling

NEXA 1.69.0 makes operational failure handling machine-readable for Student OS without changing the stable NEXA provider contract. When the authenticated Student OS bridge rejects a request because NEXA is not operationally available, the existing provider failure remains backward-compatible (`ok: false`, `code: unavailable`, `retryable`), and the response now adds a bounded `fallback` directive.

The fallback directive has a separate bridge-level contract version and explicitly identifies `student-os-deterministic` as the fallback mode. It repeats only the coarse operational reason already allowed by NEXA readiness, carries the existing retryability/retry-after hint, and states `student-os-learning-intelligence` as the academic decision authority. Matching response headers let HTTP-oriented clients detect the same fallback mode without parsing model output.

This does not let NEXA decide mastery, readiness, prerequisites, remediation, transition, or next-best-action state. It does the opposite: when NEXA cannot safely serve a model-backed request, the bridge explicitly hands control back to Student OS's deterministic core. No prompt, raw user identity, Gateway balance, API key, provider credential, or model response is added to the fallback directive.

The provider contract remains `1.0`, existing consumers that ignore additive fields remain compatible, and no database migration is introduced. The release gate verifies every operational reason, retry semantics, response/header wiring, ordering before rate-limit/idempotency/model admission, immutable fallback directives, and preservation of the Student OS authority boundary.

---

# NEXA 1.68.0 — Privacy-Bounded Operational Rejection Observability

NEXA 1.68.0 makes the operational admission guard introduced in 1.67 durable and diagnosable without weakening privacy. Authenticated Student OS bridge requests that are rejected before model admission now record a dedicated `operational_rejected` bridge event instead of being collapsed into the generic failure bucket.

Additive migration 042 extends the existing privacy-bounded `student_os_bridge_events` ledger with one nullable, constrained `operational_reason` field. It accepts only the same coarse Gateway states already exposed by safe readiness surfaces: missing key, timeout, authentication failure, exhausted credits, unavailable configured model, unavailable provider endpoints, or temporary status-query failure. Database constraints require an operational reason for `operational_rejected` events and prohibit that field on every other event type.

The ledger still stores no raw Student OS user ID, prompt, response body, API key, credit balance, provider credential, or arbitrary metadata. User identity remains HMAC-pseudonymized with the server-only rate-limit secret, observability remains fail-soft, and existing retention pruning continues to cover the extended events. A partial index supports bounded operator diagnosis by coarse operational reason and timestamp.

The release gate verifies migration 042 integrity, runtime wiring, privacy exclusions, event/reason consistency constraints, PostgreSQL persistence and rejection behavior, retention compatibility, and the existing Student OS authority boundary. Migrations 001–041 remain immutable, and Student OS deterministic `learningIntelligence` remains the sole academic decision authority.

---

# NEXA 1.67.0 — Student OS Operational Admission Guard

NEXA 1.67.0 makes the private Student OS bridge operationally fail-soft before any model-backed request can consume bridge admission state. After bridge authentication and Student OS user-identity fencing, the route now checks the cached zero-model-cost AI Gateway operational readiness introduced in 1.65. If the Gateway is not operational, the bridge returns a structured NEXA provider `unavailable` result with HTTP 503 before durable rate-limit admission, idempotency claim, or provider/model creation.

Permanent configuration conditions such as a missing key, failed authentication, exhausted credits, or an unavailable configured model are non-retryable. Transient control-plane conditions such as Gateway timeout, provider endpoint unavailability, or temporary status-query failure are retryable and expose a bounded 30-second `Retry-After`. Responses include coarse operational status/reason headers without exposing credentials, balances, provider secrets, or internal errors.

This preserves Student OS behavior under external AI failure: Student OS remains fully authoritative for mastery, readiness, prerequisites, remediation, transitions, and next-best-action decisions and can immediately use its existing fallback path when NEXA cannot serve a model call. Operational rejection happens only after authenticated identity validation, so unauthenticated traffic cannot use the endpoint as a Gateway-status oracle.

The release adds no database migration: migrations 001–041 remain immutable. The release gate proves exact request ordering, structured fail-soft behavior, retry classification, and the no-model-call/no-new-migration boundary.

---

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
