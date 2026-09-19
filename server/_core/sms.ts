/**
 * SMS delivery via the Twilio REST API — env-gated, zero-dependency.
 *
 * Follows the same delivery contract as _core/email.ts: when Twilio
 * credentials are not configured the message is logged to the server
 * console (mode: "console") instead of failing, so dev environments and
 * self-hosts without SMS keep working. No Twilio SDK — the REST API is a
 * single fetch call.
 *
 * Environment variables (.env):
 *   TWILIO_ACCOUNT_SID  — AC-prefixed account SID from console.twilio.com
 *   TWILIO_AUTH_TOKEN    — auth token from the same console page
 *   TWILIO_FROM_NUMBER   — your Twilio phone number in E.164 (e.g. +15125550100)
 *
 * Every sendSms() caller is responsible for TCPA discipline: the recipient
 * must have an explicit, recorded opt-in (clients.smsOptIn or a booking-form
 * checkbox). The transport refuses nothing — the policy lives at the call
 * sites, where the consent evidence lives.
 */

import { ENV } from "./env";

export interface SmsPayload {
  to: string;          // raw or E.164 phone number
  body: string;        // plain text; Twilio caps a single SMS at 1600 chars
  fromOverride?: string;
}

export interface SmsResult {
  success: boolean;
  id: string;          // Twilio message SID, or "console"
  mode: "twilio" | "console";
  error?: string;
}

/** Strips US-style formatting and forces E.164: "(512) 555-0100" → "+15125550100".
 *  Returns null for anything that isn't a plausible dialable number. */
export function normalizePhoneToE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/[^\d+]/g, "");
  const hadPlus = digits.startsWith("+");
  digits = digits.replace(/\+/g, "");
  if (digits.length === 10) digits = `1${digits}`; // assume US when no country code
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (hadPlus && digits.length >= 11 && digits.length <= 15) return `+${digits}`; // international with explicit +
  return null;
}

/** Is SMS delivery configured? Mirrors getEmailDeliveryStatus() semantics. */
export function getSmsDeliveryStatus(): { configured: boolean; from: string | null } {
  const configured = Boolean(
    ENV.twilioAccountSid &&
    ENV.twilioAuthToken &&
    ENV.twilioFromNumber
  );
  return {
    configured,
    from: configured ? ENV.twilioFromNumber : null,
  };
}

export function wasSmsAcceptedByConfiguredTwilio(result: SmsResult): boolean {
  return result.mode === "twilio" && result.success;
}

const TWILIO_API = "https://api.twilio.com/2010-04-01/Accounts";
const MAX_SMS_CHARS = 1600; // Twilio single-message cap

export async function sendSms(payload: SmsPayload): Promise<SmsResult> {
  const to = normalizePhoneToE164(payload.to);
  if (!to) {
    return { success: false, id: "", mode: "console", error: `"${payload.to}" is not a valid phone number.` };
  }
  const body = payload.body.slice(0, MAX_SMS_CHARS);
  const { configured } = getSmsDeliveryStatus();
  const from = normalizePhoneToE164(payload.fromOverride || ENV.twilioFromNumber || "");

  if (!configured || !from) {
    console.log(`[SMS → console] To: ${to} | Body: ${body}`);
    return { success: true, id: "console", mode: "console" };
  }

  const auth = Buffer.from(`${ENV.twilioAccountSid}:${ENV.twilioAuthToken}`).toString("base64");
  try {
    const response = await fetch(
      `${TWILIO_API}/${ENV.twilioAccountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: to, From: from, Body: body }),
      }
    );
    const data = await response.json().catch(() => ({})) as { sid?: string; message?: string; code?: number };
    if (!response.ok) {
      const reason = data.message
        ? `Twilio ${response.status}: ${data.message} (code ${data.code ?? "?"})`
        : `Twilio ${response.status}`;
      console.log(`[SMS → twilio] FAILED to ${to} — ${reason}`);
      return { success: false, id: "", mode: "twilio", error: reason };
    }
    console.log(`[SMS → twilio] Sent to ${to} — sid: ${data.sid}`);
    return { success: true, id: data.sid ?? "", mode: "twilio" };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "network error";
    console.log(`[SMS → twilio] FAILED to ${to} — ${reason}`);
    return { success: false, id: "", mode: "twilio", error: reason };
  }
}
