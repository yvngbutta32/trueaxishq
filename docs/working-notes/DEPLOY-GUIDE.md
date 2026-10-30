# TrueAxis HQ — Complete Beginner's Deployment Guide

**Read this first.** You are moving your app off Manus and onto your own server.
You do not need to know how to code. You only need to copy, paste, and click.

**Time:** about 90 minutes of work, plus waiting time for DNS.
**Cost:** $0 fixed. Oracle's free server is free forever at this size.
**What you end up with:** your app live at `https://trueaxishq.com`, with your own
admin login, automatic HTTPS, automatic nightly backups, and auto-restart if the
server reboots.

Work through the parts in order. Do not skip ahead. Each part ends with
**"You should see"** — if what's on your screen does not match, stop and fix it
before moving on.

---

# PART 0 — Words you will see, in plain English

You do not need to memorize these. Skim them so nothing later feels alien.

| Word | What it actually means |
|---|---|
| **Server** | A computer in a data center that runs 24/7. You rent one free from Oracle. |
| **Terminal / PowerShell** | The black window where you type commands instead of clicking. |
| **SSH** | The secure way to type commands on a remote server from your own computer. |
| **IP address** | The server's numeric address, like `129.213.45.67`. |
| **Domain** | `trueaxishq.com` — the name people type. |
| **DNS** | The internet's phone book. It decides which IP a domain name points to. |
| **A record** | The specific DNS entry that says "this domain → this IP". |
| **`.env` file** | A plain text file of settings (passwords, API keys) the app reads. |
| **Service** | A program the server keeps running and auto-restarts if it crashes. |
| **HTTPS / SSL** | The padlock. Caddy gets this certificate for you automatically, free. |
| **Migration** | A database update script. There are 91 of them. The installer runs them all. |

**What you need before starting:**

- [ ] A computer (Windows or Mac)
- [ ] A credit or debit card (Oracle verifies identity; you are not charged)
- [ ] Access to the email on your Manus account
- [ ] About 90 minutes without rushing

---

# PART 1 — Get your computer ready (5 minutes)

## 1.1 Open your terminal

**Windows:**
1. Press the **Windows key** on your keyboard.
2. Type `powershell`.
3. Click **Windows PowerShell** in the results.
4. A blue or black window opens. That is your terminal.

**Mac:**
1. Press **Command + Space**.
2. Type `terminal`.
3. Press **Enter**.
4. A white or black window opens. That is your terminal.

## 1.2 Learn how to paste into it

| Where | How to paste |
|---|---|
| Windows PowerShell | **Right-click** anywhere in the window |
| Mac Terminal | **Command + V** |

Copying is normal: select text and `Ctrl+C` (Windows) or `Command+C` (Mac).

## 1.3 Make a folder for your server key

Later you will download a key file. Put it somewhere you will not lose it.

1. Open your **Downloads** folder.
2. Create a new folder called `trueaxis-key`.
3. Remember this path — you will need it. It looks like:
   - Windows: `C:\Users\YourName\Downloads\trueaxis-key`
   - Mac: `/Users/YourName/Downloads/trueaxis-key`

**You should see:** an empty folder waiting for the key file.

---

# PART 2 — Create your Oracle account (10 minutes)

1. In your browser go to: **`cloud.oracle.com`**
2. Click **Sign up** (or **Start for free**).
3. **Country:** choose yours.
4. **Email:** use an email you check often. This becomes your Oracle login.
5. Click **Verify my email**. Oracle sends you a 6-digit code.
6. Open your email, copy the code, paste it, click **Verify**.
7. **Password:** create one and write it down somewhere safe.
8. **Account name:** any short name, e.g. `trueaxis`.
9. **Home region:** this is the data center that will hold your server.
   - United States → **US East (Ashburn)** or **US West (Phoenix)**
   - Canada → **Canada (Toronto)** or **Canada (Montreal)**
   - **This cannot be changed later.** Pick the one closest to your customers.
10. **Home region** confirm, then continue.

## 2.1 Card verification

1. Oracle asks for a **credit or debit card**. A debit card works.
2. Fill in card number, expiry, CVC, and billing address exactly as on the card.
3. Oracle may place a **temporary $1 authorization**. It disappears in a few days.
4. Confirm. Oracle may send another email code; complete it.

> If your card is declined: try a different card, or contact your bank and say
> "I am authorizing an Oracle Cloud signup." Many banks block it as fraud by default.
> Oracle will not charge you for the free tier, but they do require a valid card.

**You should see:** the Oracle Cloud **Console** — a page with a hamburger menu (☰)
in the top-left corner and "Compute" somewhere in the menu.

> **Free tier note:** Oracle gives you a permanently free ARM server with up to
> 4 cores and 24 GB RAM. If it only offers you 1 core and 6 GB, that is normal
> (explained in Part 3). It is still free and still enough to launch.

---

# PART 3 — Create the server (20 minutes)

## 3.0 Create the network FIRST (do this before the instance)

Starting from a brand-new account, build the network with Oracle's wizard. It creates
the public subnet, internet gateway, NAT gateway, route tables and security list in
one pass, with no guessing about CIDR blocks.

**Every value to type is listed. If a field already shows that value, leave it.**

1. **☰ → Networking → Virtual Cloud Networks**
2. Click **Start VCN Wizard**
3. Choose **Create VCN with Internet Connectivity** → click **Start VCN Wizard**
4. Fill in:
   - **VCN Name:** `trueaxis-vcn`
   - **Compartment:** your root compartment (e.g. `trueaxis (root)`)
   - **VCN IPv4 CIDR Block:** `10.0.0.0/16`
   - **Use DNS Hostnames in this VCN:** leave **checked**
   - **Public Subnet IPv4 CIDR Block:** `10.0.0.0/24`
   - **Private Subnet IPv4 CIDR Block:** `10.0.1.0/24`
