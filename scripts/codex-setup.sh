#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
node -e 'if (process.versions.node.split(".")[0] !== "22") { console.error("Select Node 22 for the Codex environment; see .node-version."); process.exit(1); }'
if command -v pnpm >/dev/null && [[ "$(pnpm --version)" == "10.4.1" ]]; then
  pnpm install --frozen-lockfile --strict-peer-dependencies
elif command -v corepack >/dev/null; then
  corepack pnpm install --frozen-lockfile --strict-peer-dependencies
else
  echo "Enable Corepack or install pnpm 10.4.1 in the environment." >&2
  exit 1
fi
bash scripts/check-source-archives.sh
