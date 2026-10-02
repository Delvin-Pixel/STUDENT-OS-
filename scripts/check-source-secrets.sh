#!/usr/bin/env bash
set -euo pipefail

# Source-only release gate. A security scan must never echo a discovered
# credential value into terminal logs or CI output.
cd "$(dirname "$0")/.."

files=()
if command -v git >/dev/null 2>&1 && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  mapfile -d '' -t files < <(git ls-files -co --exclude-standard -z)
else
  echo "Not inside a Git worktree; using filesystem source scan." >&2
  mapfile -d '' -t files < <(
    find . -type f \
      ! -path './node_modules/*' \
      ! -path './dist/*' \
      ! -path './coverage/*' \
      -print0
  )
fi

if (( ${#files[@]} == 0 )); then
  echo "Credential scan refused to pass: no files were enumerated." >&2
  exit 2
fi

findings=0
scanned=0
for file in "${files[@]}"; do
  [[ -f "$file" ]] || continue
  [[ "$file" == *.zip || "$file" == *.png || "$file" == *.jpg || "$file" == *.jpeg || "$file" == *.webp || "$file" == *.pdf ]] && continue
  scanned=$((scanned + 1))

  if grep -I -E -q -- \
    "-----BEGIN ([A-Z ]+ )?PRIVATE KEY-----|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{20,}|glpat-[A-Za-z0-9_-]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|(OPENAI_API_KEY|JWT_SECRET|VAPID_PRIVATE_KEY|BUILT_IN_FORGE_API_KEY|DATABASE_URL)[[:space:]]*[:=][[:space:]]*['\"]?[A-Za-z0-9_./+=-]{16,}" \
    "$file"; then
    echo "Potential credential literal detected in: $file" >&2
    findings=1
  fi
done

if (( scanned == 0 )); then
  echo "Credential scan refused to pass: no source files were scanned." >&2
  exit 2
fi

if (( findings > 0 )); then
  echo "Credential scan failed. Remove the literal and store it in managed secrets instead." >&2
  exit 1
fi

echo "Credential scan passed: no likely credential literals found across $scanned source files."
