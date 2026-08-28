import type { EmailResult } from "./_core/email";

export type RecurringInvoiceDeliveryOutcome = {
  invoiceStatus: "draft" | "sent";
  ownerNotice: string;
};

export function getRecurringInvoiceDeliveryOutcome(input: {
  hasClientEmail: boolean;
  emailResult: EmailResult | null;
}): RecurringInvoiceDeliveryOutcome {
  if (!input.hasClientEmail) {
    return {
      invoiceStatus: "draft",
      ownerNotice: "Invoice created. No client email was available, so no email attempt was made.",
    };
  }

  if (!input.emailResult || !input.emailResult.success) {
    return {
      invoiceStatus: "draft",
      ownerNotice: "Invoice created. The SMTP attempt did not succeed; review delivery setup before resending.",
    };
  }

  if (input.emailResult.mode === "console") {
    return {
      invoiceStatus: "draft",
      ownerNotice: "Invoice created. No SMTP delivery was attempted; the message used the console fallback.",
    };
  }

  return {
    invoiceStatus: "sent",
    ownerNotice: "Invoice created. The message was accepted by the configured SMTP provider.",
  };
}
