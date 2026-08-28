import { describe, expect, it } from "vitest";
import { getRecurringInvoiceDeliveryOutcome } from "./recurringInvoiceDeliveryOutcome";

describe("recurring invoice delivery outcome", () => {
  it("keeps no-recipient, console fallback, and failed SMTP invoices in draft state", () => {
    expect(getRecurringInvoiceDeliveryOutcome({ hasClientEmail: false, emailResult: null })).toMatchObject({ invoiceStatus: "draft", ownerNotice: expect.stringContaining("No client email") });
    expect(getRecurringInvoiceDeliveryOutcome({ hasClientEmail: true, emailResult: { success: true, mode: "console" } })).toMatchObject({ invoiceStatus: "draft", ownerNotice: expect.stringContaining("No SMTP delivery") });
    expect(getRecurringInvoiceDeliveryOutcome({ hasClientEmail: true, emailResult: { success: false, mode: "smtp" } })).toMatchObject({ invoiceStatus: "draft", ownerNotice: expect.stringContaining("did not succeed") });
  });

  it("marks an invoice sent only after configured SMTP accepts the message", () => {
    expect(getRecurringInvoiceDeliveryOutcome({ hasClientEmail: true, emailResult: { success: true, mode: "smtp", id: "message-id" } })).toMatchObject({ invoiceStatus: "sent", ownerNotice: expect.stringContaining("accepted") });
  });
});