5. Click **Next**, review the list, click **Create**
6. Wait until everything shows green (about 30 seconds). You get: the VCN, an
   Internet Gateway, a NAT Gateway, a Service Gateway, route tables, and two subnets
   (`public subnet-trueaxis-vcn` and `private subnet-trueaxis-vcn`).

**You should see:** your new `trueaxis-vcn` in the Virtual Cloud Networks list, with
**Public Subnet** marked Public and **Private Subnet** marked Private.

> This is the step that prevents "You must select a public subnet to assign a public
> IPv4 address." A public subnet exists now, so the instance form will offer it.

## 3.0.1 Open ports 80 and 443 now (in the new network)

1. **☰ → Networking → Virtual Cloud Networks** → click **trueaxis-vcn**
2. Left sidebar under **Resources** → **Security Lists**
3. Click **Default Security List for trueaxis-vcn**
4. **Add Ingress Rules** → Source Type CIDR, Source CIDR `0.0.0.0/0`,
   IP Protocol **TCP**, Destination Port Range `80`, Description `web` → **Add Ingress Rules**
5. **Add Ingress Rules** again → same but Destination Port Range `443`, Description `https` → **Add Ingress Rules**

**You should see:** three rules — 22, 80, 443.

## 3.1 Start the create form

1. Click the hamburger menu **☰** (top left).
2. Click **Compute** → **Instances**.
3. Make sure the **Compartment** dropdown shows your root compartment
   (usually your account name, e.g. `trueaxis (root)`).
4. Click the blue **Create instance** button.

## 3.2 Fill in the form exactly

1. **Name:** type `trueaxis`
2. **Create in compartment:** leave as-is.
3. **Placement:** leave as-is unless you want to change Availability Domain
   (see 3.5).

4. Find the box titled **Image and shape**. Click **Edit** on it.
   - **Image:** choose **Canonical Ubuntu** → version **24.04**
     (Do **not** choose Oracle Linux, and do not choose 22.04.)
   - **Shape:** choose **Ampere** → **VM.Standard.A1.Flex**
   - **OCPUs:** drag to **4** if available. **Memory:** **24 GB** if available.
   - If the sliders only allow **1 OCPU** and **6 GB**, leave them there. Take it.
     (Reason in 3.6.)
   - Click **Select shape** / **Save** to close that panel.

5. **Primary VNIC information** (this is the networking part that must be exact):
   - **Select existing virtual cloud network** → choose **`trueaxis-vcn`**
   - **Select existing subnet** → choose **`public subnet-trueaxis-vcn`**
     (its **Access** column must say **Public**)
   - **Assign a public IPv4 address:** **Yes**
   - Leave the private IP as assigned and leave IPv6 alone.

6. **Add SSH keys** section:
   - Leave **Generate a key pair** selected.
   - Click **Save private key**. Your browser downloads a file like
     `ssh-key-2026-10-30.key`. Move it into the `trueaxis-key` folder you made in
     Part 1.3.
   - Click **Save public key** and save it in the same folder.
   - **This private key is the only way into your server. If you lose it you must
     build a new server.** Back it up to cloud storage or email it to yourself.

7. **Boot volume:** leave default. (Optionally raise to 100 GB — still free.)

8. **Security / Shielded instance:** leave **unchecked**. It is optional boot-integrity
   hardening this stack does not need, and leaving it off keeps console recovery
   simple. Your disk is still encrypted at rest by Oracle by default.

9. Leave **Show advanced options** closed.

10. Click the blue **Create** button at the bottom.

**You should see:** a banner saying the instance is **PROVISIONING**, then within
1–3 minutes a green **RUNNING** status with an orange circle icon.

## 3.2.1 If you see "You must select a public subnet to assign a public IPv4 address"

This is Oracle refusing to hand out a public IP because the **subnet** you picked is
private. A subnet is just a slice of the network; only a *public* subnet has a door
to the internet. Nothing is broken, and you do not need to start over.

**Fix A — pick the public subnet (this is almost always it):**

1. On the Create instance page, scroll to **Primary VNIC information**
   (sometimes labelled **Networking**).
2. Make sure **Select existing virtual cloud network** is chosen, and pick your VCN.
3. Open the **Subnet** dropdown. Read the list:
   - Choose the entry whose name contains **public** (e.g. `public subnet-vcn-...`).
   - Its **Access** column must say **Public**. Ignore anything labelled Private.
4. Just below, in **Primary VNIC IP addresses**, set
   **Assign a public IPv4 address** = **Yes**.
5. Click **Create** again.

**Fix B — no public subnet in the dropdown at all:**

Your VCN was built with private subnets only. Create a proper one (takes 2 minutes
and does not disturb anything else):

1. **☰ → Networking → Virtual Cloud Networks**.
2. Click **Start VCN Wizard** (or **Create VCN** → **Start VCN Wizard**).
3. Choose **Create VCN with Internet Connectivity** → **Start VCN Wizard**.
4. **VCN name:** `trueaxis-vcn`. Leave all CIDR blocks as suggested.
5. Click **Next** → **Create**. Wait for it to finish.
6. Go back to **☰ → Compute → Instances → Create instance**, and in
   **Primary VNIC information** select this new VCN and its **public subnet**.

That wizard creates the public subnet, the private subnet, the internet gateway and
the route table in one pass, which is exactly what the free tier expects.

**Fix C — you already created the instance without a public IP:**

1. **Compute → Instances → trueaxis** → **Attached VNICs** → click the VNIC.
2. **IP administration** (left sidebar) → **IPv4 addresses**.
3. On the row, **⋯** → **Edit** → set **Public IP** = **Ephemeral public IP**, save.
4. Copy the public IP from that page and use it from Part 5 onward.

