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

import nodemailer from "nodemailer";

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

let _transporter: nodemailer.Transporter | null = null;
let _transporterChecked = false;

function getTransporter(): nodemailer.Transporter | null {
  if (_transporterChecked) return _transporter;
  _transporterChecked = true;

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    console.log("[Email] No SMTP configured — emails will be logged to console. See server/_core/email.ts for setup instructions.");
    return null;
  }

  _transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
  });

  console.log(`[Email] SMTP configured via ${host}:${port} as ${user}`);
  return _transporter;
}

/**
 * Send a transactional email.
 * Falls back to console logging (no-op) if SMTP is not configured.
 */
export async function sendEmail(payload: EmailPayload): Promise<EmailResult> {
  const transporter = getTransporter();
  const senderEmail = process.env.SMTP_USER;

  if (!transporter || !senderEmail) {
    console.log(`[Email → console] To: ${payload.to} | Subject: ${payload.subject}`);
    return { success: true, id: "console", mode: "console" };
  }

  try {
    const info = await transporter.sendMail({
      from: payload.from || `"TrueAxis HQ" <${senderEmail}>`,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      replyTo: payload.replyTo,
    });
    console.log(`[Email → smtp] Sent to ${payload.to} — messageId: ${info.messageId}`);
    return { success: true, id: info.messageId, mode: "smtp" };
  } catch (err: any) {
    console.error("[Email] SMTP send failed:", err?.message || err);
    return { success: false, error: String(err), mode: "smtp" };
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
    <p class="greeting">Hi ${opts.clientName},</p>
    <p>This is a friendly reminder that the following invoice is still outstanding. Please arrange payment at your earliest convenience.</p>
    <div class="detail-box">
      <div class="detail-row"><span class="detail-label">Invoice #</span><span class="detail-value">${opts.invoiceNumber}</span></div>
      <div class="detail-row"><span class="detail-label">Amount Due</span><span class="detail-value">${opts.amount}</span></div>
      <div class="detail-row"><span class="detail-label">Due Date</span><span class="detail-value"><span class="badge badge-red">${opts.dueDate}</span></span></div>
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
}): string {
  return baseTemplate(`
    <h2>Booking Confirmed &#10003;</h2>
    <p class="greeting">Hi ${opts.clientName},</p>
    <p>Your session is confirmed. Here are your booking details:</p>
    <div class="detail-box">
      <div class="detail-row"><span class="detail-label">Service</span><span class="detail-value">${opts.serviceName}</span></div>
      <div class="detail-row"><span class="detail-label">Date</span><span class="detail-value">${opts.date}</span></div>
      <div class="detail-row"><span class="detail-label">Time</span><span class="detail-value">${opts.time}</span></div>
      <div class="detail-row"><span class="detail-label">With</span><span class="detail-value">${opts.freelancerName}</span></div>
    </div>
    <p>We look forward to working with you. If you have any questions before your session, simply reply to this email.</p>
    ${opts.cancelUrl ? `<hr class="divider" /><p class="note">Need to cancel or reschedule? <a href="${opts.cancelUrl}" style="color:#E8A020;font-weight:600;">Click here</a> (available up to 24 hours before your session).</p>` : ""}
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
    <p class="greeting">Hi ${opts.clientName},</p>
    <p>Thank you — we've received your payment. Here's your receipt summary:</p>
    <div class="detail-box">
      <div class="detail-row"><span class="detail-label">Invoice #</span><span class="detail-value">${opts.invoiceNumber}</span></div>
      <div class="detail-row"><span class="detail-label">Amount Paid</span><span class="detail-value"><span class="badge badge-green">${opts.amount}</span></span></div>
      <div class="detail-row"><span class="detail-label">Payment Date</span><span class="detail-value">${opts.paidDate}</span></div>
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
    <h2>${opts.subject}</h2>
    <p class="greeting">Hi ${opts.clientName},</p>
    ${opts.body.split("\n").filter(l => l.trim()).map(line => `<p>${line}</p>`).join("")}
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
    <p class="greeting">Hi ${opts.clientName},</p>
    <p>Thank you for working with <strong>${opts.freelancerName}</strong> on <strong>${opts.serviceName}</strong>. We'd love to hear about your experience.</p>
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
    <h2>${opts.month} Business Report</h2>
    <p class="greeting">Hi ${opts.name || "there"},</p>
    <p>Here's your monthly snapshot from TrueAxis HQ:</p>
    <div class="detail-box">
      <div class="detail-row"><span class="detail-label">Total Revenue</span><span class="detail-value">${opts.totalRevenue}</span></div>
      <div class="detail-row"><span class="detail-label">New Clients</span><span class="detail-value">${opts.newClients}</span></div>
      <div class="detail-row"><span class="detail-label">Invoices Paid</span><span class="detail-value"><span class="badge badge-green">${opts.invoicesPaid}</span></span></div>
      <div class="detail-row"><span class="detail-label">Outstanding Invoices</span><span class="detail-value"><span class="badge ${opts.invoicesOutstanding > 0 ? "badge-red" : "badge-green"}">${opts.invoicesOutstanding}</span></span></div>
      ${opts.topClient ? `<div class="detail-row"><span class="detail-label">Top Client</span><span class="detail-value">${opts.topClient}</span></div>` : ""}
    </div>
    ${opts.aiInsight ? `
    <div class="highlight-box">
      <div class="hl-label">&#129302; AI Insight</div>
      <p>${opts.aiInsight}</p>
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
}): string {
  const isCancelled = opts.action === "cancel";
  return baseTemplate(`
    <h2>${isCancelled ? "Booking Cancelled" : "Booking Rescheduled"}</h2>
    <p class="greeting">Hi ${opts.clientName},</p>
    <p>${isCancelled
      ? `Your booking for <strong>${opts.serviceName}</strong> on <strong>${opts.date} at ${opts.time}</strong> has been successfully cancelled.`
      : `Your booking for <strong>${opts.serviceName}</strong> on <strong>${opts.date} at ${opts.time}</strong> has been rescheduled.`
    }</p>
    ${opts.rebookUrl ? `<a href="${opts.rebookUrl}" class="btn">${isCancelled ? "Book a New Appointment" : "Book Again"} &rarr;</a>` : ""}
    <hr class="divider" />
    <p class="note">If you have any questions, simply reply to this email and we'll be happy to help.</p>
  `);
}
