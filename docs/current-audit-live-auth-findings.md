# Current Audit — Live Authentication Findings

Date: 2026-08-26

The active published domain is `https://studentos-jmnrfmj9.manus.space/`. The generation-specific endpoint `/api/service-worker-v9.js` is live and serves the `studentos-v9` worker with `skipWaiting()`, `clients.claim()`, network-first navigation, and an explicit bypass for `/api/` requests.

A fresh active-domain navigation with a cache-busting query reached the current Student OS root. After the account check completed, it displayed the current `Welcome to Student OS` landing page with `Create an account` and `Log in`; it did not automatically redirect to the provider. This proves the current root shell is reachable in the audit browser.

The previously observed provider page used the legacy callback `/manus-oauth/callback` and showed `[permission_denied] insufficient permissions to access this webdev` after selecting the owner account. The current source bundle uses `/api/oauth/start` and `/api/oauth/callback`. The legacy provider error occurs before Student OS receives a callback, so it is a provider authorization or stale-client boundary rather than a callback-session rejection. A real account-selection completion on a phone remains a manual boundary.

The current project source HEAD is `db66a24be08d`; the source OAuth app ID is `JmnRFmj9cCotDrmo9SM2je`; the portal base is `https://manus.im`; and the server base is `https://api.manus.im`.

## Owner-account provider denial

The account shown in the user screenshot is the project owner. A provider-side `[permission_denied] insufficient permissions to access this webdev` message therefore remains unresolved at the Manus authorization boundary, before Student OS callback execution. The active domain now serves the v9 worker and a fresh root navigation reaches the current welcome page after account checking. The final real-provider action is to restore or re-associate the OAuth/WebDev permission record for app ID `JmnRFmj9cCotDrmo9SM2je` through Manus Help, then retry the active domain.

## Audit validation checkpoint

The profile-photo path was repaired: browser-selected source files remain unrestricted by source size, are resized and encoded as compact WebP avatars, the client output ceiling is now 4 MB, the server decoded-byte ceiling is 8 MB, and the tRPC data-url transport ceiling is 11 MB. A regression confirms an optimized image larger than the retired 2 MB limit is accepted while signature and MIME checks remain enforced.

Validation after the repair: 194 Vitest files and 493 tests passed; the focused profile-photo, onboarding, workspace authorization, OAuth, service-worker, AI, reminder, and account-isolation groups passed; TypeScript passed; and the production build passed. The build retains a warning about a large generated shared chunk, but no manual chunk mapping was reintroduced because that previously caused a live bootstrap failure.
