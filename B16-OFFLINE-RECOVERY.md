# Student OS B16 — Offline / Resume Sync Recovery

## Change

Workspace cloud synchronization now retries after app wake/resume signals, not only after a network-online event.

Signals handled:

- `online`
- `visibilitychange` to visible
- `focus`
- `pageshow`

Wake signals are debounced for 250ms and ignored until workspace hydration is complete or while offline. Existing local-first persistence and pending revision state remain unchanged.

## Verification

- StoreContext TSX transpilation: PASS
- New regression-test TSX/TS transpilation: PASS
- Full dependency-backed test suite: not executed in this environment
