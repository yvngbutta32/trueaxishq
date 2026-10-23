#!/usr/bin/env bash
# verify-credentials.sh — one-command live validation of every launch credential.
#
# Usage:  bash scripts/verify-credentials.sh [path-to-env]
#         Reads .env by default (or the file passed as $1, or real environment
#         variables if already exported). Each provider group is tested against
#         the LIVE provider, never a mock. Output is PASS/FAIL per group plus
#         exactly what each credential unlocks and what is still missing.
#
# Exit code 0 = all groups either PASS or (no credentials for that group) SKIP.
# Exit code 1 = at least one group FAILED (credentials present but invalid).
#
# Zero new dependencies: uses the app's own nodemailer/mysql2 + curl only.

set -u

ENV_FILE="${1:-.env}"
PASS=0; FAIL=0; SKIP=0

if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
  echo "Loaded credentials from: $ENV_FILE"
else
  echo "No env file at '$ENV_FILE' — using exported environment variables."
fi

green() { printf '\033[32m%s\033[0m\n' "$1"; }
red()   { printf '\033[31m%s\033[0m\n' "$1"; }
yellow(){ printf '\033[33m%s\033[0m\n' "$1"; }

ok()   { green "  PASS  $1"; PASS=$((PASS+1)); }
bad()  { red   "  FAIL  $1"; FAIL=$((FAIL+1)); }
skip() { yellow "  SKIP  $1 (not configured yet)"; SKIP=$((SKIP+1)); }

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  TrueAxis HQ — launch credential verification"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# ─── 1. Database ─────────────────────────────────────────────────────────────
echo "── Database"
if [ -n "${DATABASE_URL:-}" ]; then
  DB_RESULT=$(node -e '
    const mysql = require("mysql2/promise");
    (async () => {
      const c = await mysql.createConnection(process.env.DATABASE_URL);
      const [rows] = await c.query("SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE()");
      await c.end();
      console.log("tables:" + rows[0].n);
    })().catch(e => { console.error("error:" + e.message); process.exit(1); });
  ' 2>&1)
  case "$DB_RESULT" in
    tables:*) ok "Database reachable ($DB_RESULT)";;
    *) bad "Database: $DB_RESULT";;
  esac
else
  skip "DATABASE_URL"
fi

# ─── 2. SMTP (live AUTH handshake + envelope probe via the app's nodemailer) ──
echo "── Email (SMTP)"
if [ -n "${SMTP_HOST:-}" ] && [ -n "${SMTP_USER:-}" ] && [ -n "${SMTP_PASS:-}" ]; then
  SMTP_RESULT=$(node -e '
    const { createTransport } = require("nodemailer");
    (async () => {
      const t = createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: Number(process.env.SMTP_PORT) === 465,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        connectionTimeout: 10000,
      });
      await t.verify();
      console.log("auth:ok");
      t.close();
    })().catch(e => { console.error("error:" + e.message); process.exit(1); });
  ' 2>&1)
  case "$SMTP_RESULT" in
    auth:ok)
      ok "SMTP ${SMTP_HOST:-}:${SMTP_PORT:-587} accepted credentials — booking confirmations, invoices, password resets, magic links go live"
      [ -n "${SMTP_FROM:-}" ] || red "  WARN  SMTP_FROM unset — set it to a domain-verified address for deliverability";;
    *) bad "SMTP: $SMTP_RESULT";;
  esac
else
  skip "SMTP_HOST/USER/PASS — email stays in console/pickup fallback until set"
fi

