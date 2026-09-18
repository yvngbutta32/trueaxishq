/**
 * TrueAxis HQ — Transactional Email (Multi-Provider, 100% Free)
 *
 * Works out of the box with ZERO configuration — emails are stored as
 * in-app notifications and logged to console when no SMTP is configured.
 *
 * To enable real email delivery (optional), add ONE of these free providers:
 *
 * Option A — Brevo (recommended, easiest): 300 emails/day free, no credit card
 *   1. Sign up at app.brevo.com (free)
 *   2. Go to Settings → SMTP & API → SMTP
 *   3. Add SMTP_HOST=smtp-relay.brevo.com, SMTP_PORT=587,
 *      SMTP_USER=your@email.com, SMTP_PASS=your-brevo-smtp-key
 *
 * Option B — Gmail App Password: 500 emails/day free
 *   1. Enable 2-Step Verification at myaccount.google.com
 *   2. Go to Security → App passwords → create one for "Mail"
 *   3. Add SMTP_HOST=smtp.gmail.com, SMTP_PORT=587,
 *      SMTP_USER=your@gmail.com, SMTP_PASS=16-char-app-password
 *
 * Option C — Outlook/Hotmail: free with any Microsoft account
 *   Add SMTP_HOST=smtp-mail.outlook.com, SMTP_PORT=587,
 *   SMTP_USER=your@outlook.com, SMTP_PASS=your-password
 *
 * Without any SMTP config, the platform works fully — emails show as
 * in-app notifications and are logged to the server console.
 */

import { createTransport as nodemailerCreateTransport, type Transporter as NodemailerTransporter } from "nodemailer";

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
}

export interface EmailResult {
  success: boolean;
  id?: string;
  error?: string;
  mode: "smtp" | "console";
}

export function wasAcceptedByConfiguredSmtp(result: EmailResult): boolean {
  return result.success && result.mode === "smtp";
}

let _transporter: NodemailerTransporter | null = null;
let _transporterChecked = false;

export function getEmailDeliveryStatus() {
  const host = process.env.SMTP_HOST?.trim();
  const rawPort = process.env.SMTP_PORT?.trim() || "587";
  const port = Number.parseInt(rawPort, 10);
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS;
  const sender = process.env.SMTP_FROM?.trim() || user || null;
  const validPort = Number.isInteger(port) && port >= 1 && port <= 65_535;
  const issues: string[] = [];
  if (!host) issues.push("missing_host");
  if (!user) issues.push("missing_user");
  if (!pass) issues.push("missing_password");
  if (!validPort) issues.push("invalid_port");
  if (!sender) issues.push("missing_sender");
  if (sender && !sender.includes("@")) issues.push("invalid_sender");
  return {
    configured: issues.length === 0,
    host: host ?? null,
    port: validPort ? port : null,
    sender,
    issues,
    secure: validPort && port === 465,
  };
}

/** Reset only the in-process transport cache; intended for tests and controlled config reloads. */
export function resetEmailTransportCache() {
  _transporter?.close();
  _transporter = null;
  _transporterChecked = false;
}

function getTransporter(): NodemailerTransporter | null {
  if (_transporterChecked) return _transporter;
  _transporterChecked = true;

  const status = getEmailDeliveryStatus();
  const host = process.env.SMTP_HOST?.trim();
  const port = status.port ?? 587;
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS;

  if (!status.configured || !host || !user || !pass) {
    console.log("[Email] No SMTP configured — emails will be logged to console. See server/_core/email.ts for setup instructions.");
    return null;
  }

  _transporter = nodemailerCreateTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    // Disable TLS cert verification only in development (self-signed certs);
    // enforce strict TLS in production to prevent MITM attacks
    tls: { rejectUnauthorized: process.env.NODE_ENV === "production" },
  });

  console.log(`[Email] SMTP configured via ${host}:${port} as ${user}`);
  return _transporter;
}

/**
 * Strip newlines and carriage returns from email header fields to prevent
 * SMTP header injection attacks (RFC 5321 §4.1.1.1).
 */