**How to confirm it worked:** the instance page shows a **Public IP address** field
with a real number (e.g. `129.213.45.67`). If that field is empty, stop and fix the
subnet before continuing — nothing after this point works without it.

## 3.3 Copy the IP address

1. On the instance page, find **Public IP address** in the Instance information panel.
2. Click **Copy** next to it.
3. Paste it into a notes app. It looks like `129.213.45.67`.

You will paste this number in three different places later. Keep it handy.

## 3.4 If creation fails

| Message | What it means | Do this |
|---|---|---|
| **Out of host capacity** | That data center has no free ARM cores right now | Try again in a few hours, or read 3.5 |
| **Limit exceeded** | Your account is capped | Open a support chat and ask them to raise the A1 limit for your tenancy |
| Page just spins | Normal slowness | Wait 2 minutes, refresh |

## 3.5 Trying for the bigger server (optional)

Capacity is per **Availability Domain** (AD-1, AD-2, AD-3), which are separate
buildings. One may be full while another has room.

1. On the **Create instance** form, open **Show advanced options**.
2. Find **Availability domain** and change it to a different one (AD-2 or AD-3).
3. Click **Create** again.

If all domains refuse, take the 1 OCPU / 6 GB and move on. You can upgrade the
same server later without reinstalling anything (see Part 13.1).

## 3.5.1 "Out of capacity for shape VM.Standard.A1.Flex in AD-1" — exact playbook

This is Oracle telling you that specific building has no free ARM cores. Your account
is fine and your network is fine. Work through these in order; stop as soon as one works.

1. **Switch Availability Domain (do this first — keeps your VCN).**
   On the Create instance form: open **Show advanced options** →
   **Availability domain** → pick **AD-2** → **Create**. If AD-2 fails, try **AD-3**.
   Capacity is per building, so one is usually open while another is not.

2. **Do not pin a fault domain.** If you set a fault domain anywhere, clear it and let
   Oracle choose. A pinned fault domain shrinks the search to a single rack.

3. **Keep 1 OCPU / 6 GB.** Small requests get filled far more often than 4/24.

4. **Retry in waves.** Capacity frees up constantly. Click Create again every few
   minutes; most people get in within an hour or two, sometimes in 30 seconds.

5. **Upgrade the tenancy to Pay As You Go.** Billing & Cost Management →
   **Upgrade to Pay As You Go**. Free limits still apply and cost stays $0, but paid
   tenancies are widely reported to get better ARM capacity availability, and you are
   exempt from idle reclamation afterwards. This is the most reliable fix when every
   AD refuses for a long stretch.

6. **Different region (last resort).** Instance region does not have to match your
   home region. Switch region at the top right of the console, then you must create a
   new VCN there too (Part 3.0) before creating the instance.

**Do not** switch to the AMD micro shape to escape this. It has 1 GB of RAM and
cannot build this app reliably.

## 3.6 Why 1 core / 6 GB is genuinely fine

This app is a small Node.js web server plus a small database. It does not need
4 cores to serve your first customers. The trade-offs are:

- The install takes **10–15 minutes** instead of 5–8.
- The installer automatically adds a **2 GB swap file** so the build cannot run
  out of memory.

Nothing else changes. Same features, same speed for a handful of users.

---

# PART 4 — Open the two doors (5 minutes)

Oracle ships with a firewall that blocks web traffic by default. There are two
firewalls: Oracle's (this part) and Ubuntu's inside the server (the installer
handles that one). Everyone forgets this part, and then wonders why the site
will not load.

1. Click **☰** (top left).
2. Click **Networking** → **Virtual Cloud Networks**.
3. Click your network name. It looks like `vcn-20261030-1234`.
4. In the left sidebar under **Resources**, click **Security Lists**.
5. Click the one named **Default Security List for vcn-...**
6. Click the **Add Ingress Rules** button.

### Rule 1 (web traffic)

- **Stateless:** leave unchecked
- **Source Type:** CIDR
- **Source CIDR:** `0.0.0.0/0`
- **IP Protocol:** TCP
- **Source Port Range:** leave blank
- **Destination Port Range:** `80`
- **Description:** `web`
- Click **Add Ingress Rules**

### Rule 2 (secure web traffic)

Click **Add Ingress Rules** again and repeat with one change:

- **Destination Port Range:** `443`
- **Description:** `https`
- Click **Add Ingress Rules**

**You should see:** three rules in the list — port 22 (SSH, pre-existing), port 80,
port 443.

---

# PART 5 — Point your domain at your server (10 minutes + waiting)

> **Read this once, it prevents a whole wrong turn:** Oracle has **no domain
> settings at all**. Your domain stays registered and managed at Manus. "Using the
> domain on the new server" means exactly one thing: add a DNS record at Manus that
> points the name at your Oracle server's **public IP**. That is why the instance
> comes **first** (Part 3) — until it exists, there is no IP to point at.

Your domain `trueaxishq.com` was bought inside **Manus**, so its DNS lives inside
Manus, not at a normal registrar.

## 5.1 Important things to know first

1. **Your Manus site will stop working at that domain.** The domain can only point
   at one place. That is what migration means. If you still need the Manus site,
   ask Manus to put it on a subdomain first (e.g. `old.trueaxishq.com`).
2. **HTTPS cannot be issued until DNS is correct.** Let's Encrypt must reach your
   new server through this DNS record to prove you own the domain. So do this part
   fully and let it settle before Part 7.

## 5.2 Open the Manus DNS panel

