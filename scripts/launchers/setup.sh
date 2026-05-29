#!/usr/bin/env bash
# Symlink-friendly Linux equivalent of setup.command
exec "$(dirname "$0")/setup.command" "$@"
