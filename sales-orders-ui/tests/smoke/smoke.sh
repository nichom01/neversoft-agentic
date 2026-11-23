#!/usr/bin/env bash
# Smoke tests for the sales-orders-ui project.
#   T-1: clean install, typecheck, build and dev server start (AC-1, AC-6)
#   T-2: root Java test still passes and nothing existing is modified (AC-8)
# Optional: BASE_REF=<git ref> (default: origin/main) is the base for the T-2 diff.
# Optional: SMOKE_PORT=<port> (default: 5173) for the dev server check.
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
REPO_ROOT="$(git -C "$PROJECT_DIR" rev-parse --show-toplevel)"
PORT="${SMOKE_PORT:-5173}"
URL="http://localhost:${PORT}/"
LOG="$(mktemp)"
SERVER_PID=""

cleanup() {
  if [ -n "$SERVER_PID" ]; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  rm -f "$LOG"
}
trap cleanup EXIT

echo "== T-1: install, typecheck, build, dev server =="
cd "$PROJECT_DIR"
npm ci
npm run typecheck
npm run build

npm run dev -- --port "$PORT" --strictPort >"$LOG" 2>&1 &
SERVER_PID=$!

ok=0
for _ in $(seq 1 30); do
  body="$(curl -s -m 2 -w '\n%{http_code}' "$URL" || true)"
  code="$(printf '%s' "$body" | tail -n 1)"
  if [ "$code" = "200" ] && printf '%s' "$body" | grep -q 'id="root"'; then
    ok=1
    break
  fi
  sleep 1
done
if [ "$ok" -ne 1 ]; then
  echo "FAIL T-1: dev server did not serve $URL with id=\"root\"" >&2
  cat "$LOG" >&2
  exit 1
fi
echo "PASS T-1"

echo "== T-2: root test and no modified existing files =="
cd "$REPO_ROOT"
npm test

BASE="$(git merge-base HEAD "${BASE_REF:-origin/main}")"
bad=0
while IFS=$'\t' read -r status path _; do
  [ -z "$status" ] && continue
  case "$path" in
    sales-orders-ui/* | docs/bob/5/*) [ "$status" = "A" ] || { echo "Not an addition: $status $path" >&2; bad=1; } ;;
    *) echo "Unexpected change: $status $path" >&2; bad=1 ;;
  esac
done < <(git diff --name-status "$BASE")
# Untracked files (not yet added) must also be under the allowed paths.
while IFS= read -r path; do
  case "$path" in
    sales-orders-ui/* | docs/bob/5/*) ;;
    *) echo "Unexpected untracked file: $path" >&2; bad=1 ;;
  esac
done < <(git ls-files --others --exclude-standard)
if [ "$bad" -ne 0 ]; then
  echo "FAIL T-2" >&2
  exit 1
fi
echo "PASS T-2"