1. Go to **`manus.im`** and log in.
2. Click your **avatar / profile picture** (usually bottom-left or top-right).
3. Click **Settings**.
4. Click the **Data controls** tab.
5. Find your domain `trueaxishq.com` and click **Manage**.
6. On the domain row, click **Manage** again to open its DNS records.

**You should see:** a list of DNS records. There will be something pointing at
Manus (an **A** record with name `@`, or a **CNAME**).

## 5.3 Remove the old record

1. Find the **A** record where the **Name/Host** is `@` (sometimes shown as blank,
   or as the bare domain).
2. Click the **⋯** (three dots) beside it, or **Delete**.
3. Confirm deletion.

If instead you see a **CNAME** on `@`, delete that one.

> Manus's own documentation says an existing A record must be removed before the
> new one is added, so do not try to "edit in place" if the panel resists.

## 5.3.1 If Manus will not let you delete the record

You will see this on domains that are still **attached to a Manus-deployed app**: the
zone is served from Manus's own Cloudflare, so the records are greyed out and there is
no delete option. The lock is the app binding, not a permissions mistake.

**Fix A — unbind the domain first (do this).** Either:
- In Manus chat, say: *"Disconnect trueaxishq.com from my deployed app so I can manage
  its DNS records."* Manus is agent-driven; a plain-English request is the real interface.
- Or open the project in Manus → **Publish / Deploy** → the custom-domain section →
  **Disconnect** / **Remove domain**.

Once the domain is no longer served by a Manus app, its records become editable and
5.3 through 5.5 work normally.

**Fix B — have Manus make the change for you.** Paste this to Manus support/chat:
*"On trueaxishq.com, delete the A record for @ and the A record for www, then add
A @ → 170.9.227.176 and A www → 170.9.227.176 with TTL 300. I am migrating to my own
server and need these records pointed there."*

**Fix C — launch today without touching Manus DNS.** Point the installer at a hostname
that already resolves to your IP (`sslip.io` does this automatically for any IP):

```bash
sudo bash -c 'curl -fsSL https://raw.githubusercontent.com/yvngbutta32/trueaxishq/main/scripts/oracle-setup.sh -o /opt/oracle-setup.sh && bash /opt/oracle-setup.sh --domain 170-9-227-176.sslip.io'
```

Real HTTPS, real app, no DNS control needed. When the Manus records finally point at
your server, re-run the installer with `--domain trueaxishq.com` **and** change
`SITE_ORIGIN` in `/opt/trueaxis/.env` to `https://trueaxishq.com`, then restart.
The installer only writes `SITE_ORIGIN` on a first install, so that one line is manual.

## 5.4 Add the new record for the main domain

1. Click **Add record**.
2. Fill in exactly:
   - **Type:** `A`
   - **Name / Host:** `@`
   - **Value / Points to:** your Oracle **Public IP** (from Part 3.3)
   - **TTL:** `300`
3. Click **Confirm** / **Save**.

## 5.5 Add the record for www

1. Click **Add record** again.
2. Fill in exactly:
   - **Type:** `A`
   - **Name / Host:** `www`
   - **Value / Points to:** the **same** Oracle IP
   - **TTL:** `300`
3. Click **Confirm** / **Save**.

Why `www` matters: your server is configured to redirect `www.trueaxishq.com` to
`trueaxishq.com`, and it needs its own certificate to do that. No `www` record =
the redirect cannot be issued.

## 5.6 Wait, then verify (this is the step people rush)

1. Wait **15 minutes**. Up to 30 is normal, rarely an hour.
2. Open a new browser tab → **`dnschecker.org`**.
3. Type `trueaxishq.com` and press Enter.
4. Look at the IP addresses shown. They must be **your Oracle IP**.
5. Also check `www.trueaxishq.com` — same IP.

**On Windows**, you can double-check in PowerShell:

```
nslookup trueaxishq.com
```

The **Address** line (not "Server") must show your Oracle IP.

**Do not continue until this is correct.** If it still shows an old Cloudflare or
Manus address, wait longer, or re-check that you saved the record.

## 5.7 If Manus will not let you edit the record

Two fallbacks, in order:

**A. Ask Manus support in-app** to set an **A** record for `@` and for `www`
pointing at your Oracle IP. Paste the IP for them. This is usually fastest.

**B. Transfer the domain out** to a normal registrar you control:
1. Manus → **Settings → Data controls → Manage** → your domain.
2. Click the **⋯** menu → **Transfer out**.
3. Click **Copy** to copy the authorization code (also called EPP/auth code).
4. Go to a registrar (Namecheap, Cloudflare Registrar, Porkbun) and choose
   **Transfer a domain**. Paste the code. Expect ~$10/year and 5–7 days.
5. Caveat: newly registered domains are usually locked for **60 days** before they
   can transfer. Keep the existing nameservers during the transfer so nothing drops.

---

## 5.8 If your DNS is at Cloudflare instead of Manus

Cloudflare only controls your domain once the **nameservers** at the registrar point
to Cloudflare. Adding a site in Cloudflare is not enough — this is the step everyone
misses, and while it is pending, Cloudflare's DNS panel does nothing at all.

**5.8.1 Check the zone status.** In Cloudflare → your domain, the Overview page shows
either **Active** or **Pending Nameserver Update**.

**5.8.2 If it says Pending Nameserver Update:**

1. On that Overview page, copy the two nameservers Cloudflare assigned you, e.g.
   `ada.ns.cloudflare.com` and `bob.ns.cloudflare.com`.
2. Log in to the **registrar** that currently holds the domain (whatever dashboard you
   got after transferring). Confirm you own the domain: check that
   `nslookup -type=ns trueaxishq.com` shows the Cloudflare pair, not
   `ns1.globaldomaingroup.com`.
