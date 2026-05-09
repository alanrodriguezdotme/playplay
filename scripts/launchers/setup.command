#!/usr/bin/env bash
# PlayPlay Venue — first-run setup launcher (macOS / Linux .command/.sh)
set -euo pipefail
DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$DIR"
exec node scripts/setup.mjs "$@"
