#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# TrueAxis HQ — Oracle Cloud (Always Free) one-command installer
#
# Run this ON your fresh Oracle Ubuntu instance as the "ubuntu" user:
#   ssh -i <your-key> ubuntu@<PUBLIC_IP>
#   bash <(curl -fsSL https://raw.githubusercontent.com/yvngbutta32/trueaxishq/main/scripts/oracle-setup.sh)
#   (or copy this file up and run: sudo bash scripts/oracle-setup.sh --domain app.yourdomain.com)
#
# What it does (idempotent — safe to re-run):
#   1. Installs Node 22, pnpm, MariaDB, Caddy
#   2. Creates the database + a least-privilege DB user with a generated password
#   3. Clones the app (needs a GitHub read token for the private repo) to /opt/trueaxis
#   4. Generates .env (JWT secret, bootstrap invite code, SITE_ORIGIN)
#   5. Installs deps, builds, applies all migrations
#   6. Installs a systemd service (auto-restart, boots on reboot)
#   7. Configures Caddy with automatic HTTPS for your domain
#   8. Opens ports 80/443 in the Ubuntu firewall (Oracle VCN rules are separate — see runbook)
#
# Required flag:  --domain app.yourdomain.com   (a DNS A record must point at this server)
# Optional flag:   --github-token ghp_xxx        (repo read token; prompted if omitted)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

DOMAIN=""
GITHUB_TOKEN=""
APP_PORT=8080

while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain) DOMAIN="$2"; shift 2 ;;
    --github-token) GITHUB_TOKEN="$2"; shift 2 ;;
    --port) APP_PORT="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

if [[ $EUID -ne 0 ]]; then echo "Run as root: sudo bash $0 --domain app.yourdomain.com"; exit 1; fi
if [[ -z "$DOMAIN" ]]; then echo "Missing --domain. First buy/point a domain, then re-run."; exit 1; fi

echo "──────────────────────────────────────────"
echo " TrueAxis HQ installer for: https://${DOMAIN}"
echo "──────────────────────────────────────────"

# ── 1. Packages ──────────────────────────────────────────────────────────────
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl ca-certificates gnupg git mariadb-server

