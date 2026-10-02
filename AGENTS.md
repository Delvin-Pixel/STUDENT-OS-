# Student OS working contract

Work in `Delvin-Pixel/STUDENT-OS-`. `main` is canonical. B58.1 is the required
checkpoint before B59. Use build → test → fix → integrate → verify → move forward.
Keep B58.1 PRs draft until all release gates pass. Do not merge without explicit
user authorization. Never commit bootstrap ZIPs or other release archives.

## Architecture and trust boundaries

- StudyState contains academic workspace state, never Premium authority.
- learningIntelligence is the sole deterministic academic-intelligence engine.
- NEXA remains a future conversational/general-AI adapter and cannot override
  Student OS deterministic decisions.
- Free retains the core educational experience.
- External Premium fails closed on invalid or stale billing metadata.
- Learner/client-supplied Transition data cannot become official or
  Student-OS-verified authority.
- Preserve service-worker privacy, account isolation, strict types, and tests.

## Environment

Use Node from `.node-version` and pnpm 10.4.1. Run
`bash scripts/codex-setup.sh` as the Codex setup command. Checkout source directly
from GitHub; no archive extraction or bootstrap branch is required. Never place
real production credentials in setup scripts, committed files, or logs.

## Required verification

Run frozen strict dependency install, `pnpm check`, `pnpm lint`,
`pnpm format:check`, `pnpm check:migrations`, `pnpm scan:credentials`, critical
shared entitlement/tombstone tests, `pnpm test`, `pnpm build`, and
`pnpm verify:bundle`. CI must also apply all migrations to clean MySQL 8.4,
run `pnpm verify:migration-schema`, and run full and production dependency audits.
Do not claim release verification until GitHub Actions passes for the PR revision.
Do not weaken gates or change security expectations merely to make CI green.
