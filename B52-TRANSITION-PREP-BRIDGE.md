# B52 — Transition Decision & Preparation Bridge

Student OS now turns the Academic Journey transition hub into a connected preparation surface instead of a separate checklist.

## Included

- Stage-aware transition hubs seed a small set of preparation steps for JHS, SHS, and later-stage transitions.
- Transition preparation steps can be promoted into the canonical Student OS task system.
- Promoted tasks carry explicit `origin: "transition"` provenance plus a stable `sourceRef` so the same preparation step cannot be intentionally added twice.
- The main task system remains canonical, so promoted transition work can flow into Today, recovery, Focus, and the existing execution feedback loop without introducing a second planner.
- WASSCE best-six calculation now de-duplicates normalized subject names before selecting results, reducing the risk of duplicate result rows distorting an aggregate.
- Transition planning keeps academic identity and admission decisions separate: preparation work does not change class/year, and stored option requirements remain planning signals rather than admission guarantees.

## Verification status

Source implementation only. The extracted environment still lacks the project's Node dependency graph, so the full Vitest, TypeScript, and production-build gates must be rerun in the real project environment before this checkpoint is treated as fully verified.

A local global `tsc` invocation was attempted, but it stopped immediately because `@types/node` and `vite/client` are not installed in the extracted environment.
