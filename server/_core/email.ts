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
 * The platform works fully without email — this is purely additive.
 */
export async function sendEmail(payload: EmailPayload): Promise<EmailResult> {
  const transporter = getTransporter();
  const senderEmail = process.env.SMTP_USER;

  if (!transporter || !senderEmail) {
    // No SMTP configured — log to console, still return success
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

// ─── Email Templates ──────────────────────────────────────────────────────────

function baseTemplate(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>TrueAxis HQ</title>
  <style>
    body { margin: 0; padding: 0; background: #F5F0E8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .wrapper { max-width: 600px; margin: 0 auto; padding: 32px 16px; }
    .card { background: #1C1C1E; border-radius: 16px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #E8A020, #D4911A); padding: 28px 32px; }
    .header h1 { margin: 0; color: #fff; font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }
    .header p { margin: 4px 0 0; color: rgba(255,255,255,0.85); font-size: 13px; }
    .body { padding: 32px; color: #E5E5E5; font-size: 15px; line-height: 1.6; }
    .body h2 { color: #fff; font-size: 18px; margin: 0 0 12px; }
    .body p { margin: 0 0 16px; }
    .btn { display: inline-block; background: #E8A020; color: #fff !important; text-decoration: none; padding: 14px 28px; border-radius: 10px; font-weight: 700; font-size: 15px; margin: 8px 0 20px; }
    .divider { border: none; border-top: 1px solid rgba(255,255,255,0.08); margin: 24px 0; }
    .footer { padding: 20px 32px; background: rgba(0,0,0,0.3); color: #888; font-size: 12px; text-align: center; }
    .footer a { color: #E8A020; text-decoration: none; }
    .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.06); font-size: 14px; }
    .detail-label { color: #999; }
    .detail-value { color: #fff; font-weight: 600; }
    .badge { display: inline-block; background: rgba(232,160,32,0.15); color: #E8A020; border: 1px solid rgba(232,160,32,0.3); border-radius: 20px; padding: 3px 12px; font-size: 12px; font-weight: 700; }
    .badge-red { background: rgba(255,107,107,0.15); color: #FF6B6B; border-color: rgba(255,107,107,0.3); }
    .badge-green { background: rgba(52,211,153,0.15); color: #34D399; border-color: rgba(52,211,153,0.3); }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <h1>TrueAxis HQ</h1>
        <p>AI-Powered Business OS for Freelancers</p>
      </div>
      <div class="body">${content}</div>
      <div class="footer">
        <p>&copy; ${new Date().getFullYear()} TrueAxis HQ &mdash; <a href="#">Unsubscribe</a></p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export function forgotPasswordEmail(opts: { name: string; resetUrl: string }): string {
  return baseTemplate(`
    <h2>Reset Your Password</h2>
    <p>Hi ${opts.name || "there"},</p>
    <p>We received a request to reset the password for your TrueAxis HQ account. Click the button below to choose a new password:</p>
    <a href="${opts.resetUrl}" class="btn">Reset Password &rarr;</a>
    <hr class="divider" />
    <p style="font-size:13px;color:#999;">This link expires in <strong style="color:#E8A020;">1 hour</strong>. If you didn't request this, you can safely ignore this email.</p>
    <p style="font-size:13px;color:#999;">If the button doesn't work, copy and paste this link:<br/><a href="${opts.resetUrl}" style="color:#E8A020;word-break:break-all;">${opts.resetUrl}</a></p>
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
    <p>Hi ${opts.clientName},</p>
    <p>This is a friendly reminder that the following invoice is outstanding:</p>
    <div style="background:rgba(255,255,255,0.04);border-radius:10px;padding:16px;margin:16px 0;">
      <div class="detail-row"><span class="detail-label">Invoice #</span><span class="detail-value">${opts.invoiceNumber}</span></div>
      <div class="detail-row"><span class="detail-label">Amount Due</span><span class="detail-value">${opts.amount}</span></div>
      <div class="detail-row" style="border-bottom:none;"><span class="detail-label">Due Date</span><span class="detail-value badge badge-red">${opts.dueDate}</span></div>
    </div>
    ${opts.portalUrl ? `<a href="${opts.portalUrl}" class="btn">View &amp; Pay Invoice &rarr;</a>` : ""}
    <p style="font-size:13px;color:#999;">If you've already sent payment, please disregard this message. Thank you!</p>
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
    <p>Hi ${opts.clientName},</p>
    <p>Your session has been confirmed. Here are the details:</p>
    <div style="background:rgba(255,255,255,0.04);border-radius:10px;padding:16px;margin:16px 0;">
      <div class="detail-row"><span class="detail-label">Service</span><span class="detail-value">${opts.serviceName}</span></div>
      <div class="detail-row"><span class="detail-label">Date</span><span class="detail-value">${opts.date}</span></div>
      <div class="detail-row"><span class="detail-label">Time</span><span class="detail-value">${opts.time}</span></div>
      <div class="detail-row" style="border-bottom:none;"><span class="detail-label">With</span><span class="detail-value">${opts.freelancerName}</span></div>
    </div>
    <p>We look forward to working with you!</p>
    ${opts.cancelUrl ? `<p style="font-size:13px;color:#999;">Need to reschedule? <a href="${opts.cancelUrl}" style="color:#E8A020;">Click here</a>.</p>` : ""}
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
    <h2>Payment Received <span class="badge badge-green">Paid</span></h2>
    <p>Hi ${opts.clientName},</p>
    <p>Thank you! We've received your payment. Here's your receipt summary:</p>
    <div style="background:rgba(255,255,255,0.04);border-radius:10px;padding:16px;margin:16px 0;">
      <div class="detail-row"><span class="detail-label">Invoice #</span><span class="detail-value">${opts.invoiceNumber}</span></div>
      <div class="detail-row"><span class="detail-label">Amount Paid</span><span class="detail-value badge badge-green">${opts.amount}</span></div>
      <div class="detail-row" style="border-bottom:none;"><span class="detail-label">Payment Date</span><span class="detail-value">${opts.paidDate}</span></div>
    </div>
    ${opts.receiptUrl ? `<a href="${opts.receiptUrl}" class="btn">Download Receipt &rarr;</a>` : ""}
    <p style="font-size:13px;color:#999;">Thank you for your business!</p>
  `);
}

export function followUpEmail(opts: {
  clientName: string;
  subject: string;
  body: string;
}): string {
  return baseTemplate(`
    <h2>${opts.subject}</h2>
    <p>Hi ${opts.clientName},</p>
    ${opts.body.split("\n").filter(l => l.trim()).map(line => `<p>${line}</p>`).join("")}
  `);
}
