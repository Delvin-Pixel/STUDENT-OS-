#!/usr/bin/env bash
# Credential-free verification. Disposable database integration remains a CI stage.
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ -n "${DATABASE_URL:-}" || -n "${JWT_SECRET:-}" ]]; then
  echo "Run local verification in a credential-free shell; use CI for disposable database tests." >&2
  exit 1
fi
if [[ -f .env || -f .env.local ]]; then
  echo "Use a clean worktree without local environment files for verification." >&2
  exit 1
fi
if [[ "$(node --version)" != "v$(cat .node-version)" ]]; then
  echo "Select the exact Node version in .node-version." >&2
  exit 1
fi
if [[ "$(pnpm --version)" != "10.4.1" ]]; then
  echo "Select pnpm 10.4.1." >&2
  exit 1
fi
bash scripts/codex-setup.sh
pnpm check
pnpm lint
pnpm format:check
pnpm check:migrations
pnpm scan:credentials
pnpm exec vitest run shared/entitlements.test.ts shared/workspaceSchema.tombstoneIntegrity.test.ts
pnpm test
pnpm build
pnpm verify:bundle
node scripts/check-vercel-runtime.mjs
pnpm audit --audit-level high
pnpm audit --prod --audit-level high
printf '%s\n' 'PASS: local source, tests, build and handler gates. Live release gates remain unverified.'
