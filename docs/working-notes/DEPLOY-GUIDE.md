# TrueAxis HQ — Deploy + Credentials, Step by Step

Follow in order. Do not skip. Every command is copy-paste.
Replace **yourdomain.com** with the domain you actually buy (everywhere).

---

## WHAT YOU NEED BEFORE YOU START

- [ ] A card (Oracle wants one for identity verification; free tier stays $0)
- [ ] ~45 minutes for the server, ~20 minutes for credentials
- [ ] A domain you own (Step 1)

---

# PHASE 1 — DOMAIN (10 minutes)

1. Go to https://www.namecheap.com or https://dash.cloudflare.com (Registrar).
2. Search a name. Buy the `.com` if you can (~$10-15/year). This is your only fixed cost.
3. After purchase, you land on the domain's management page. Leave it open — you come back in Phase 4.
4. Write down the exact domain, e.g. `trueaxishq.com`.

**Done when:** you own a domain and know its exact spelling.

---

# PHASE 2 — GITHUB TOKEN (3 minutes)

You need this so the server can download your private code.

1. Log in to https://github.com
2. Click your avatar (top right) → **Settings**
3. Left sidebar, scroll to the bottom → **Developer settings**
4. **Personal access tokens** → **Fine-grained tokens**
5. Click **Generate new token**
6. Fill in:
   - **Token name:** `trueaxis-deploy`
   - **Expiration:** 90 days (or custom)
   - **Repository access:** select **Only select repositories** → choose **trueaxishq**
7. Scroll to **Permissions** → **Repository permissions**
8. Find **Contents** → set the dropdown to **Read-only**
9. Click **Generate token**
10. Copy the token that starts with `github_pat_...` and paste it into a note. **You will never see it again.**

**Watch out:** if you leave Repository access on "All repositories", the token still works but is riskier. Use "Only select repositories".

**Done when:** you have a `github_pat_...` string saved.

---

# PHASE 3 — ORACLE SERVER (20-40 minutes, mostly waiting)

## 3.1 Create the account

1. Go to https://cloud.oracle.com and sign up (free).
2. When it asks for a **home region**, this is **permanent**:
   - US customers → `us-ashburn-1` or `us-phoenix-1`
   - Canada → `ca-toronto-1` or `ca-montreal-1`
3. Verify your card. You will not be charged on the free tier.

## 3.2 Create the server

1. Top-left hamburger menu (☰) → **Compute** → **Instances** → **Create instance**
2. **Name:** `trueaxis`
3. **Image and shape** → click **Edit**
   - Image: **Canonical Ubuntu 24.04**
   - Shape: **Ampere** → `VM.Standard.A1.Flex` → **4 OCPUs**, **24 GB memory**
   - Leave boot volume at default (or set 100 GB — still free)
4. **Add SSH keys:** leave **Generate a key pair** selected, then click **Save private key** and **Save public key**.
   - The private key downloads as `ssh-key-2026-...key`. **This is your only way in. Back it up.**
5. Click **Create**
6. Wait until the state says **RUNNING** (1-3 minutes). Then copy the **Public IP address**.

**If you get "Out of host capacity":** this is Oracle's most common annoyance, not your fault. Try again at a quieter hour (late night / early morning), or create the instance in a different region than your home region. It usually takes a few tries.

## 3.3 Open the ports (this is the step everyone forgets)

Oracle has its own firewall on top of Ubuntu's. You must open it here.

1. ☰ → **Networking** → **Virtual Cloud Networks**
2. Click your VCN (usually named `vcn-...`)
3. Click **Security Lists** → **Default Security List for vcn-...**
4. Click **Add Ingress Rules** and add one rule:
   - Source Type: **CIDR**
   - Source CIDR: `0.0.0.0/0`
   - IP Protocol: **TCP**
   - Destination Port Range: `80`
   - Click **Add Ingress Rules**
5. Repeat: same form, port `443`
6. Do **not** touch the existing port 22 rule.

**Done when:** the security list shows three ingress rules: 22, 80, 443.

---

# PHASE 4 — POINT YOUR DOMAIN AT THE SERVER (5 minutes + waiting)

1. Go back to your domain's DNS management page.
2. Add a record:
   - **Type:** `A`
   - **Host / Name:** `@`
   - **Value / Points to:** your Oracle **Public IP**
   - **TTL:** 300 seconds (5 minutes)
3. Optionally add the same A record with Host `www`.
4. Wait 5-30 minutes.

**Check it worked:** open https://dnschecker.org, type your domain, ensure it resolves to your Oracle IP.

Do not continue until DNS resolves. HTTPS setup fails without it.

---

# PHASE 5 — CONNECT TO THE SERVER

## Windows (PowerShell)

1. Press `Win`, type `powershell`, open it.
2. Fix the key's permissions first (Windows refuses otherwise):
   ```powershell
   icacls "$env:USERPROFILE\Downloads\ssh-key-2026-10-30.key" /inheritance:r
   icacls "$env:USERPROFILE\Downloads\ssh-key-2026-10-30.key" /grant:r "$($env:USERNAME):(R)"
   ```
   (Replace the filename with your actual downloaded key name.)
