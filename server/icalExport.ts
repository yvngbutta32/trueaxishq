/**
 * iCal Export — /api/calendar/:userId.ics
 * Generates a valid iCalendar feed of all bookings for a given user.
 * Token-protected: requires ?token=<portal_token_or_api_key> OR the user's own session.
 * Completely free — pure Node.js, no external service.
 */
import { Router } from "express";
import { getDb } from "./db";
import { bookings, users, clientPortalTokens } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { verifySessionToken } from "./auth";
import { COOKIE_NAME } from "@shared/const";

export const icalRouter = Router();

function escapeIcal(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function formatIcalDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function generateUID(id: number, userId: number): string {
  return `booking-${id}-user-${userId}@trueaxis-hq`;
}

icalRouter.get("/calendar/:userIdIcs", async (req, res) => {
  try {
    const raw = req.params.userIdIcs;
    // Accept both /calendar/42.ics and /calendar/42
    const userIdStr = raw.replace(/\.ics$/, "");
    const userId = parseInt(userIdStr, 10);
    if (isNaN(userId)) return res.status(400).send("Invalid user ID");

    const db = await getDb();
    if (!db) return res.status(503).send("Database unavailable");

    // Auth: accept session cookie OR portal token query param
    let authorized = false;
    let portalClientId: number | null = null;

    // Check session cookie
    const sessionToken = req.cookies?.[COOKIE_NAME];
    if (sessionToken) {
      try {
        const payload = await verifySessionToken(sessionToken);
        if (payload && payload.userId === userId) authorized = true;
      } catch {}
    }

    // Check portal token (allows clients to subscribe to their provider's calendar)
    if (!authorized && req.query.token) {
      const token = String(req.query.token);
      const [portalRecord] = await db.select({ clientId: clientPortalTokens.clientId, expiresAt: clientPortalTokens.expiresAt })
        .from(clientPortalTokens)
        .where(and(eq(clientPortalTokens.token, token), eq(clientPortalTokens.userId, userId), eq(clientPortalTokens.revoked, false))).limit(1);
      // Verify token exists and is not expired
      if (portalRecord && (!portalRecord.expiresAt || new Date() <= portalRecord.expiresAt)) {
        authorized = true;
        portalClientId = portalRecord.clientId;
      }
    }

    if (!authorized) {
      return res.status(401).set("Content-Type", "text/plain").send("Unauthorized. Provide a valid session or portal token.");
    }

    // Fetch user info
    const [user] = await db.select({ name: users.name, businessName: users.businessName })
      .from(users).where(eq(users.id, userId)).limit(1);

    // Fetch all bookings for this user
    const userBookings = await db.select().from(bookings)
      .where(portalClientId === null
        ? eq(bookings.userId, userId)
        : and(eq(bookings.userId, userId), eq(bookings.clientId, portalClientId)));

    const calName = user?.businessName || user?.name || "TrueAxis HQ Calendar";
    const now = formatIcalDate(new Date());

    const lines: string[] = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      `PRODID:-//TrueAxis HQ//Calendar//EN`,
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      `X-WR-CALNAME:${escapeIcal(calName)}`,
      "X-WR-TIMEZONE:UTC",
      "X-WR-CALDESC:Bookings from TrueAxis HQ",
    ];

    for (const b of userBookings) {
      if (b.status === "cancelled" || b.status === "no_show") continue;

      // Parse date + time into a Date object
      let startDate: Date;
      try {
        startDate = new Date(`${b.date}T${b.time || "09:00"}:00Z`);
        if (isNaN(startDate.getTime())) throw new Error("invalid");
      } catch {
        continue; // skip malformed dates
      }

      const durationMin = b.duration || 60;
      const endDate = new Date(startDate.getTime() + durationMin * 60_000);

      const summary = portalClientId === null
        ? [b.service, b.clientName].filter(Boolean).join(" — ") || "Appointment"
        : b.service || "Appointment";
      const description = portalClientId === null
        ? [
            b.clientName ? `Client: ${escapeIcal(b.clientName)}` : "",
            b.clientEmail ? `Email: ${escapeIcal(b.clientEmail)}` : "",
            b.notes ? `Notes: ${escapeIcal(b.notes)}` : "",
          ].filter(Boolean).join("\\n")
        : "";

      lines.push("BEGIN:VEVENT");
      lines.push(`UID:${generateUID(b.id, userId)}`);
      lines.push(`DTSTAMP:${now}`);
      lines.push(`DTSTART:${formatIcalDate(startDate)}`);
      lines.push(`DTEND:${formatIcalDate(endDate)}`);
      lines.push(`SUMMARY:${escapeIcal(summary)}`);
      if (description) lines.push(`DESCRIPTION:${escapeIcal(description)}`);
      lines.push(`STATUS:${b.status === "completed" ? "COMPLETED" : "CONFIRMED"}`);
      lines.push("END:VEVENT");
    }

    lines.push("END:VCALENDAR");

    const icsContent = lines.join("\r\n");

    res.set({
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="trueaxis-calendar.ics"`,
      "Cache-Control": "no-cache, no-store",
    });
    res.send(icsContent);
  } catch (err) {
    console.error("[iCal] Error generating calendar feed:", err);
    res.status(500).send("Failed to generate calendar feed");
  }
});