3. In that registrar, open the domain → **Nameservers** (or "DNS servers") → choose
   **Custom nameservers** → replace the existing entries with Cloudflare's two →
   save. Delete any leftover nameservers so only Cloudflare's remain.
4. Wait. Usually minutes, sometimes a few hours. Cloudflare emails you when the zone is
   **Active**.

**5.8.3 Once Active, set the records.** Cloudflare → **DNS → Records**:

- Delete any **A** record for `@` (or root) pointing at `104.18.26.246` — that is the
  old Manus edge. Delete any CNAME on `@` too.
- **Add record:** Type `A`, Name `@`, IPv4 address `YOUR_ORACLE_IP`,
  **Proxy status: DNS only (grey cloud)**, TTL `Auto`.
- **Add record:** Type `A`, Name `www`, same IPv4, **Proxy status: DNS only**, TTL `Auto`.

**The grey cloud matters.** With the orange cloud (proxied), Cloudflare terminates TLS
and Caddy cannot pass the Let's Encrypt challenge, so HTTPS fails. DNS only for now.
You can enable proxying later using a Cloudflare Origin Certificate, if you want their
CDN — that is an optional upgrade, not part of launch.

**5.8.4 Verify.** `nslookup trueaxishq.com` must return your Oracle IP. Only then run
the installer, or Caddy cannot get a certificate.

## 5.9 If the registrar is a Manus partner you have no login for

Check who actually holds the registration (RDAP is the authoritative source, not the
dashboard):

```bash
curl -s https://rdap.verisign.com/com/v1/domain/trueaxishq.com | grep -A2 registrar
```

If it answers **Global Domain Group LLC**, that is the wholesale registrar Manus used
to buy the domain for you. You never had an account there, and you do not need one —
but it is why the Manus DNS panel is read-only and why Cloudflare cannot take over yet.
Cloudflare only manages DNS once the **nameservers** at that registrar point at
Cloudflare.

Two ways forward, both requiring Manus (the account holder at that registrar):

1. **Ask Manus to change the nameservers** to the two Cloudflare gave you.
2. **Ask Manus to unlock the domain and send the authorization (EPP) code**, then
   transfer the registration to Cloudflare (5–7 days, ~$10 renewal).

Send this to Manus chat:

> Two requests for trueaxishq.com, which you registered through Global Domain Group LLC:
> (1) change its nameservers to the two Cloudflare nameservers assigned to my zone:
> NS1 and NS2, or (2) unlock the domain and send me the authorization (EPP) code so I
> can transfer the registration to Cloudflare. I am migrating off Manus to my own
> server at 170.9.227.176 and need DNS control.

While that is pending, launch on the sslip.io hostname (5.3.1 Fix C) so the server is
built, tested and sellable. Switch to the domain later; it is a DNS record plus one
`.env` line, not a rebuild.

# PART 6 — Connect to your server (5 minutes)

## 6.1 Windows

Open **PowerShell** (Part 1.1). Run these three commands one at a time, pressing
**Enter** after each. Replace `YourName` with your Windows username, and the key
filename with the one you actually downloaded.

**Command 1 — lock the key file down (SSH refuses keys anyone can read):**

```powershell
icacls "$env:USERPROFILE\Downloads\trueaxis-key\ssh-key-2026-10-30.key" /inheritance:r
```

**Command 2 — give yourself read access:**

```powershell
icacls "$env:USERPROFILE\Downloads\trueaxis-key\ssh-key-2026-10-30.key" /grant:r "$($env:USERNAME):(R)"
```

**Command 3 — connect (replace the IP):**

```powershell
ssh -i "$env:USERPROFILE\Downloads\trueaxis-key\ssh-key-2026-10-30.key" ubuntu@YOUR_ORACLE_IP
```

## 6.2 Mac

Open **Terminal** (Part 1.1). Run these two commands:

```bash
chmod 600 ~/Downloads/trueaxis-key/ssh-key-2026-10-30.key
ssh -i ~/Downloads/trueaxis-key/ssh-key-2026-10-30.key ubuntu@YOUR_ORACLE_IP
```

## 6.3 The first-connection prompt

The first time, you will see:

```
The authenticity of host '129.213.45.67' can't be established.
ED25519 key fingerprint is SHA256:....
Are you sure you want to continue connecting (yes/no/[fingerprint])?
```

Type `yes` and press Enter. This happens once per server, and it is normal.

**You should see** a prompt like:

```
ubuntu@trueaxis:~$
```

That means you are inside your server. Everything you type now runs on the server,
not on your computer.

> **Typing a password will never work here.** Oracle uses the key file instead.
> If it asks for a password, the key path is wrong.

## 6.4 If it fails

| Message | Cause | Fix |
|---|---|---|
| `Permission denied (publickey)` | Key file permissions, or wrong file | Redo 6.1 commands 1 and 2, confirm the filename |
| `No such file or directory` | Wrong path | Open the folder, right-click the key → **Copy as path**, paste that |
| `Connection timed out` | Port 22 blocked or wrong IP | Confirm the IP, confirm the instance is **RUNNING** |
| `Host key verification failed` | Old entry for that IP | Run `ssh-keygen -R YOUR_ORACLE_IP` then retry |

---

# PART 7 — Install everything (one command, 10–15 minutes)

Stay in the same terminal window. You should still see `ubuntu@trueaxis:~$`.

## 7.1 Run the installer

Copy this **entire line** and paste it, then press Enter:

```bash
sudo bash -c 'curl -fsSL https://raw.githubusercontent.com/yvngbutta32/trueaxishq/main/scripts/oracle-setup.sh -o /opt/oracle-setup.sh && bash /opt/oracle-setup.sh --domain trueaxishq.com'
```

