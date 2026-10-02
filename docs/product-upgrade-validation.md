# Connected Student OS upgrade validation

This record contains only observed validation evidence for the P0–P3 preparation increment.

| Area                  | Observed evidence                                                                                                                                           | Outcome                                                                                   |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Automated regression  | Full `pnpm test` run completed with **45 test files / 152 tests** passing.                                                                                  | Passed.                                                                                   |
| Type safety           | `pnpm exec tsc --noEmit` completed successfully.                                                                                                            | Passed.                                                                                   |
| Production build      | `pnpm run build` completed successfully in 16.02 seconds.                                                                                                   | Passed.                                                                                   |
| Bundle review         | Build emitted existing chunk-size warnings; main JavaScript was approximately 1.95 MB minified and the AI chat chunk approximately 938 KB.                  | Warning retained as a future performance optimisation; not a build failure.               |
| Mobile review         | A 375×812 authenticated preview showed the responsive dashboard with a compact top bar, cards, actions, and no horizontal overflow observed.                | Passed for the current preview session.                                                   |
| Desktop review        | A 1280×720 authenticated preview showed the desktop navigation and dashboard hierarchy without visible clipping.                                            | Passed for the current preview session.                                                   |
| Account boundary      | Prior core validation established an unauthenticated workspace request returns HTTP 401; account-scoped workspace regression coverage remains in the suite. | Preserved.                                                                                |
| P3 content governance | Official Ministry of Education Ghana and NaCCA sources were reviewed and recorded in `docs/p3-ghana-extension-boundaries.md`.                               | Future-only boundary; no public social network or automatic curriculum scraping released. |

## Manual acceptance still required

The following checks require a real learner session or a physical device and are not claimed as automated evidence: signing into a second account and confirming isolation; restoring a workspace on a second device; performing a real PDF upload and explicit summary request; testing installed-PWA notification delivery; and checking live performance on the learner’s device and connection.
