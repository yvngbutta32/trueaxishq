import { TRPCError } from "@trpc/server";
import { sendEmail, wasAcceptedByConfiguredSmtp } from "./email";
import { ENV } from "./env";

export type NotificationPayload = { title: string; content: string };

const TITLE_MAX_LENGTH = 1200;
const CONTENT_MAX_LENGTH = 20000;

function validatePayload(input: NotificationPayload): NotificationPayload {
  if (typeof input.title !== "string" || !input.title.trim()) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Notification title is required." });
  }
  if (typeof input.content !== "string" || !input.content.trim()) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Notification content is required." });
  }
  const title = input.title.trim();
  const content = input.content.trim();
  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({ code: "BAD_REQUEST", message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.` });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({ code: "BAD_REQUEST", message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.` });
  }
  return { title, content };
}

/** Deliver an owner notification through the configured SMTP transport. */
export async function notifyOwner(payload: NotificationPayload): Promise<boolean> {
  const { title, content } = validatePayload(payload);
  if (!ENV.ownerEmail) {
    console.warn("[Notification] OWNER_EMAIL (or SMTP_USER) is not configured.");
    return false;
  }
  const result = await sendEmail({
    to: ENV.ownerEmail,
    subject: title,
    html: `<p>${content.replace(/\n/g, "<br />")}</p>`,
  });
  return wasAcceptedByConfiguredSmtp(result);
}
