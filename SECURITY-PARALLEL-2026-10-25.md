# NEXA dependency hardening checkpoint

Original base: `1f80926376dbed136588ca80f9b53f8e54310341` (1.96.0).
Reconciled base: `c89c79332d2a38da12e136764e659d849b00f543` (1.98.0).
The isolated security branch incorporates the complete 1.98.0 history without
changing the canonical branch or merging a pull request.
The remediation-readiness history assertion was already repaired at this base;
no security assertion is weakened by this work.

The fresh audit found critical Next.js and high Undici/Zod advisories. Update
Next.js to 16.4.3 and the compatible transitive Undici/Zod dependencies using the
package manager. CI now audits both the complete and production dependency
graphs at the high severity threshold. Existing PostgreSQL, migration-integrity,
security, bridge, type-check and build gates remain mandatory.

## Runtime evidence and limits

The canonical 1.98.0 Preview readiness check on 2026-10-26 returned 503: database ok; runtime role secure; Data API enabled with
future-default privilege risk; effective Data API security insecure; Gateway
credits exhausted. The authenticated bridge health request could not be fetched
through the deployment connector, which reported deployment authentication
required. Do not mistake that connector failure for verified application denial.

The runtime proposes owner action to disable the Data API in Supabase Dashboard,
followed by fresh platform/isolation verification. This configuration can affect
integrations and requires explicit approval. No configuration, RLS, credentials,
database, billing, production deployment or canonical branch is changed here.

Local builds use only the disposable CI database placeholder for import-time
configuration. They do not establish live database or AI readiness. PostgreSQL
integration verification belongs to the existing CI service, not the live project.

## Reconciliation verification (2026-10-26)

Local clean install, dependency verification, migration integrity, validation, all
85 test scripts in `npm test`, TypeScript and production build passed. Complete
and production dependency audits reported zero vulnerabilities. Build used the
disposable CI placeholder only. No standalone lint/format scripts are defined.
The full PostgreSQL integration pipeline must pass remotely for this reconciled
revision; earlier green CI is not evidence for this revision.

Live readiness reports remediation closure open/owner-action-pending and Gateway
credits exhausted. Neither authenticated bridge functionality nor live account
persistence is certified. The isolated security Preview previously lacked its
required DATABASE_URL; no canonical environment secrets were copied or broadened.
