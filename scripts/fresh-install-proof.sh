#!/usr/bin/env bash
# Fresh-install proof for TrueAxis HQ (Oct 23 2026 full-scope audit).
#
# Why this exists: drizzle skips journal entries already applied — by timestamp,
# not file hash — so a broken migration file is INVISIBLE on a dev database
# that was hand-patched. The Oct 23 audit found migrations 0083-0086 had their
# `--> statement-breakpoint` markers placed inside single ALTER statements;
# drizzle-kit migrate aborted at 0083 on every fresh install. This script is
# the live gate: apply the full migration chain to a truly empty database,
# boot the production build against it, and run the smoke suite.
#
# Usage:  ./scripts/fresh-install-proof.sh
# Needs:   MySQL/MariaDB with root socket access; trueaxis TCP user.
set -euo pipefail
cd "$(dirname "$0")/.."

AUDIT_DB="trueaxis_fresh_proof"
PORT="${FRESH_PROOF_PORT:-3999}"
BASE_URL="http://localhost:${PORT}"

echo "── 1/5 Building production bundle"
pnpm run build >/dev/null

echo "── 2/5 Creating empty database ${AUDIT_DB}"
mysql -uroot -e "DROP DATABASE IF EXISTS \`${AUDIT_DB}\`;"
mysql -uroot -e "CREATE DATABASE \`${AUDIT_DB}\`;"
mysql -uroot -e "GRANT ALL PRIVILEGES ON \`${AUDIT_DB}\`.* TO 'trueaxis'@'localhost'; GRANT ALL PRIVILEGES ON \`${AUDIT_DB}\`.* TO 'trueaxis'@'127.0.0.1'; FLUSH PRIVILEGES;"

echo "── 3/5 Applying the full migration chain to the empty database"
JOURNAL_ENTRIES=$(python3 -c "import json; print(len(json.load(open('drizzle/meta/_journal.json'))['entries']))")
DATABASE_URL="mysql://trueaxis:trueaxis@127.0.0.1:3306/${AUDIT_DB}" npx drizzle-kit migrate >/dev/null
APPLIED=$(mysql -utrueaxis -ptrueaxis "${AUDIT_DB}" -N -e "SELECT COUNT(*) FROM __drizzle_migrations;")
if [ "${APPLIED}" != "${JOURNAL_ENTRIES}" ]; then
  echo "FAIL: applied ${APPLIED} of ${JOURNAL_ENTRIES} journal entries — the migration chain is broken."
  exit 1
fi
echo "   OK: all ${APPLIED} journal entries applied to the empty database"

echo "── 4/5 Booting production build on :${PORT} against the fresh database"
DATABASE_URL="mysql://trueaxis:trueaxis@127.0.0.1:3306/${AUDIT_DB}" PORT="${PORT}" NODE_ENV=production node dist/index.js &
SERVER_PID=$!
trap 'kill ${SERVER_PID} 2>/dev/null || true' EXIT
for i in $(seq 1 30); do curl -sf -o /dev/null "${BASE_URL}/api/health" && break; sleep 1; done

echo "── 5/5 Running the smoke suite against the fresh install"
if ! BASE_URL="${BASE_URL}" ./scripts/smoke.sh; then
  echo "FAIL: smoke suite against fresh install"
  exit 1
fi

echo ""
echo "FRESH-INSTALL PROOF PASSED: ${APPLIED} migrations, empty database → production boot → smoke green."
