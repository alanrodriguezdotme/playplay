#!/usr/bin/env bash
# PlayPlay Venue — start launcher (macOS / Linux .command/.sh)
# If setup hasn't run yet, falls through to the wizard.
set -euo pipefail
DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$DIR"
STAMP="packages/server/.playplay-configured"
if [ ! -f "$STAMP" ]; then
  exec node scripts/setup.mjs
fi
PORT="$(grep -E '^PORT=' packages/server/.env 2>/dev/null | head -n1 | cut -d= -f2 || echo 3001)"
URL="http://127.0.0.1:${PORT}/admin"

# Best-effort browser open in the background after the server warms up.
(
  sleep 2
  if command -v open >/dev/null 2>&1; then open "$URL"
  elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$URL"
  fi
) >/dev/null 2>&1 &

exec node packages/server/dist/index.js