**It asks you nothing.** There is no token, no username, no password prompt.
(Later, if the repo were ever made private, it would ask for a GitHub token. Not now.)

## 7.2 What it does, in order

You will see scrolling text. It is installing, in this order:

1. A 2 GB swap file (build headroom on small servers)
2. Ubuntu packages, Node.js 22, git, MariaDB, Caddy
3. Database and a locked-down database user with a generated password
4. The app code into `/opt/trueaxis`
5. A settings file (`/opt/trueaxis/.env`) with a random login secret and a
   one-time owner invite code
6. All 91 database migrations
7. A systemd service so the app restarts automatically
8. Caddy with automatic HTTPS
9. Firewall rules inside Ubuntu
10. Nightly backups at 03:20

## 7.3 How long

- 4 cores: 5–8 minutes
- 1 core: 10–15 minutes

Do not close the window. If your connection drops mid-install, reconnect with the
Part 6 command and run the same installer line again — it is safe and idempotent;
it picks up where it left off without duplicating anything.

## 7.4 The finish message

**You should see** something like:

```
════════════════════════════════════════════════════════
 ✔ Installed. Your app should be live at: https://trueaxishq.com
════════════════════════════════════════════════════════

 First owner invite code (one-time, register at /register): 4A9C21
 Health check:  curl -s https://trueaxishq.com/api/health
 Smoke test:     BASE_URL=https://trueaxishq.com bash scripts/smoke.sh
 Logs:           journalctl -u trueaxis -f
 Backups:        nightly 03:20 -> /var/backups/trueaxis (cron installed)
```

**Write down the 6-character invite code.** That code creates your admin account,
and it works only once.

If you lose it, retrieve it at any time:

```bash
sudo grep BOOTSTRAP_INVITE_CODE /opt/trueaxis/.env
```

---

# PART 8 — Prove it works (3 minutes)

Still in the same terminal window.

## 8.1 Health check

```bash
curl -s https://trueaxishq.com/api/health
```

**You should see** one line like:

```json
{"status":"healthy","supportEmail":null,"timestamp":"2026-10-30T12:16:30.000Z"}
```

The important part is `"status":"healthy"`.

**If you get an error or nothing:**

- Wait 2 minutes and try again. Caddy may still be getting the certificate.
- Then check DNS again (Part 5.6). This is the #1 cause.
- Then re-check Oracle ports 80/443 (Part 4).

## 8.2 Full smoke test

```bash
cd /opt/trueaxis && BASE_URL=https://trueaxishq.com bash scripts/smoke.sh
```

**You should see** ten lines starting with `PASS`, ending with:

```
ALL CHECKS PASSED — deployment is live and behaving.
```

Ten green passes means: the app responds, fonts load, your public pages render,
and your private API correctly refuses anonymous access.

## 8.3 Certificate check (optional but reassuring)

Open `https://trueaxishq.com` in your browser. You should see a **padlock** and
your app's home page.

If you see "Not secure" or a warning page: the certificate is not issued yet.
Wait 5 minutes and refresh. If it persists, run:

```bash
sudo systemctl status caddy --no-pager
sudo journalctl -u caddy -n 40 --no-pager
```

Look for "certificate obtained successfully". If you see errors mentioning
DNS or challenge failures, your DNS still is not pointing at this server.

---

# PART 9 — Create your owner account (3 minutes)

1. Open **`https://trueaxishq.com/register`**
2. **Full name:** your name.
3. **Email:** the email you want to log in with.
4. **Password:** at least 10 characters, mix letters/numbers/symbols.
5. **Invite code:** the 6-character code from Part 7.4.
6. Click **Create account**.
7. Log in with the same email and password.

**You should see** your dashboard: Overview, Clients, Scheduling, Jobs, Dispatch,
Billing, Integrations, AI, Insights, and the rest of the sidebar.

**This account is the owner/admin.** It sees everything and can do everything.
Create staff accounts later from inside the app.

---

# PART 10 — How to edit the settings file (learn this once)

Every credential you add later goes into one file: `/opt/trueaxis/.env`.
Here is the entire skill, and it never changes.

## 10.1 Open it

```bash
sudo nano /opt/trueaxis/.env
```

You now see a text file. The bottom of the screen shows keyboard hints like
`^O Write Out` — the `^` means the **Ctrl** key.

## 10.2 Move and type

- Move the cursor with **arrow keys**.
- Type normally. **Do not delete existing lines.**
- Add new lines at the very bottom.

## 10.3 Save and exit (memorize these two)

1. Press **Ctrl + O** (that is the letter O, for "write Out")
2. Press **Enter** (confirms the filename)
3. Press **Ctrl + X** (exits)

## 10.4 Restart the app so it reads the new settings

```bash
sudo systemctl restart trueaxis
```

**Do this after every single edit.** Without a restart, nothing you typed is used.

## 10.5 Confirm it restarted cleanly

```bash
sudo systemctl status trueaxis --no-pager
```

Look for `Active: active (running)` in green. If it says `failed`, you have a typo
in `.env` — reopen it and check, then restart again.

---

# PART 11 — Add your credentials (choose what you want now)

Everything here is **optional**. The app runs and sells without any of it, and it
tells you honestly in the UI which features are off.

Order that gets you sellable fastest: **support email → email → payments → AI → texts.**

After each one: save (Ctrl+O, Enter, Ctrl+X) → restart (`sudo systemctl restart trueaxis`).

## 11.1 Support email (1 minute, do this now)

This address appears on your public status page so customers can reach you.

```
SUPPORT_EMAIL=you@trueaxishq.com
```

## 11.2 Email — so confirmations and invoices actually send (5 minutes)

### Option A: Gmail app password (fastest, free)