if ! command -v node >/dev/null || [[ "$(node -v | cut -c2- | cut -d. -f1)" -lt 20 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
corepack enable 2>/dev/null || true

if ! command -v caddy >/dev/null; then
  # Official Caddy repository (not in Ubuntu default repos)
  install -d -m 0755 /usr/share/keyrings
  curl -fsSL "https://dl.cloudflare.com/caddy/gpg" -o /usr/share/keyrings/caddy-archive-keyring.gpg 2>/dev/null || \
    curl -fsSL "https://caddyserver.com/api/download/os/pgp?key=host#caddy" -o /usr/share/keyrings/caddy-archive-keyring.gpg 2>/dev/null || true
  echo "deb [signed-by=/usr/share/keyrings/caddy-archive-keyring.gpg] https://dl.cloudflare.com/caddy/deb stable main" > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y && apt-get install -y caddy
fi

# ── 2. Database ──────────────────────────────────────────────────────────────
systemctl enable --now mariadb 2>/dev/null || true
DB_NAME=trueaxis
DB_USER=trueaxis
DB_PASS_PRESET=""
if [[ -f /opt/trueaxis/.env ]]; then
  DB_PASS_PRESET=$(grep -m1 '^DATABASE_URL=' /opt/trueaxis/.env | sed -E 's|.*/trueaxis:([^@]*)@.*|\1|' || true)
fi
DB_PASS="${DB_PASS_PRESET:-$(openssl rand -hex 16)}"
mysql -e "CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -e "CREATE USER IF NOT EXISTS '${DB_USER}'@'127.0.0.1' IDENTIFIED BY '${DB_PASS}';"
mysql -e "ALTER USER '${DB_USER}'@'127.0.0.1' IDENTIFIED BY '${DB_PASS}';"
mysql -e "GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'127.0.0.1'; FLUSH PRIVILEGES;"

# ── 3. App code ──────────────────────────────────────────────────────────────
id -u trueaxis >/dev/null 2>&1 || useradd --system --home /opt/trueaxis --shell /usr/sbin/nologin trueaxis
mkdir -p /opt/trueaxis
if [[ ! -d /opt/trueaxis/.git && ! -f /opt/trueaxis/package.json ]]; then
  if [[ -z "$GITHUB_TOKEN" ]]; then
    echo ""
    echo "The repo is private. Create a fine-grained GitHub token with read-only"
    echo "access to yvngbutta32/trueaxishq (Settings → Developer settings → Tokens),"
    echo "then paste it here:"
    read -r -s GITHUB_TOKEN
  fi
  git clone "https://x-access-token:${GITHUB_TOKEN}@github.com/yvngbutta32/trueaxishq.git" /opt/trueaxis
  git -C /opt/trueaxis remote set-url origin "$(git -C /opt/trueaxis remote get-url origin | sed "s|x-access-token:${GITHUB_TOKEN}@||")"
else
  git -C /opt/trueaxis pull --ff-only 2>/dev/null || echo "(existing install kept — manual git pull if needed)"
fi
chown -R trueaxis:trueaxis /opt/trueaxis

# ── 4. Environment ───────────────────────────────────────────────────────────
if [[ ! -f /opt/trueaxis/.env ]]; then
  cat > /opt/trueaxis/.env <<ENV
NODE_ENV=production
PORT=${APP_PORT}
DATABASE_URL=mysql://${DB_USER}:${DB_PASS}@127.0.0.1:3306/${DB_NAME}
JWT_SECRET=$(openssl rand -hex 32)
BOOTSTRAP_INVITE_CODE=$(openssl rand -hex 3 | tr 'a-f' 'A-F' | cut -c1-6)
SITE_ORIGIN=https://${DOMAIN}
ENV
  chmod 600 /opt/trueaxis/.env
  chown trueaxis:trueaxis /opt/trueaxis/.env
fi
BOOTSTRAP_CODE=$(grep -m1 '^BOOTSTRAP_INVITE_CODE=' /opt/trueaxis/.env | cut -d= -f2)

# ── 5. Build + migrate ───────────────────────────────────────────────────────
cd /opt/trueaxis
sudo -u trueaxis corepack pnpm install --frozen-lockfile
sudo -u trueaxis corepack pnpm build
sudo -u trueaxis env DATABASE_URL="mysql://${DB_USER}:${DB_PASS}@127.0.0.1:3306/${DB_NAME}" \
  corepack pnpm drizzle-kit migrate

# ── 6. systemd service ───────────────────────────────────────────────────────
cat > /etc/systemd/system/trueaxis.service <<UNIT
[Unit]
Description=TrueAxis HQ
After=network.target mariadb.service

[Service]
Type=simple
User=trueaxis
WorkingDirectory=/opt/trueaxis
EnvironmentFile=/opt/trueaxis/.env
ExecStart=$(command -v node) dist/index.js
Restart=always
RestartSec=3
NoNewPrivileges=true
ProtectSystem=full
PrivateTmp=true

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now trueaxis

# ── 7. Caddy reverse proxy with automatic HTTPS ──────────────────────────────
cat > /etc/caddy/Caddyfile <<CADDY
${DOMAIN} {
    encode gzip
    reverse_proxy 127.0.0.1:${APP_PORT}
}
CADDY
systemctl enable --now caddy 2>/dev/null || true
systemctl restart caddy

# ── 8. Ubuntu firewall (Oracle images REJECT 80/443 by default) ──────────────
add_rule() { iptables -C INPUT -p tcp --dport "$1" -j ACCEPT 2>/dev/null || iptables -I INPUT -p tcp --dport "$1" -j ACCEPT; }
add_rule 80
add_rule 443
command -v netfilter-persistent >/dev/null && netfilter-persistent save 2>/dev/null || iptables-save > /etc/iptables/rules.v4 2>/dev/null || true

# ── Done ─────────────────────────────────────────────────────────────────────
sleep 3
echo ""
echo "════════════════════════════════════════════════════════"
echo " ✔ Installed. Your app should be live at: https://${DOMAIN}"
echo "════════════════════════════════════════════════════════"
echo ""
echo " First owner invite code (one-time, register at /register): ${BOOTSTRAP_CODE}"
echo " Health check:  curl -s https://${DOMAIN}/api/health"
echo " Smoke test:     BASE_URL=https://${DOMAIN} bash scripts/smoke.sh"
echo " Logs:           journalctl -u trueaxis -f"
echo ""
echo " If the site is NOT reachable, the usual cause is Oracle's VCN"
echo " security list: see docs/working-notes/oracle-deploy-runbook.md step 3."
echo " Next: add provider credentials to /opt/trueaxis/.env as you get them,"
echo " then: systemctl restart trueaxis"
