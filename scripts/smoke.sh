#!/usr/bin/env bash
# TrueAxis HQ — one-command production smoke test.
# Run against a deployed instance right after launch (or any deploy):
#   BASE_URL=https://your-domain.com ./scripts/smoke.sh
# Exits non-zero on the first failed check, printing PASS/FAIL per line.
set -uo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
FAIL=0

check() {
  local name="$1" expect="$2" url="$3" extra_grep="${4:-}"
  local body status
  body="$(curl -sS -w '\n%{http_code}' "$url" 2>&1)" || { echo "FAIL $name (request error)"; FAIL=1; return; }
  status="$(tail -n1 <<<"$body")"
  body="$(sed '$d' <<<"$body")"
  if [ "$status" != "$expect" ]; then
    echo "FAIL $name — expected HTTP $expect, got $status ($url)"; FAIL=1; return
  fi
  if [ -n "$extra_grep" ] && ! grep -qi "$extra_grep" <<<"$body"; then
    echo "FAIL $name — HTTP ok but expected content '$extra_grep' missing ($url)"; FAIL=1; return
  fi
  echo "PASS $name ($status)"
}

echo "Smoke-testing $BASE_URL"
check "health endpoint"          200 "$BASE_URL/api/health" "ok\|status"
check "app shell (SPA)"         200 "$BASE_URL/"
check "self-hosted fonts"       200 "$BASE_URL/fonts/inter.css"
check "pricing page"            200 "$BASE_URL/pricing" "TrueAxis"
check "status page"             200 "$BASE_URL/status" "status"
check "security page"           200 "$BASE_URL/security" "security"
check "public API is gated"     401 "$BASE_URL/api/v1/clients" "api_key"
check "tRPC ops metrics gated" 401 "$BASE_URL/api/trpc/ops.metrics?batch=1&input=%7B%7D" "UNAUTHORIZED"
check "expired tracking token"  404 "$BASE_URL/api/track/definitely-not-a-real-token"
check "expired sub token"       404 "$BASE_URL/api/sub/definitely-not-a-real-token"

if [ "$FAIL" -eq 0 ]; then
  echo "ALL CHECKS PASSED — deployment is live and behaving."
else
  echo "SMOKE FAILED — fix the lines above before launch." >&2
  exit 1
fi
