# Student OS Hardening Baseline

This document records the verified baseline before the account, cloud-sync, and security hardening release. The implementation target is **real authenticated accounts with local-first cloud synchronization**: each signed-in learner owns one cloud workspace and every device keeps an account-scoped local working copy for offline use.

## Verified current state

| Area                  | Current implementation                                                                                                        | Required remediation                                                                                                    |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Application bootstrap | The app starts from one device-local `studentos:data:v3` workspace and renders before an account/cloud workspace is resolved. | Gate rendering behind authentication, owned local-cache resolution, and cloud hydration/reconciliation.                 |
| Cloud workspace       | A JSON workspace blob exists on the user row and is accessed through protected server procedures.                             | Add schema validation, schema version, revision-based writes, conflict responses, and a local sync queue.               |
| Local storage         | State is cached globally with a lightweight owner marker.                                                                     | Use account-scoped keys, preserve offline data, surface save failures, and prevent data from another account rendering. |
| AI routes             | Lesson and Study Assistant procedures are public.                                                                             | Require authenticated users and add bounded request sizes, usage limits, and clear rate-limit errors.                   |
| Push routes           | Device operations are public and subscriptions are stored without an account owner.                                           | Bind every device operation to `ctx.user.openId` and enforce ownership in the persistence layer.                        |
| Profile upload        | Photo validation exists but the route is public and storage keys are not account-scoped.                                      | Require authentication and use owner-scoped storage keys derived on the server.                                         |
| Theme                 | Store preference and `ThemeContext` maintain separate state and local keys.                                                   | Make the workspace preference canonical and correctly apply system/light/dark behavior.                                 |
| PWA                   | The service worker caches a device-wide shell.                                                                                | Version caches with each release and avoid serving stale authenticated app shells.                                      |

## Architectural invariants

1. The server derives identity solely from the active authenticated session. Client input must never select an account, workspace owner, or device owner.
2. A user interface for account data is never rendered until authentication and workspace hydration have completed or safely fallen back to the matching account-scoped local copy.
3. Core learning actions update local state immediately. Failed or offline cloud synchronization leaves local data intact, queues a retry, and exposes a human-readable sync status.
4. Cloud workspace writes are revision-aware. A stale device receives a conflict response rather than silently overwriting newer cloud data.
5. One canonical workspace schema validates local restores, imports, cloud loads, and cloud saves. Invalid data is rejected rather than partially merged.
6. Profile photos and push subscriptions are owned by the account authenticated on the server.

## Implementation sequence

The release first secures identity and workspace boundaries, then adds revision-safe synchronization and validates all server entry points. Product improvements—including dates, notifications, flashcards, timetable, budget, analytics, search, and dashboard customization—follow the secured foundation so they inherit safe persistence and account isolation.
