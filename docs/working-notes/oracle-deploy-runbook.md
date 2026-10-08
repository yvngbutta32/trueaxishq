# Oracle Cloud Deployment Runbook — TrueAxis HQ

**Goal:** run TrueAxis HQ at $0/month fixed cost on Oracle Cloud's Always Free tier (4 ARM cores, 24 GB RAM), with HTTPS, serving your customers.

**Time estimate:** 45–60 minutes, no cloud experience needed.

---

## Step 0 — Get a domain (~$10/year, the only real fixed cost)

Production sales need HTTPS — your voice/SMS webhooks require it and customers won't type a bare IP. Buy a domain at [Namecheap](https://www.namecheap.com) or [Cloudflare Registrar](https://www.cloudflare.com/products/registrar/) (~$10–12/yr).

If you want to test before buying: the installer refuses to fake it (a wrong origin would wire paid Twilio numbers to dead URLs). Testing can run on `http://<IP>:8080` by skipping Caddy, but do not sell from that state.

You'll point the domain at your server in Step 4.

---

## Step 1 — Pick your Oracle home region (PERMANENT, choose carefully)

When you first log into <https://cloud.oracle.com> it asks for a **home region**. It **cannot be changed later**.

- Customers mostly in Canada → `ca-toronto-1` or `ca-montreal-1`
- Customers mostly in US → `us-ashburn-1` or `us-phoenix-1`

Your compute instances can live in any region regardless of home region, but keep it simple: pick the region where your customers are.

## Step 2 — Create the ARM instance (the free 4-core server)

In the Oracle Console:

1. Hamburger menu ☰ → **Compute** → **Instances** → **Create instance**
2. **Name:** `trueaxis`
3. **Image:** click *Edit* → choose **Canonical Ubuntu 24.04** (not Oracle Linux)
4. **Shape:** click *Edit* → **Ampere** (ARM-based, VM.Standard.A1.Flex) → set **4 OCPUs and 24 GB memory** (leave 1 GB boot as is, or raise boot volume to 100 GB — still free up to 200 GB total)
5. **SSH keys:** leave "Generate a key pair" → **Save Private Key** and **Save Public Key** to your computer. This file is your only way in — keep it.
6. Click **Create**.

> **"Out of host capacity" error?** Free ARM capacity is scarce in busy regions. Retry at off-peak hours, or create the instance in a nearby region (instance region ≠ home region is fine). It can take several attempts over a day — this is the single most common Oracle free-tier annoyance.

7. When the instance shows **RUNNING**, copy its **Public IP**.

## Step 3 — Open ports 80/443 in the VCN (Oracle-side firewall)

This is the step everyone misses. Two firewalls exist: Oracle's (this step) and Ubuntu's (installer handles it).

1. ☰ → **Networking** → **Virtual Cloud Networks** → click your VCN → **Security Lists** → **Default Security List**
2. **Add Ingress Rules**, twice:
   - Source `0.0.0.0/0`, Destination TCP **80**
   - Source `0.0.0.0/0`, Destination TCP **443**
3. Leave the existing rule for port 22 (SSH) alone.

## Step 4 — Point your domain at the server

In your registrar's DNS panel, add an **A record**: `@` (and/or `app`) → your instance's Public IP. Set TTL low (5 min) for now. Wait 5–30 minutes for DNS to propagate (check with `dig +short yourdomain.com`).

## Step 5 — SSH in and run ONE command

From your computer (Windows: use PowerShell; Mac/Linux: Terminal):

```bash
ssh -i /path/to/ssh-key.pem ubuntu@<PUBLIC_IP>
```

Accept the fingerprint prompt, then run the installer:

```bash
sudo bash -c 'curl -fsSL https://raw.githubusercontent.com/yvngbutta32/trueaxishq/main/scripts/oracle-setup.sh -o oracle-setup.sh && bash oracle-setup.sh --domain yourdomain.com'
```

It will prompt for one thing: a **GitHub token** (the repo is private). Create one at GitHub → Settings → Developer settings → **Fine-grained tokens** → *Repository access: only `yvngbutta32/trueaxishq`* → permission **Contents: Read-only**. Paste it when asked.

The installer does everything else: Node 22, MariaDB, HTTPS via Caddy, database + migrations, systemd auto-restart, firewall. It's idempotent — safe to re-run if anything fails.

## Step 6 — Verify

```bash
curl -s https://yourdomain.com/api/health     # on the server, or open in your browser
BASE_URL=https://yourdomain.com bash scripts/smoke.sh   # from the repo dir on the server
```

The installer prints a **one-time bootstrap invite code**. Open `https://yourdomain.com/register`, register with that code — that account is the owner (admin). Then log in.

## Step 7 — Add provider credentials as you get them

Edit `/opt/trueaxis/.env` on the server, add whichever you have, then `sudo systemctl restart trueaxis`:

| Variable(s) | Unlocks | Cost when idle |
|---|---|---|
| `SMTP_*` | Real outgoing email | $0 |
| `STRIPE_SECRET_KEY` | Subscriptions + client payments | $0 |
| `TWILIO_ACCOUNT_SID`/`AUTH_TOKEN`/`FROM` | SMS + voice + managed lines | $0 |
| `LLM_BASE_URL`/`LLM_API_KEY`/`LLM_MODEL` | AI receptionist + drafting (Gemini 2.0 Flash key from Google AI Studio) | $0 |
| `SITE_ORIGIN` | Already set by the installer | — |

Order that gets you sellable fastest: **SMTP → Stripe → Gemini → Twilio.** But the app is fully usable (and honest about what's not configured) with none of them.

---

## Gotchas & good citizenship

- **Upgrade to Pay As You Go** (Billing, add a card, click "Upgrade"): Oracle's free tier *reclaims idle* Always Free ARM instances (low CPU for 7 days); PAYG accounts are not subject to reclamation, and staying under the Always Free limits still costs $0. Strongly recommended once you're live.
- **Backups:** the app has a built-in one-click JSON export (Settings → Import/Export) plus `mysqldump trueaxis > backup.sql` for full DB snapshots. A weekly cron on the server is a 3-line addition — ask and it gets added.
- **Server software updates:** `sudo apt update && sudo apt upgrade -y` monthly; the app itself updates with `cd /opt/trueaxis && sudo -u trueaxis git pull && sudo -u trueaxis corepack pnpm install --frozen-lockfile && sudo -u trueaxis corepack pnpm build && sudo systemctl restart trueaxis`.
- **Capacity:** 4 ARM cores / 24 GB RAM comfortably serves hundreds of accounts for this stack.

## What this deployment does NOT cover

- Actual provider signup/credentials (separate, per provider, all free to hold)
- Your domain renewal
- Anything paid: the stack above stays $0 fixed until a client uses a metered feature