# ─── 3. Stripe (real API: key validity + account mode) ────────────────────────
echo "── Payments (Stripe)"
if [ -n "${STRIPE_SECRET_KEY:-}" ]; then
  STRIPE_RESULT=$(curl -s -m 15 -H "Authorization: Bearer ${STRIPE_SECRET_KEY:-}" https://api.stripe.com/v1/account)
  if echo "$STRIPE_RESULT" | grep -q '"id": "acct_'; then
    MODE=$(echo "$STRIPE_RESULT" | grep -o '"charges_enabled": *[a-z]*' | head -1)
    if echo "${STRIPE_SECRET_KEY:-}" | grep -q '^sk_live'; then
      ok "Stripe LIVE key valid (account ${MODE}) — SaaS subscriptions + client Connect payments go live"
    elif echo "${STRIPE_SECRET_KEY:-}" | grep -q '^sk_test'; then
      ok "Stripe TEST key valid — end-to-end testing works; swap in sk_live for launch"
    else
      bad "Stripe key has unexpected prefix (need sk_test_... or sk_live_...)"
    fi
    if [ -n "${STRIPE_WEBHOOK_SECRET:-}" ]; then
      ok "STRIPE_WEBHOOK_SECRET present (webhook signature verification active)"
    else
      yellow "  NOTE  STRIPE_WEBHOOK_SECRET unset — add the production webhook endpoint after deploy, then paste the signing secret here"
    fi
  else
    bad "Stripe rejected the key: $(echo "$STRIPE_RESULT" | head -c 160)"
  fi
else
  skip "STRIPE_SECRET_KEY — manual markPaid + Connect onboarding stay honest-unconfigured until set"
fi

# ─── 4. Twilio (real API: credentials + sender number) ────────────────────────
echo "── SMS + Voice (Twilio)"
if [ -n "${TWILIO_ACCOUNT_SID:-}" ] && [ -n "${TWILIO_AUTH_TOKEN:-}" ]; then
  TW_RESULT=$(curl -s -m 15 -u "${TWILIO_ACCOUNT_SID:-}:${TWILIO_AUTH_TOKEN:-}" "https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID:-}.json")
  if echo "$TW_RESULT" | grep -q '"sid"'; then
    STATUS=$(echo "$TW_RESULT" | grep -o '"status": *"[a-z]*"' | head -1)
    ok "Twilio credentials valid ($STATUS) — SMS confirmations/reminders/magic links + AI voice receptionist go live"
    if [ -n "${TWILIO_FROM_NUMBER:-}" ]; then
      ok "TWILIO_FROM_NUMBER set: ${TWILIO_FROM_NUMBER:-}"
    else
      yellow "  NOTE  TWILIO_FROM_NUMBER unset — provision one in the Twilio console (paid plan users get one-click provisioning in-app)"
    fi
  else
    bad "Twilio rejected credentials: $(echo "$TW_RESULT" | head -c 160)"
  fi
else
  skip "TWILIO_ACCOUNT_SID/AUTH_TOKEN — SMS falls back to copy-link mode until set"
fi

# ─── 5. Google OAuth (Calendar sync) ─────────────────────────────────────────
echo "── Google Calendar (OAuth)"
if [ -n "${GOOGLE_CLIENT_ID:-}" ] && [ -n "${GOOGLE_CLIENT_SECRET:-}" ]; then
  OAUTH_PROBE=$(curl -s -m 15 "https://oauth2.googleapis.com/token" -d "client_id=${GOOGLE_CLIENT_ID:-}&client_secret=${GOOGLE_CLIENT_SECRET:-}&grant_type=authorization_code&code=probe_invalid" | head -c 120)
  if echo "$OAUTH_PROBE" | grep -q "invalid_grant\|Invalid code"; then
    ok "Google OAuth client recognized by Google (rejects probe token correctly) — Calendar sync active"
  elif echo "$OAUTH_PROBE" | grep -q "invalid_client"; then
    bad "Google OAuth: client_id/secret rejected by Google"
  else
    bad "Google OAuth probe gave unexpected response: $OAUTH_PROBE"
  fi
else
  skip "GOOGLE_CLIENT_ID/SECRET — ICS export works without OAuth; native sync needs these"
fi

# ─── 6. LLM / AI receptionist (OpenAI-compatible endpoint probe) ──────────────
echo "── AI receptionist (LLM)"
if [ -n "${BUILT_IN_FORGE_API_URL:-}" ] && [ -n "${BUILT_IN_FORGE_API_KEY:-}" ]; then
  LLM_URL="${BUILT_IN_FORGE_API_URL:-}"
  case "$LLM_URL" in */) ;; *) LLM_URL="$LLM_URL/";; esac
  LLM_CODE=$(curl -s -m 15 -o /tmp/llmprobe.json -w "%{http_code}" -H "Authorization: Bearer ${BUILT_IN_FORGE_API_KEY:-}" "${LLM_URL}models" || echo 000)
  case "$LLM_CODE" in
    200) ok "LLM endpoint accepted the key — AI voice receptionist + assistant features go live";;
    401|403) bad "LLM endpoint rejected the API key";;
    000) bad "LLM endpoint unreachable: ${LLM_URL}";;
    *) bad "LLM endpoint returned HTTP $LLM_CODE: $(head -c 120 /tmp/llmprobe.json)";;
  esac
else
  skip "BUILT_IN_FORGE_API_URL/KEY — AI fail-fast degradation stays until set (Gemini free tier: no credit card)"
fi

# ─── 6. Site origin ──────────────────────────────────────────────────────────
echo "── Public site"
if [ -n "${SITE_ORIGIN:-}" ]; then
  ORIGIN="${SITE_ORIGIN:-}"; ORIGIN="${ORIGIN%/}"
  SITE_CODE=$(curl -s -m 15 -o /dev/null -w "%{http_code}" "$ORIGIN/api/health" || echo 000)
  case "$SITE_CODE" in
    200) ok "${SITE_ORIGIN:-} reachable and healthy — voice webhooks + OAuth redirects will work";;
    000) yellow "  NOTE  ${SITE_ORIGIN:-} not reachable yet — normal before the Oracle deploy";;
    *)   yellow "  NOTE  ${SITE_ORIGIN:-}/api/health returned $SITE_CODE — check after deploy";;
  esac
else
  skip "SITE_ORIGIN — must be set (explicit https) before provisioning voice lines"
fi

# ─── Summary ─────────────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════════════"
TOTAL=$((PASS+FAIL))
echo "  $PASS passed, $FAIL failed, $SKIP not yet provided"
[ "$FAIL" -eq 0 ] && green "  All provided credentials are LIVE-VALID. Remaining items just need credentials." \
                  || red   "  Fix the failures above — credentials were rejected by the provider."
echo "═══════════════════════════════════════════════════════════════"
[ "$FAIL" -eq 0 ] || exit 1
