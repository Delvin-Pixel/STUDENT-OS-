#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 /absolute/path/to/student-os-b58.1.zip" >&2
  exit 64
fi

archive="$1"
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

git rev-parse --is-inside-work-tree >/dev/null

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Refusing checkpoint: tracked working tree has changes." >&2
  exit 1
fi
if [[ -n "$(git ls-files --others --exclude-standard)" ]]; then
  echo "Refusing checkpoint: untracked source files exist." >&2
  exit 1
fi

pnpm scan:credentials
pnpm check
pnpm format:check
pnpm test
pnpm build
pnpm check:migrations

mkdir -p "$(dirname "$archive")"
rm -f "$archive"
git archive --format=zip --output="$archive" HEAD
unzip -tq "$archive"
sha256sum "$archive"
