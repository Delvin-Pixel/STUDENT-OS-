# Student OS B20 — PWA Update Reliability

Implemented from the B19 source checkpoint.

## Fixes

- Service worker now calls `skipWaiting()` only after required precache work succeeds.
- `clients.claim()` now runs after Student OS cache cleanup completes.
- Precache manifest entries are restricted to same-origin absolute paths.
- Recent worker-generation compatibility routes v9–v15 remain available, including v13/v14.
- Added regression tests for activation ordering and compatibility routes.

## Verification completed in the current environment

- `node --check client/public/sw.js` — PASS
- TypeScript syntax transpilation for modified files — PASS

## Not claimed here

- Full Vitest suite (dependency tree not installed)
- Production build
- Real browser/service-worker lifecycle on a physical device
