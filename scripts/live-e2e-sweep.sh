#!/usr/bin/env bash
# TrueAxis HQ — one-command LIVE verification sweep.
#
# Boots the real production bundle against the dev database on :3998 with the
# e2e environment (voice AI pointed at the suite's own mock OpenAI-compatible
# LLM on :4001), then runs every live e2e suite plus the public smoke checks.
# This is the release-discipline gate that proves the shipped artifact, not
# just the unit suite: real HTTP, real login, real database.
#
# Usage:  ./scripts/live-e2e-sweep.sh
# Needs:   MySQL/MariaDB running with the dev `trueaxis` database up to date
#          (run `DATABASE_URL=... npx drizzle-kit migrate` if needed).
set -uo pipefail
cd "$(dirname "$0")/.."

PORT="${SWEEP_PORT:-3998}"
BASE_URL="http://localhost:${PORT}"
DB_URL="${DATABASE_URL:-mysql://trueaxis:trueaxis@127.0.0.1:3306/trueaxis}"

echo "── 1/4 Preflight: database reachable, build current"
if ! node -e "
const mysql = require('mysql2/promise');
(async () => {
  const c = await mysql.createConnection(process.env.DATABASE_URL || 'mysql://trueaxis:trueaxis@127.0.0.1:3306/trueaxis');
  await c.query('SELECT 1');
  await c.end();
})().catch(e => { console.error(e.message); process.exit(1); });
"; then
  echo "DATABASE NOT REACHABLE — start MySQL/MariaDB first (dev DB is the sweep's backing store)."
  exit 1
fi
pnpm run build >/dev/null

echo "── 2/4 Booting production bundle on :${PORT} (dev DB, e2e voice env)"
pkill -f "node dist/index.js" 2>/dev/null || true
sleep 1
DATABASE_URL="${DB_URL}" \
JWT_SECRET="live-e2e-sweep-secret" \
PORT="${PORT}" \
NODE_ENV=production \
SITE_ORIGIN="${BASE_URL}" \
TWILIO_AUTH_TOKEN="e2e-twilio-token" \
BUILT_IN_FORGE_API_URL="http://localhost:4001/v1" \
BUILT_IN_FORGE_API_KEY="e2e-forge-key" \
node dist/index.js > /tmp/live-e2e-sweep-server.log 2>&1 &
SERVER_PID=$!
trap 'kill ${SERVER_PID} 2>/dev/null; pkill -f "node dist/index.js" 2>/dev/null' EXIT

for i in $(seq 1 30); do
  if curl -sf "${BASE_URL}/api/health" >/dev/null 2>&1; then break; fi
  sleep 1
done
if ! curl -sf "${BASE_URL}/api/health" >/dev/null 2>&1; then
  echo "SERVER FAILED TO BOOT — log tail:"; tail -20 /tmp/live-e2e-sweep-server.log; exit 1
fi
echo "Server healthy on ${BASE_URL}"

echo "── 3/4 Live e2e suites (real HTTP against the production build)"
SUITES=(
  "QR asset labels|test/e2e-asset-qr.mjs"
  "PO job costing|test/e2e-po-job-costing.mjs"
  "QBO demand gate|test/e2e-qbo-demand.mjs"
  "Public review engine|test/e2e-review-requests.mjs"
  "AI voice hardening|test/e2e-voice-hardening.mjs"
  "Adversarial security probe|test/e2e-security-probe.mjs"
)
FAILURES=0
for entry in "${SUITES[@]}"; do
  name="${entry%%|*}"; script="${entry#*|}"
  echo ""
  echo "▶ ${name} (${script})"
  if node "${script}"; then
    echo "✓ ${name}: PASS"
  else
    echo "✗ ${name}: FAIL"
    FAILURES=$((FAILURES + 1))
  fi
done

echo ""
echo "── 4/4 Public smoke checks"
if BASE_URL="${BASE_URL}" ./scripts/smoke.sh; then
  SMOKE=0
else
  SMOKE=1
  FAILURES=$((FAILURES + 1))
fi

echo ""
if [ "${FAILURES}" -eq 0 ]; then
  echo "LIVE E2E SWEEP PASSED: ${#SUITES[@]} suites + smoke green against the production build."
  exit 0
fi
echo "LIVE E2E SWEEP FAILED: ${FAILURES} failing suite(s)."
exit 1
