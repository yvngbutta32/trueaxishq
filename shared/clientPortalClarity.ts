export type ClientNextStep = {
  tone: "urgent" | "attention" | "progress" | "ready";
  title: string;
  detail: string;
  action: string;
};

export function getClientNextStep(input: {
  unpaidInvoices: Array<{ status: string }>;
  bookings: Array<{ status: string }>;
  jobs: Array<{ status: string }>;
}): ClientNextStep {
  if (input.unpaidInvoices.some(invoice => invoice.status === "overdue")) {
    return { tone: "urgent", title: "Payment needs your attention", detail: "An invoice is overdue. Open Invoices to review the balance and payment option.", action: "Review invoice" };
  }
  if (input.unpaidInvoices.length > 0) {
    return { tone: "attention", title: "You have an invoice ready", detail: "Review the balance and payment details before your next appointment.", action: "Review invoice" };
  }
  if (input.jobs.some(job => job.status === "awaiting_client")) {
    return { tone: "attention", title: "Your input is needed", detail: "Your provider has an update or decision waiting for you in Work Progress.", action: "Review work progress" };
  }
  if (input.jobs.some(job => job.status === "in_progress")) {
    return { tone: "progress", title: "Your work is in progress", detail: "Follow milestones and proof of work in the Work Progress section below.", action: "View progress" };
  }
  if (input.bookings.some(booking => booking.status === "scheduled")) {
    return { tone: "progress", title: "Your appointment is scheduled", detail: "Review the appointment details below and contact your provider if anything changes.", action: "View appointment" };
  }
  return { tone: "ready", title: "Your workspace is up to date", detail: "There are no immediate actions waiting for you. Your provider will post updates here.", action: "View workspace" };
}