Requirements: your Google account must have **2-Step Verification** turned on.

1. Go to **`myaccount.google.com/security`** and confirm 2-Step Verification is ON.
2. Go to **`myaccount.google.com/apppasswords`**
3. **App name:** type `TrueAxis`
4. Click **Create**
5. Google shows a 16-character password like `abcd efgh ijkl mnop`.
   **Remove the spaces** → `abcdefghijklmnop`
6. Add these five lines to `.env`:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=youraddress@gmail.com
SMTP_PASS=abcdefghijklmnop
SMTP_FROM=youraddress@gmail.com
```

Trade-offs you should know: Gmail caps around 500 sends per day, and receipts sent
from a Gmail address are more likely to land in spam. Fine for your first customers.
When you have paying clients, move to a provider that sends from your own domain
(Brevo, Resend, Postmark) — same five variable names, different values, nothing else
changes.

### Option B: a provider on your own domain (better deliverability)

1. Sign up at Brevo, Resend, or Postmark (free tiers exist).
2. Add and verify `trueaxishq.com`.
3. Copy the **SMTP host, port, username, password** they give you into the same five
   lines above. `SMTP_FROM` becomes something like `billing@trueaxishq.com`.

## 11.3 Payments — Stripe (15 minutes)

1. Go to **`dashboard.stripe.com`** and create an account (or log in).
2. Complete **Activate your account**: legal business name, address, bank account,
   tax ID if you have one. Stripe cannot pay you until this is done.
   - You can develop with test keys before activation, but you cannot take real money.
3. Get your key: **Developers** (top right) → **API keys**.
4. Under **Standard keys**, click **Reveal** on **Secret key**, copy the whole
   `sk_live_...` value.
5. Add to `.env`:

```
STRIPE_SECRET_KEY=sk_live_xxxxxxxxxxxxxxxxxxxx
```

6. Create the webhook — **this is the part people skip, and then subscriptions never
   update**:
   - **Developers** → **Webhooks** → **Add endpoint**
   - **Endpoint URL:** `https://trueaxishq.com/api/stripe/webhook`
   - Click **+ Select events** and tick exactly these six:
     - `checkout.session.completed`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.paid`
     - `invoice.payment_failed`
     - `account.updated`
   - Click **Add events**, then **Add endpoint**
7. On the new endpoint's page, under **Signing secret**, click **Reveal**, copy the
   `whsec_...` value.
8. Add to `.env`:

```
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxx
```

**How money flows:** your platform key only charges subscriptions to *you*. When a
freelancer's client pays an invoice, that money goes into the *freelancer's own*
Stripe account through Stripe Connect onboarding inside the app. You never hold
their money, which keeps you out of money-transmitter territory.

## 11.4 Texts and phone calls — Twilio (15 minutes)

1. Sign up at **`twilio.com`** (free trial credit included).
2. Open **`console.twilio.com`**. On the homepage, in the **Account Info** panel,
   copy:
   - **Account SID** — starts with `AC`
   - **Auth Token** — click **show** to reveal it
3. Buy a phone number: left menu **Phone Numbers → Manage → Buy a number**.
   - Filter by your area code.
   - Tick both **Voice** and **SMS** capabilities.
   - Buy it (~$1.15/month, billed by Twilio to you).
4. Add to `.env` (the number must include `+` and country code):

```
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_FROM_NUMBER=+15551234567
```

**The honest part about US texting:** calls and voicemail work immediately after
this. Texts to US numbers require **A2P 10DLC registration** with The Campaign
Registry, which Twilio guides you through at **Messaging → Regulatory Compliance**.
It costs roughly $4–44 one-time plus a few dollars monthly, and approval takes a few
days. Until approved, carriers filter your SMS. Voice is unaffected.

Also note: each text you send costs a fraction of a cent, billed to *you* by Twilio.
That is exactly why each plan includes a capped allowance.

## 11.5 AI receptionist and drafting — Google Gemini (5 minutes)

1. Go to **`aistudio.google.com/apikey`**
2. Click **Create API key** (free tier, no card required).
3. Copy the key — it starts with `AIza`.
4. Add these three lines **exactly**, including the full URL:

```
BUILT_IN_FORGE_API_URL=https://generativelanguage.googleapis.com/v1beta/openai/chat/completions
BUILT_IN_FORGE_API_KEY=AIzaSyxxxxxxxxxxxxxxxxxxxxxxx
BUILT_IN_FORGE_API_MODEL=gemini-2.5-flash
```

The URL must be that entire path. Google's OpenAI-compatible endpoint is not under
`/v1`, so a short URL will fail. This was a real bug we fixed; the line above is
the corrected form.

## 11.6 Google Calendar sync (optional — skip unless you want it)

Only needed for two-way calendar sync. Calendar feeds (ICS) already work without it.
If you want it later, create an OAuth client at `console.cloud.google.com`, then add
`GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

---

# PART 12 — Prove every credential is real (1 command, 1 minute)

Do not trust that a key is valid because you pasted it. Test it against the live
provider:

```bash
cd /opt/trueaxis && sudo bash scripts/verify-credentials.sh
```

It reads your `.env`, contacts each provider for real, and prints a line per group:

- **PASS** — the credential works
- **SKIP** — not configured yet (perfectly fine)
- **FAIL** — you added it and the provider rejected it; fix that line

**You should see**, for the ones you configured:

```
  PASS  Database reachable (tables:91)
  PASS  SMTP smtp.gmail.com:587 accepted credentials — booking confirmations, invoices, password resets, magic links go live
  PASS  Stripe LIVE key valid (account ...) — SaaS subscriptions + client Connect payments go live
  PASS  LLM endpoint accepted the key — AI voice receptionist + assistant features go live
  4 passed, 0 failed, 2 not yet provided
  All provided credentials are LIVE-VALID. Remaining items just need credentials.
```

