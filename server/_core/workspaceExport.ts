/* Full workspace data export — the honest flip side of the import wizard.
 *
 * Competitors lock you in; we hand you your entire business back as one JSON
 * file. The export is owner-scoped, row-capped with honest truncation flags,
 * and NEVER contains credential material: password hashes, session tokens,
 * API keys, OAuth/TOTP secrets, or webhook signing secrets are redacted
 * client-invisible by design (they are not exported, only "[redacted]").
 *
 * This module owns the table registry and the redaction logic so both the
 * tRPC procedure and the test suite can pin them down independently. */

import {
  clients, customerAssets, assetInspectionTemplates,
  invoices, bookings, followUps, clientPulse,
  contracts, timeEntries, clientDocuments, clientCustomFields, clientCustomFieldValues,
  jobChecklistTemplates, jobChecklistTemplateItems, recurringInvoices,
  testimonials, services, priceBookItems, expenses,
  proposals, automations, intakeForms, intakeResponses, revenueGoals,
  jobPhotos, jobs, jobTasks, jobPhases, jobActivities,
  inventoryItems, inventoryLocations, inventoryMovements,
  purchaseOrders, purchaseOrderItems, customReports,
  teamMembers, staffAvailabilityBlocks, jobAssignments, serviceVisits,
  recurringServicePlans, subcontractors, jobSubcontractors, jobSubcontractorNotes,
  clientTags,
} from "../../drizzle/schema";

/* Every table that is (a) the owner's business data and (b) safe to hand back.
 * Deliberately EXCLUDED: leads and contactMessages (global site-level tables with
 * no workspace owner), userSessions, passwordResetTokens, twoFactorBackupCodes,
 * userApiKeys, smsLoginCodes, workspaceStaffInvites, inviteCodes, securityEvents,
 * auditLogs (operational logs, not business data, and unbounded), all *Tokens
 * tables (calendarFeedTokens, portalTokens, track links, etc.), stripeWebhookEvents,
 * workflowWebhookDeliveries (credentials in payload), and geocodeCache (cache, not data). */
export const EXPORT_TABLES = [
  ["clients", clients],
  ["clientTags", clientTags],
  ["customerAssets", customerAssets],
  ["assetInspectionTemplates", assetInspectionTemplates],
  ["services", services],
  ["priceBookItems", priceBookItems],
  ["jobs", jobs],
  ["jobPhases", jobPhases],
  ["jobTasks", jobTasks],
  ["jobActivities", jobActivities],
  ["jobPhotos", jobPhotos],
  ["serviceVisits", serviceVisits],
  ["recurringServicePlans", recurringServicePlans],
  ["bookings", bookings],
  ["teamMembers", teamMembers],
  ["staffAvailabilityBlocks", staffAvailabilityBlocks],
  ["jobAssignments", jobAssignments],
  ["subcontractors", subcontractors],
  ["jobSubcontractors", jobSubcontractors],
  ["jobSubcontractorNotes", jobSubcontractorNotes],
  ["invoices", invoices],
  ["recurringInvoices", recurringInvoices],
  ["expenses", expenses],
  ["timeEntries", timeEntries],
  ["proposals", proposals],
  ["contracts", contracts],
  ["jobChecklistTemplates", jobChecklistTemplates],
  ["jobChecklistTemplateItems", jobChecklistTemplateItems],
  ["clientDocuments", clientDocuments],
  ["clientCustomFields", clientCustomFields],
  ["clientCustomFieldValues", clientCustomFieldValues],
  ["clientPulse", clientPulse],
  ["followUps", followUps],
  ["intakeForms", intakeForms],
  ["intakeResponses", intakeResponses],
  ["automations", automations],
  ["inventoryItems", inventoryItems],
  ["inventoryLocations", inventoryLocations],
  ["inventoryMovements", inventoryMovements],
  ["purchaseOrders", purchaseOrders],
  ["purchaseOrderItems", purchaseOrderItems],
  ["customReports", customReports],
  ["revenueGoals", revenueGoals],
  ["testimonials", testimonials],
] as const;

export const EXPORT_ROW_CAP = 5_000;

/* Keys matching this pattern are replaced with "[redacted]" before the row
 * leaves the server. bcrypt hashes, HMAC code hashes, OAuth refresh tokens,
 * webhook signing secrets, and API key hashes all match. */
const SENSITIVE_KEY = /password|secret|token|apikey|credential|webhooksigningkey|codehash/i;

export const REDACTED = "[redacted]";

/** Deep-walks one exported row and redacts values on sensitive keys. */
export function redactSensitive<T>(value: T): T {
  if (Array.isArray(value)) return value.map(redactSensitive) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEY.test(k) ? REDACTED : redactSensitive(v);
    }
    return out as unknown as T;
  }
  return value;
}
