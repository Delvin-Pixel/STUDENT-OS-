# NEXA dependency hardening checkpoint

Base: `1f80926376dbed136588ca80f9b53f8e54310341` (1.96.0).
The remediation-readiness history assertion was already repaired at this base;
no security assertion is weakened by this work.

The fresh audit found critical Next.js and high Undici/Zod advisories. Update
Next.js to 16.4.3 and the compatible transitive Undici/Zod dependencies using the
package manager. CI now audits both the complete and production dependency
graphs at the high severity threshold. Existing PostgreSQL, migration-integrity,
security, bridge, type-check and build gates remain mandatory.

## Runtime evidence and limits

The existing Preview at base revision returned liveness 200/version 1.96.0.
Readiness returned 503: database ok; runtime role secure; Data API enabled with
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