Finish only when every credential you added says **PASS**.

---

# PART 13 — First week after launch

## 13.1 Upgrade Oracle to Pay As You Go (do this within days)

**Why:** Oracle reclaims *idle* Always Free ARM servers after about 7 days of low
CPU. Paid accounts are exempt. Staying inside Always Free limits still costs $0.

1. Oracle console → **Billing & Cost Management**
2. Click **Upgrade to Pay As You Go**
3. Add your card, confirm

## 13.2 Grow the server to 4 cores / 24 GB (any time)

1. **Compute → Instances → trueaxis → Edit** (button at top of the page)
2. **Shape config** → set **4 OCPUs**, **24 GB**
3. Save. The app restarts automatically; nothing else changes.

## 13.3 Confirm backups exist

```bash
ls -la /var/backups/trueaxis
```

You should see `trueaxis-2026-10-31.sql.gz` style files appearing nightly at 03:20.
Retention: 14 daily plus the 1st of each month for 6 months.

Restore a backup if you ever need to:

```bash
gunzip < /var/backups/trueaxis/trueaxis-2026-10-31.sql.gz | mysql trueaxis
sudo systemctl restart trueaxis
```

## 13.4 Also keep a business-data export

Once a week: in the app, **Settings → Import/Export → Export JSON**. Download it.
That file is readable outside MySQL, which is what you want in a disaster.

## 13.5 Routine maintenance (monthly, 2 minutes)

Server updates:

```bash
sudo apt update && sudo apt upgrade -y
```

App updates (when we ship changes):

```bash
cd /opt/trueaxis
sudo -u trueaxis git pull
sudo -u trueaxis corepack pnpm install --frozen-lockfile
sudo -u trueaxis corepack pnpm build
sudo systemctl restart trueaxis
```

## 13.6 Everyday commands you will actually use

| What you want | Command |
|---|---|
| Is the app running? | `sudo systemctl status trueaxis --no-pager` |
| Restart after editing `.env` | `sudo systemctl restart trueaxis` |
| Watch live logs | `sudo journalctl -u trueaxis -f` (Ctrl+C to stop) |
| Last 50 log lines | `sudo journalctl -u trueaxis -n 50 --no-pager` |
| Is HTTPS working? | `sudo systemctl status caddy --no-pager` |
| Edit settings | `sudo nano /opt/trueaxis/.env` |
| See the invite code | `sudo grep BOOTSTRAP_INVITE_CODE /opt/trueaxis/.env` |

---

# PART 14 — Troubleshooting, by what you see

| What you see | What it really means | Fix |
|---|---|---|
| Site never loads, browser spins | Oracle ports closed | Part 4 — add 80 and 443 ingress rules |
| Health check says connection refused | App not running | `sudo systemctl status trueaxis` then `sudo systemctl restart trueaxis` |
| Site loads but says "Not secure" | Certificate not issued | Confirm DNS (Part 5.6), then `sudo systemctl restart caddy` |
| Caddy log says "challenge failed" | DNS still points elsewhere | Wait for DNS, verify at dnschecker.org, restart caddy |
| `Permission denied (publickey)` | Key permissions or wrong key | Redo Part 6.1 commands 1–2 |
| Installer stops halfway | Dropped connection or transient apt error | Reconnect, run the same installer line again — it is safe to re-run |
| Register says invite code invalid | Already used, or typo | `sudo grep BOOTSTRAP_INVITE_CODE /opt/trueaxis/.env`; the code is one-time |
| Emails never arrive | SMTP wrong, or Gmail app password spaces | Re-paste the 16-char password with no spaces; check spam |
| Texts never arrive | A2P 10DLC not approved | Finish Twilio regulatory registration |
| AI features say not configured | Wrong URL shape, or app not restarted | Use the exact 3 lines in 11.5, then restart |
| Subscription status never updates | Missing webhook | Part 11.3 step 6, all six events |
| Blank white page after an update | Browser cached old bundle | Hard refresh: Ctrl+Shift+R / Cmd+Shift+R |
| `502 Bad Gateway` | App crashed | `sudo journalctl -u trueaxis -n 80 --no-pager` and read the last error |

---

# PART 15 — Master checklist

**Server**
- [ ] Oracle account created, card verified
- [ ] Instance `trueaxis` created, status **RUNNING**
- [ ] Private key saved and backed up
- [ ] Public IP written down
- [ ] Security list has 80 and 443

**Domain**
- [ ] Old A record deleted in Manus
- [ ] `@` → Oracle IP, TTL 300
- [ ] `www` → Oracle IP, TTL 300
- [ ] dnschecker.org confirms both

**Install**
- [ ] Installer ran to the finish banner
- [ ] 6-character invite code written down
- [ ] Health check returns `"status":"healthy"`
- [ ] Smoke test shows 10 PASS and "ALL CHECKS PASSED"

**Account**
- [ ] Owner account registered with the invite code
- [ ] Logged in and dashboard loads

**Credentials (optional, in this order)**
- [ ] SUPPORT_EMAIL
- [ ] SMTP (email)
- [ ] Stripe key + webhook with all six events
- [ ] Gemini (AI)
- [ ] Twilio (texts and calls)
- [ ] `verify-credentials.sh` shows PASS for everything configured

**Week one**
- [ ] Oracle upgraded to Pay As You Go
- [ ] Backups confirmed in `/var/backups/trueaxis`
- [ ] First JSON export downloaded

---

**When something looks different from this guide, stop and describe exactly what
you see.** Most problems here are a missing port rule, DNS not settled yet, or a
`.env` typo — all quick fixes, none of them a rebuild.