3. Connect:
   ```powershell
   ssh -i "$env:USERPROFILE\Downloads\ssh-key-2026-10-30.key" ubuntu@YOUR_PUBLIC_IP
   ```
   Type `yes` when it asks about the fingerprint.

## Mac / Linux (Terminal)

```bash
chmod 600 ~/Downloads/ssh-key-2026-10-30.key
ssh -i ~/Downloads/ssh-key-2026-10-30.key ubuntu@YOUR_PUBLIC_IP
```
Type `yes` at the fingerprint prompt.

**You are in when** the prompt changes to `ubuntu@trueaxis:~$`.

**Error "Permission denied (publickey)"** = wrong key file or permissions not fixed. Redo step 2.

---

# PHASE 6 — RUN THE INSTALLER (5-8 minutes)

Paste this whole line, replacing the domain with yours:

```bash
sudo bash -c 'curl -fsSL https://raw.githubusercontent.com/yvngbutta32/trueaxishq/main/scripts/oracle-setup.sh -o /opt/oracle-setup.sh && bash /opt/oracle-setup.sh --domain yourdomain.com'
```

When it prints:

```
The repo is private. Create a fine-grained GitHub token ... then paste it here:
```

paste your `github_pat_...` token and press Enter. **The cursor will not move while you paste — that is normal.** Then press Enter.

It installs Node 22, MariaDB, Caddy (automatic HTTPS), the app, the database, all 91 migrations, the auto-restart service, the firewall, and nightly backups.

**When it finishes, copy these three things from the last lines:**

1. The URL: `https://yourdomain.com`
2. **The first owner invite code** — 6 characters (digits and A-F). You need it in Phase 8.
3. Ignore the rest.

If you lose the code:
```bash
sudo grep BOOTSTRAP_INVITE_CODE /opt/trueaxis/.env
```

---

# PHASE 7 — VERIFY THE SERVER (2 minutes)

Run these on the server, one at a time:

```bash
curl -s https://yourdomain.com/api/health
```
Expected: one JSON line containing `"status":"healthy"` (plus a timestamp).

```bash
cd /opt/trueaxis && BASE_URL=https://yourdomain.com bash scripts/smoke.sh
```
Expected: 10 lines of `PASS`, ending `ALL CHECKS PASSED`.

If health fails:
- Wait 2 minutes (Caddy may still be getting its certificate), retry.
- Still failing? Confirm Phase 3.3 ports were added and DNS resolves.

---

# PHASE 8 — CREATE YOUR OWNER ACCOUNT (2 minutes)

1. In a browser open `https://yourdomain.com/register`
2. Enter your name, email, password.
3. When asked for an **invite code**, paste the 6-character code from Phase 6.
4. Register, then log in.

This account is the owner/admin. It sees everything.

---

# PHASE 9 — ADD CREDENTIALS (each one is a copy-paste)

## How to edit the settings file (do this once, learn it)

```bash
sudo nano /opt/trueaxis/.env
```

- Move with arrow keys. **Do not retype lines**, just add new lines at the bottom.
- Save: `Ctrl+O`, then `Enter`. Exit: `Ctrl+X`.
- After every `nano` session, restart the app:
  ```bash
  sudo systemctl restart trueaxis
  ```

## 9.0 Support email (do this one now — takes 1 minute)

Add to the bottom of `.env`:

```
SUPPORT_EMAIL=you@yourdomain.com
```

Save, exit, restart. This shows on your public status page.

---

## 9.1 EMAIL — SMTP (real booking confirmations, invoice emails)

### Fastest zero-cost option: Gmail app password