function sanitizeHeader(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

/**
 * Send a transactional email.
 * Falls back to console logging (no-op) if SMTP is not configured.
 */
export async function sendEmail(payload: EmailPayload): Promise<EmailResult> {
  const transporter = getTransporter();
  const senderEmail = getEmailDeliveryStatus().sender;
  // Sanitize all header fields that could contain user-supplied data
  const safePayload: EmailPayload = {
    ...payload,
    to: sanitizeHeader(payload.to),
    subject: sanitizeHeader(payload.subject),
    from: payload.from ? sanitizeHeader(payload.from) : payload.from,
    replyTo: payload.replyTo ? sanitizeHeader(payload.replyTo) : payload.replyTo,
  };

  if (!transporter || !senderEmail) {
    console.log(`[Email → console] To: ${safePayload.to} | Subject: ${safePayload.subject}`);
    return { success: true, id: "console", mode: "console" };
  }

  try {
    const info = await transporter.sendMail({
      from: safePayload.from || `"TrueAxis HQ" <${senderEmail}>`,
      to: safePayload.to,
      subject: safePayload.subject,
      html: safePayload.html,
      replyTo: safePayload.replyTo,
    });
    console.log(`[Email → smtp] Sent to ${payload.to} — messageId: ${info.messageId}`);
    return { success: true, id: info.messageId, mode: "smtp" };
  } catch (err: any) {
    console.error("[Email] SMTP send failed:", err?.message || err);
    return { success: false, error: "SMTP delivery failed. Check the configured provider and sender verification.", mode: "smtp" };
  }
}

// ─── Base Template ────────────────────────────────────────────────────────────
// Clean, light, concise — works in all major email clients

function baseTemplate(content: string, accentColor = "#E8A020"): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>TrueAxis HQ</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #F4F4F5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; color: #18181B; }
    .wrapper { max-width: 580px; margin: 0 auto; padding: 32px 16px 48px; }
    .card { background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.04); }
    .top-bar { height: 4px; background: ${accentColor}; }
    .header { padding: 28px 32px 20px; border-bottom: 1px solid #F0F0F0; }
    .header-brand { display: flex; align-items: center; gap: 10px; }
    .header-logo { width: 32px; height: 32px; background: ${accentColor}; border-radius: 8px; display: flex; align-items: center; justify-content: center; }
    .header-logo span { color: #fff; font-weight: 900; font-size: 14px; }
    .header-name { font-size: 15px; font-weight: 700; color: #18181B; letter-spacing: -0.3px; }
    .header-tagline { font-size: 11px; color: #A1A1AA; margin-top: 1px; }
    .body { padding: 32px; }
    .body h2 { font-size: 20px; font-weight: 700; color: #18181B; margin-bottom: 8px; letter-spacing: -0.4px; }
    .body .greeting { font-size: 15px; color: #52525B; margin-bottom: 16px; line-height: 1.5; }
    .body p { font-size: 14px; color: #52525B; line-height: 1.6; margin-bottom: 14px; }
    .detail-box { background: #FAFAFA; border: 1px solid #E4E4E7; border-radius: 8px; overflow: hidden; margin: 20px 0; }
    .detail-row { display: flex; justify-content: space-between; align-items: center; padding: 11px 16px; border-bottom: 1px solid #F0F0F0; font-size: 13px; }
    .detail-row:last-child { border-bottom: none; }
    .detail-label { color: #71717A; font-weight: 500; }
    .detail-value { color: #18181B; font-weight: 600; text-align: right; }
    .btn { display: inline-block; background: ${accentColor}; color: #ffffff !important; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 700; font-size: 14px; margin: 4px 0 20px; letter-spacing: -0.2px; }
    .btn:hover { opacity: 0.9; }
    .divider { border: none; border-top: 1px solid #F0F0F0; margin: 20px 0; }
    .note { font-size: 12px; color: #A1A1AA; line-height: 1.5; }
    .badge { display: inline-block; padding: 2px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; letter-spacing: 0.3px; text-transform: uppercase; }
    .badge-amber { background: #FEF3C7; color: #92400E; }
    .badge-red { background: #FEE2E2; color: #991B1B; }
    .badge-green { background: #D1FAE5; color: #065F46; }
    .badge-blue { background: #DBEAFE; color: #1E40AF; }
    .highlight-box { background: #FFFBEB; border: 1px solid #FDE68A; border-radius: 8px; padding: 14px 16px; margin: 16px 0; }
    .highlight-box .hl-label { font-size: 11px; font-weight: 700; color: #92400E; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
    .highlight-box p { font-size: 13px; color: #78350F; margin: 0; }
    .footer { padding: 20px 32px; background: #FAFAFA; border-top: 1px solid #F0F0F0; text-align: center; }
    .footer p { font-size: 11px; color: #A1A1AA; line-height: 1.6; }
    .footer a { color: ${accentColor}; text-decoration: none; font-weight: 600; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="top-bar"></div>
      <div class="header">
        <div class="header-brand">
          <div class="header-logo"><span>T</span></div>
          <div>
            <div class="header-name">TrueAxis HQ</div>
            <div class="header-tagline">AI-Powered Business OS for Freelancers</div>
          </div>
        </div>
      </div>
      <div class="body">${content}</div>
      <div class="footer">
        <p>&copy; ${new Date().getFullYear()} TrueAxis HQ &mdash; <a href="#">Unsubscribe</a> &middot; <a href="#">Privacy Policy</a></p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

// ─── HTML Escape Helper ─────────────────────────────────────────────────────────
/**
 * Escapes user-supplied strings before interpolating into HTML email templates.
 * Prevents XSS if a client name or invoice number contains HTML special chars.
 */
function esc(str: string | undefined | null): string {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

// ─── Email Templates ──────────────────────────────────────────────────────────

export function forgotPasswordEmail(opts: { name: string; resetUrl: string }): string {
  return baseTemplate(`
    <h2>Reset Your Password</h2>
    <p class="greeting">Hi ${opts.name || "there"},</p>
    <p>We received a request to reset the password on your TrueAxis HQ account. Click the button below to set a new password:</p>
    <a href="${opts.resetUrl}" class="btn">Reset Password &rarr;</a>
    <hr class="divider" />
    <p class="note">This link expires in <strong>1 hour</strong>. If you didn't request a password reset, you can safely ignore this email — your account remains secure.</p>
    <p class="note" style="margin-top:8px;">Button not working? Copy and paste this link into your browser:<br/><a href="${opts.resetUrl}" style="color:#E8A020;word-break:break-all;font-size:11px;">${opts.resetUrl}</a></p>
  `);
}

export function invoiceReminderEmail(opts: {
  clientName: string;
  invoiceNumber: string;
  amount: string;
  dueDate: string;
  portalUrl?: string;
}): string {
  return baseTemplate(`
    <h2>Invoice Reminder</h2>
    <p class="greeting">Hi ${esc(opts.clientName)},</p>
    <p>This is a friendly reminder that the following invoice is still outstanding. Please arrange payment at your earliest convenience.</p>
    <div class="detail-box">
      <div class="detail-row"><span class="detail-label">Invoice #</span><span class="detail-value">${esc(opts.invoiceNumber)}</span></div>
      <div class="detail-row"><span class="detail-label">Amount Due</span><span class="detail-value">${esc(opts.amount)}</span></div>
      <div class="detail-row"><span class="detail-label">Due Date</span><span class="detail-value"><span class="badge badge-red">${esc(opts.dueDate)}</span></span></div>
    </div>
    ${opts.portalUrl ? `<a href="${opts.portalUrl}" class="btn">View &amp; Pay Invoice &rarr;</a>` : ""}
    <p class="note">If you've already sent payment, please disregard this message. Thank you!</p>
  `);
}

export function bookingConfirmationEmail(opts: {
  clientName: string;
  serviceName: string;
  date: string;
  time: string;
  freelancerName: string;
  cancelUrl?: string;
  rescheduleUrl?: string;
}): string {
  return baseTemplate(`
    <h2>Booking Confirmed &#10003;</h2>
    <p class="greeting">Hi ${esc(opts.clientName)},</p>
    <p>Your session is confirmed. Here are your booking details:</p>
    <div class="detail-box">
      <div class="detail-row"><span class="detail-label">Service</span><span class="detail-value">${esc(opts.serviceName)}</span></div>
      <div class="detail-row"><span class="detail-label">Date</span><span class="detail-value">${esc(opts.date)}</span></div>
      <div class="detail-row"><span class="detail-label">Time</span><span class="detail-value">${esc(opts.time)}</span></div>
      <div class="detail-row"><span class="detail-label">With</span><span class="detail-value">${esc(opts.freelancerName)}</span></div>
    </div>
    <p>We look forward to working with you. If you have any questions before your session, simply reply to this email.</p>
    ${(opts.cancelUrl || opts.rescheduleUrl) ? `<hr class="divider" /><p class="note">Need to make a change? ${opts.rescheduleUrl ? `<a href="${opts.rescheduleUrl}" style="color:#E8A020;font-weight:600;">Reschedule</a>` : ""}${opts.cancelUrl && opts.rescheduleUrl ? "&nbsp;&middot;&nbsp;" : ""}${opts.cancelUrl ? `<a href="${opts.cancelUrl}" style="color:#E8A020;font-weight:600;">Cancel</a>` : ""} (available up to 24 hours before your session).</p>` : ""}
  `);
}

export function invoicePaidEmail(opts: {
  clientName: string;
  invoiceNumber: string;
  amount: string;
  paidDate: string;
  receiptUrl?: string;
}): string {
  return baseTemplate(`
    <h2>Payment Received <span class="badge badge-green" style="vertical-align:middle;margin-left:6px;">Paid</span></h2>
    <p class="greeting">Hi ${esc(opts.clientName)},</p>
    <p>Thank you — we've received your payment. Here's your receipt summary:</p>
    <div class="detail-box">
      <div class="detail-row"><span class="detail-label">Invoice #</span><span class="detail-value">${esc(opts.invoiceNumber)}</span></div>
      <div class="detail-row"><span class="detail-label">Amount Paid</span><span class="detail-value"><span class="badge badge-green">${esc(opts.amount)}</span></span></div>
      <div class="detail-row"><span class="detail-label">Payment Date</span><span class="detail-value">${esc(opts.paidDate)}</span></div>
    </div>
    ${opts.receiptUrl ? `<a href="${opts.receiptUrl}" class="btn">Download Receipt &rarr;</a>` : ""}
    <p class="note">Thank you for your business. We appreciate the opportunity to work with you.</p>
  `);
}

export function followUpEmail(opts: {
  clientName: string;
  subject: string;
  body: string;
}): string {
  return baseTemplate(`
    <h2>${esc(opts.subject)}</h2>
    <p class="greeting">Hi ${esc(opts.clientName)},</p>
    ${opts.body.split("\n").filter(l => l.trim()).map(line => `<p>${esc(line)}</p>`).join("")}
    <hr class="divider" />
    <p class="note">This message was sent via TrueAxis HQ. Reply directly to this email to respond.</p>
  `);
}

export function testimonialRequestEmail(opts: {
  clientName: string;
  freelancerName: string;
  serviceName: string;
  testimonialUrl: string;
}): string {
  return baseTemplate(`
    <h2>How did we do? &#11088;</h2>
    <p class="greeting">Hi ${esc(opts.clientName)},</p>
    <p>Thank you for working with <strong>${esc(opts.freelancerName)}</strong> on <strong>${esc(opts.serviceName)}</strong>. We'd love to hear about your experience.</p>
    <p>It takes less than 60 seconds and helps us serve future clients better:</p>
    <a href="${opts.testimonialUrl}" class="btn">Share Your Feedback &rarr;</a>
    <hr class="divider" />
    <p class="note">Your testimonial may be featured on our booking page. You can choose to remain anonymous when submitting.</p>
  `);
}

export function monthlyReportEmail(opts: {
  name: string;
  month: string;
  totalRevenue: string;
  newClients: number;
  invoicesPaid: number;
  invoicesOutstanding: number;
  topClient?: string;
  aiInsight?: string;
  dashboardUrl: string;
}): string {
  return baseTemplate(`
    <h2>${esc(opts.month)} Business Report</h2>
    <p class="greeting">Hi ${opts.name || "there"},</p>
    <p>Here's your monthly snapshot from TrueAxis HQ:</p>
    <div class="detail-box">
      <div class="detail-row"><span class="detail-label">Total Revenue</span><span class="detail-value">${esc(opts.totalRevenue)}</span></div>
      <div class="detail-row"><span class="detail-label">New Clients</span><span class="detail-value">${esc(String(opts.newClients))}</span></div>
      <div class="detail-row"><span class="detail-label">Invoices Paid</span><span class="detail-value"><span class="badge badge-green">${esc(String(opts.invoicesPaid))}</span></span></div>
      <div class="detail-row"><span class="detail-label">Outstanding Invoices</span><span class="detail-value"><span class="badge ${opts.invoicesOutstanding > 0 ? "badge-red" : "badge-green"}">${esc(String(opts.invoicesOutstanding))}</span></span></div>
      ${opts.topClient ? `<div class="detail-row"><span class="detail-label">Top Client</span><span class="detail-value">${esc(opts.topClient)}</span></div>` : ""}
    </div>
    ${opts.aiInsight ? `
    <div class="highlight-box">
      <div class="hl-label">&#129302; AI Insight</div>
      <p>${esc(opts.aiInsight)}</p>
    </div>` : ""}
    <a href="${opts.dashboardUrl}" class="btn">View Full Dashboard &rarr;</a>
    <hr class="divider" />
    <p class="note">You're receiving this because monthly reports are enabled in your Settings. <a href="${opts.dashboardUrl}">Manage preferences</a></p>
  `);
}

export function bookingCancelConfirmEmail(opts: {
  clientName: string;
  serviceName: string;
  date: string;
  time: string;
  action: "cancel" | "reschedule";
  rebookUrl?: string;
  previousDate?: string;
  previousTime?: string;
}): string {
  const isCancelled = opts.action === "cancel";
  return baseTemplate(`
    <h2>${isCancelled ? "Booking Cancelled" : "Booking Rescheduled"}</h2>
    <p class="greeting">Hi ${esc(opts.clientName)},</p>
    <p>${isCancelled
      ? `Your booking for <strong>${esc(opts.serviceName)}</strong> on <strong>${esc(opts.date)} at ${esc(opts.time)}</strong> has been successfully cancelled.`
      : `Your booking for <strong>${esc(opts.serviceName)}</strong>${opts.previousDate && opts.previousTime ? `, previously scheduled for <strong>${esc(opts.previousDate)} at ${esc(opts.previousTime)}</strong>,` : ""} is now confirmed for <strong>${esc(opts.date)} at ${esc(opts.time)}</strong>.`
    }</p>
    ${opts.rebookUrl ? `<a href="${opts.rebookUrl}" class="btn">${isCancelled ? "Book a New Appointment" : "Book Again"} &rarr;</a>` : ""}
    <hr class="divider" />
    <p class="note">If you have any questions, simply reply to this email and we'll be happy to help.</p>
  `);
}

// ─── New Client Welcome Email ─────────────────────────────────────────────────
export function newClientWelcomeEmail(opts: {
  clientName: string;
  freelancerName: string;
  bookingUrl: string;
}): string {
  return baseTemplate(`
    <h2>Welcome aboard &#127881;</h2>
    <p class="greeting">Hi ${esc(opts.clientName)},</p>
    <p>Thank you for booking with <strong>${esc(opts.freelancerName)}</strong> — we're excited to work with you. Your session is confirmed and you'll receive a separate confirmation with all the details.</p>
    <div class="highlight-box">
      <div class="hl-label">&#128161; What to expect</div>
      <p>Before your session, feel free to jot down any questions or goals you'd like to cover. The more prepared you are, the more you'll get out of your time together.</p>
    </div>
    <p>Need to book another session or check your upcoming appointments? Use the link below:</p>
    <a href="${opts.bookingUrl}" class="btn">View Booking Page &rarr;</a>
    <hr class="divider" />
    <p class="note">If you have any questions before your session, simply reply to this email and we'll be happy to help.</p>
  `);
}

// ─── Intake Form Auto-Reply Email ─────────────────────────────────────────────
export function intakeAutoReplyEmail(opts: {
  respondentName: string;
  formName: string;
  freelancerName: string;
  bookingUrl?: string;
}): string {
  return baseTemplate(`
    <h2>We received your submission &#10003;</h2>
    <p class="greeting">Hi ${esc(opts.respondentName)},</p>
    <p>Thank you for filling out <strong>${esc(opts.formName)}</strong>. Your response has been received and <strong>${esc(opts.freelancerName)}</strong> will be in touch with you shortly.</p>
    ${opts.bookingUrl ? `
    <div class="highlight-box">
      <div class="hl-label">&#128197; Ready to book a session?</div>
      <p>While you wait, you can go ahead and schedule a time that works for you.</p>
    </div>
    <a href="${opts.bookingUrl}" class="btn">Book a Session &rarr;</a>` : ""}
    <hr class="divider" />
    <p class="note">If you have any questions, simply reply to this email and we'll get back to you as soon as possible.</p>
  `);
}

// ─── Booking Reminder Email (24h before) ─────────────────────────────────────
export function bookingReminderEmail(opts: {
  clientName: string;
  serviceName: string;
  date: string;
  time: string;
  freelancerName: string;
  cancelUrl?: string;
  rescheduleUrl?: string;
}): string {
  return baseTemplate(`
    <h2>Your session is tomorrow &#9201;</h2>
    <p class="greeting">Hi ${esc(opts.clientName)},</p>
    <p>Just a friendly reminder that you have a session scheduled for tomorrow. Here are your details:</p>
    <div class="detail-box">
      <div class="detail-row"><span class="detail-label">Service</span><span class="detail-value">${esc(opts.serviceName)}</span></div>
      <div class="detail-row"><span class="detail-label">Date</span><span class="detail-value">${esc(opts.date)}</span></div>
      <div class="detail-row"><span class="detail-label">Time</span><span class="detail-value"><span class="badge badge-amber">${esc(opts.time)}</span></span></div>
      <div class="detail-row"><span class="detail-label">With</span><span class="detail-value">${esc(opts.freelancerName)}</span></div>
    </div>
    <p>We look forward to seeing you! If you have any last-minute notes to share, simply reply to this email.</p>
    ${(opts.cancelUrl || opts.rescheduleUrl) ? `<hr class="divider" /><p class="note">Need to make a change? ${opts.rescheduleUrl ? `<a href="${opts.rescheduleUrl}" style="color:#E8A020;font-weight:600;">Reschedule</a>` : ""}${opts.cancelUrl && opts.rescheduleUrl ? "&nbsp;&middot;&nbsp;" : ""}${opts.cancelUrl ? `<a href="${opts.cancelUrl}" style="color:#E8A020;font-weight:600;">Cancel</a>` : ""} (available up to 24 hours before your session).</p>` : ""}
  `);
}

// ─── Post-Session Check-In Email (48h after) ─────────────────────────────────
export function postSessionCheckInEmail(opts: {
  clientName: string;
  serviceName: string;
  freelancerName: string;
  bookingUrl: string;
}): string {
  return baseTemplate(`
    <h2>How did your session go? &#127775;</h2>
    <p class="greeting">Hi ${esc(opts.clientName)},</p>
    <p>It's been a couple of days since your <strong>${esc(opts.serviceName)}</strong> session with <strong>${esc(opts.freelancerName)}</strong>. We hope it was valuable!</p>
    <div class="highlight-box">
      <div class="hl-label">&#128172; We'd love your feedback</div>
      <p>Your experience matters. If you have a moment, reply to this email and let us know how the session went — what worked well, and what could be even better next time.</p>
    </div>
    <p>Ready to book your next session?</p>
    <a href="${opts.bookingUrl}" class="btn">Book Another Session &rarr;</a>
    <hr class="divider" />
    <p class="note">Thank you for choosing ${esc(opts.freelancerName)}. We look forward to working with you again.</p>
  `);
}
