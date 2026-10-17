#!/usr/bin/env bash
# Stops the local test stack started by start.sh.
STACK_DIR="${STACK_DIR:-/var/tmp/cu-housing-stack}"
for f in "$STACK_DIR"/*.pid; do
  [ -f "$f" ] || continue
  pid=$(cat "$f")
  kill -- "-$pid" 2>/dev/null || kill "$pid" 2>/dev/null || true
  rm -f "$f"
done