1. Your Google account must have **2-Step Verification** on: https://myaccount.google.com/security
2. Go to https://myaccount.google.com/apppasswords
3. App name: `TrueAxis` → **Create**
4. Copy the 16-character password (looks like `abcd efgh ijkl mnop`). Remove the spaces when pasting.
5. Add to `.env`:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=youraddress@gmail.com
SMTP_PASS=abcdefghijklmnop
SMTP_FROM=youraddress@gmail.com
```

Notes: Gmail is fine for your first customers but caps around 500 sends/day and can land in spam. When you have paying customers, switch to Brevo/Resend/Postmark with your own domain — same five variable names, different values, nothing else changes.

Save → exit → restart.

---

## 9.2 PAYMENTS — STRIPE (subscriptions + client invoices)

1. Create/log in at https://dashboard.stripe.com
2. Complete **Activate your account** (business details + bank). This is required to accept real money. Test keys work before activation but cannot charge cards.
3. Get the key: **Developers** → **API keys** → reveal **Secret key** → copy the `sk_live_...` (or `sk_test_...` while testing).
4. Add to `.env`:

```
STRIPE_SECRET_KEY=sk_live_xxxxxxxxxxxxxxxx
```

5. Create the webhook (this is what keeps subscriptions in sync):
   - **Developers** → **Webhooks** → **Add endpoint**
   - Endpoint URL: `https://yourdomain.com/api/stripe/webhook`
   - Events to send, select exactly these six:
     - `checkout.session.completed`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.paid`
     - `invoice.payment_failed`
     - `account.updated`
   - Click **Add endpoint**
   - On the endpoint page, click **Reveal** under **Signing secret**, copy `whsec_...`
6. Add to `.env`:

```
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxx
```

Save → exit → restart.

Note: payments from your customers (invoice "Pay now") go to the freelancer's own Stripe account via Stripe Connect onboarding inside the app — your platform key only handles subscriptions.

---

## 9.3 TEXT MESSAGES + PHONE — TWILIO

1. Sign up at https://www.twilio.com (free trial credit).
2. From https://console.twilio.com copy:
   - **Account SID** (starts `AC...`)
   - **Auth Token** (click to reveal)
3. Buy a phone number: **Phone Numbers** → **Buy a number** → filter by your area code → make sure it lists **Voice** and **SMS** capabilities → buy (~$1.15/month).
4. Add to `.env` (number must start with `+` and country code):

```
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_FROM_NUMBER=+15551234567
```

5. Save → exit → restart.

**Honest reality about US texting:** calls work immediately after this. Texts to US numbers require **A2P 10DLC registration** with The Campaign Registry — Twilio walks you through it (**Messaging** → **Regulatory Compliance**). It costs roughly $4-44 one-time plus a few dollars a month, and approval can take a few days. Until it is approved, SMS sends will be filtered. Voice and voicemail are unaffected.

SMS costs money per message beyond your plan allowance: that is charged to you by Twilio, which is why each plan has a cap.

---

## 9.4 AI — GOOGLE GEMINI (AI receptionist + drafting)

1. Go to https://aistudio.google.com/apikey
2. Click **Create API key** (free tier, no card required).
3. Copy the key (starts `AIza...`).
4. Add to `.env` — the URL must be the **full path**, exactly as below:

```
BUILT_IN_FORGE_API_URL=https://generativelanguage.googleapis.com/v1beta/openai/chat/completions
BUILT_IN_FORGE_API_KEY=AIzaSyxxxxxxxxxxxxxxxxxxxx
BUILT_IN_FORGE_API_MODEL=gemini-2.5-flash
```

Save → exit → restart.

Without this, AI features stay off and say so honestly. Nothing breaks.

---

## 9.5 OPTIONAL — Google Calendar sync

Skip this unless you specifically want two-way calendar sync. ICS calendar feeds already work without it.

---

# PHASE 10 — PROVE EVERY CREDENTIAL IS REAL (1 command)

Run on the server:

```bash
cd /opt/trueaxis && sudo bash scripts/verify-credentials.sh
```

This contacts each provider live and prints PASS / SKIP / FAIL per group:
- `PASS` = the credential works
- `SKIP` = you haven't added it yet (fine)
- `FAIL` = you added it but the provider rejected it — fix that line in `.env`

Finish only when every credential you added shows **PASS** and the summary says **All provided credentials are LIVE-VALID**.

---

# PHASE 11 — AFTER LAUNCH (do this week one)

1. **Upgrade Oracle to Pay As You Go.** Billing → add card → **Upgrade to Pay As You Go**. Free ARM servers can be reclaimed by Oracle after 7 idle days; paid accounts are exempt, and staying inside Always Free limits still costs $0.
2. **Check backups exist:**
   ```bash
   ls -la /var/backups/trueaxis
   ```
   Nightly at 03:20, 14 daily + 6 monthly snapshots.
3. **Download a copy of your data weekly:** app → Settings → Import/Export → JSON export.
4. **Monthly server updates:**
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

---

# COMMON ERRORS AND FIXES

| What you see | What it means | Fix |
|---|---|---|
| "Out of host capacity" on Oracle | No free ARM room in that region | Retry off-peak, or pick another region |
| `Permission denied (publickey)` | Wrong key or loose permissions | Redo Phase 5 permission step |
| Site times out, health fails | Ports 80/443 not open in Oracle | Phase 3.3 |
| Caddy certificate error in logs | DNS not pointing at server yet | Wait for DNS, restart: `sudo systemctl restart caddy` |
| Site loads but login fails | Database not migrated | `cd /opt/trueaxis && sudo -u trueaxis corepack pnpm drizzle-kit migrate` |
| Register says invite code invalid | Code already used or mistyped | `sudo grep BOOTSTRAP_INVITE_CODE /opt/trueaxis/.env` |
| Text messages silently not arriving | US 10DLC not approved yet | Finish Twilio A2P registration |
| AI says not configured after adding key | Wrong URL shape | Use the exact full URL from 9.4 |

Logs for anything else:
```bash
sudo journalctl -u trueaxis -f
```

Restart the app after ANY `.env` change:
```bash
sudo systemctl restart trueaxis
```
