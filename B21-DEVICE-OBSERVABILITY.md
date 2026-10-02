# Student OS B21 — Device Observability

## Implemented

- Added `/api/release-info` with no-store headers and safe deployment metadata only.
- Added client-side device diagnostics for secure context, connectivity, standalone PWA mode, service-worker controller, push support, notification permission, and current subscription presence.
- Kept diagnostics read-only and free of secrets or account data.

## Verification available in this environment

- File presence and syntax-oriented source inspection completed.
- Full dependency-backed TypeScript/Vitest/build execution remains blocked because the project dependency tree is not installed and the environment cannot reach npm.

## External acceptance

Once deployed over HTTPS, use the diagnostics to confirm the running release, active service-worker generation, PWA mode, and push state on a physical device.
