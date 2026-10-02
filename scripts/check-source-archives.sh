#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if git ls-files | grep -Ei '\.(zip|tar|tgz|tar\.gz|7z|rar)$'; then
  echo "Release archives must be CI artifacts, never tracked source." >&2
  exit 1
fi
echo "Tracked source contains no archives."
