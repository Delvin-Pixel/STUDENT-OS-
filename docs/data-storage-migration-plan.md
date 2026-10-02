# Student OS data, storage, and reliability migration plan

## Status and release boundary

Student OS currently operates as an **authenticated, cloud-backed, local-first** workspace. Each account has an account-scoped local cache for immediate interaction and a revision-checked cloud workspace record for restoration and multi-device merge. This design is appropriate for the present bounded workspace model, but it is **not a claim that all scale, device, or provider-reliability risks are resolved**.

> The current JSON workspace and browser-local cache have explicit size boundaries. They should be migrated before long-running, attachment-heavy, or high-volume use exceeds those boundaries.

| Boundary             | Current safeguard                                                                 | Remaining risk                                                                                                                 | Planned treatment                                                                                                                     |
| -------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Cloud workspace JSON | Strict canonical validation; 4 MB payload rejection; revision conflict handling   | A single large record becomes costly to send, merge, and write; independent edits to the same record remain active-device-wins | Split high-growth domains into normalized account-owned tables, retaining the blob only as a compatibility envelope during migration. |
| Browser local cache  | Account-scoped `localStorage` keys and failure status                             | Browser quota is device-specific and synchronous storage can degrade with large workspaces                                     | Add an IndexedDB persistence adapter with a versioned migration and keep localStorage as a read-only fallback during cutover.         |
| Study-material bytes | Account-scoped object storage, protected ownership resolver, temporary signed URL | File metadata remains inside the workspace blob and must stay bounded                                                          | Move material metadata into an account-owned table before supporting larger libraries or richer file types.                           |
| Profile photos       | Opaque account-key plus protected signed resolver                                 | Legacy raw-path value remains in old workspace records until observed and migrated                                             | Maintain legacy-path-to-key conversion for one release cycle, then remove the legacy field after measured adoption.                   |
| Concurrent edits     | Server revision compare-and-increment plus ID-based collection merge              | Same-ID edits are intentionally local-device-wins; scalar profile/settings changes are not CRDTs                               | Add per-entity `updatedAt`/version metadata before collaborative or high-concurrency editing.                                         |

## Phased normalized-storage migration

The migration should be additive and reversible. It must not replace the current workspace blob in one release or require every learner to be online at the same time.

| Phase                   | Scope                                                                                                                   | Compatibility approach                                                                          | Completion evidence                                                              |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| A — inventory           | Measure serialized workspace size and collection counts anonymously at save time; emit only bounded operational metrics | No behavior change; never log workspace contents                                                | Size distribution, quota-failure rate, and migration threshold agreed.           |
| B — IndexedDB adapter   | Add an account-namespaced IndexedDB cache adapter behind the existing storage interface                                 | Read IndexedDB first, fall back to localStorage; verify checksummed export/import compatibility | Device migration, offline write, and reconnect tests on browser/PWA profiles.    |
| C — normalized metadata | Add account-owned tables for study materials, notes, sessions, cards, evidence, and notifications                       | Dual-write new items; source-of-truth remains blob while reconcile reports match                | Migration/backfill is idempotent; Account A/B isolation and conflict tests pass. |
| D — selective reads     | Load high-growth collections from tables while keeping profile/settings and compatibility data in the blob              | Feature flag per collection; provide rollback to blob read                                      | Latency, payload, and merge metrics improve without data loss.                   |
| E — retirement          | Stop writing migrated collections to the blob only after a read-repair window and source archive period                 | One release retains a recovery exporter and migration audit trail                               | Independent restore from legacy backup and current storage both pass.            |

## Date, time, and scheduling policy

Student planning records use **local calendar strings** (`YYYY-MM-DD` and local `HH:mm`) because a student’s timetable and due-date meaning belongs to their local day. Operational events—cloud write timestamps, server reminder fire times, signed-URL expiry, and delivery history—use UTC-based timestamps. A date-only planning field must not be reconstructed with `toISOString()` when calculating the learner’s local day.

The next implementation increment should centralize the policy in explicit helpers for local calendar parsing, timezone-safe day comparison, reminder conversion, and export/import validation. It should add tests for negative UTC offsets, positive UTC offsets, midnight transitions, daylight-saving changes where relevant, and travel across time zones. This is a documented P2 boundary, not a claim that physical device timezone behavior has been fully observed.

## P2 quality and performance follow-up

The reachable fabricated sample-planner path and unused legacy synchronization helper have been removed. Quick Add now previews a planned session, records it as `planned` rather than `completed`, and bounds parsed durations to 5 minutes through 8 hours. Budget form validation rejects empty, zero, and negative monetary amounts; its date input remains a local calendar string and should gain an explicit invalid-date/locale test when the date utility is centralized.

Route-level loading and the deferred weekly chart reduced the initial bundle previously; the current production build still contains large **deferred** specialist chunks for AI, diagrams, syntax rendering, and graphing. The next optimization should use measured route-usage and import graphs, not broad manual-chunk changes that may harm caching or defer essential accessibility code.

## Manual acceptance matrix

| Area                           | Requirement before a stronger readiness claim                                                                                                                    |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Physical offline and reconnect | **REQUIRES MANUAL DEVICE TEST**: create offline data, close/reopen, reconnect, and verify one sync without duplicates.                                           |
| Account switching              | **REQUIRES MANUAL DEVICE TEST**: sign in as Account A and Account B in separate browser profiles; verify cache, materials, avatar, and push history never cross. |
| Installed-PWA notifications    | **REQUIRES MANUAL DEVICE TEST**: permission, registration, test delivery, scheduled delivery, disable/re-enable, and account switch.                             |
| AI provider reliability        | **REQUIRES MANUAL DEVICE TEST**: repeated real lesson/assistant/PDF-summary requests across normal network conditions; verify accurate source/fallback labels.   |
| IndexDB migration              | Must not begin until the compatibility and Account A/B recovery tests above have a controlled implementation plan.                                               |
