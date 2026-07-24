/**
 * BillingPanel — Unified Billing hub
 * Tabs: Invoices · Time Tracking · Recurring · Services
 *
 * Consolidates: InvoicesPanel, TimeTrackingPanel, RecurringInvoices, Services
 * into one place so billing-related work never requires switching panels.
 */
import { PanelTabs } from "@/components/PanelTabs";
import { FileText, Clock, RefreshCw, Package } from "lucide-react";
import TimeTrackingPanel from "./TimeTracking";
import RecurringInvoices from "./RecurringInvoices";
import Services from "./Services";

// InvoicesPanel is defined inside Dashboard.tsx and cannot be imported directly.
// We receive it as a prop so the parent (Dashboard) can pass the existing component.
interface BillingPanelProps {
  invoicesPanel: React.ReactNode;
  onInvoiceGenerated?: () => void;
}

export default function BillingPanel({ invoicesPanel, onInvoiceGenerated }: BillingPanelProps) {
  return (
    <PanelTabs
      defaultTab="invoices"
      tabs={[
        {
          id: "invoices",
          label: "Invoices",
          icon: FileText,
          content: invoicesPanel,
        },
        {
          id: "time",
          label: "Time Tracking",
          icon: Clock,
          content: <TimeTrackingPanel onInvoiceGenerated={onInvoiceGenerated} />,
        },
        {
          id: "recurring",
          label: "Recurring",
          icon: RefreshCw,
          content: <RecurringInvoices />,
        },
        {
          id: "services",
          label: "Service Catalog",
          icon: Package,
          content: <Services />,
        },
      ]}
    />
  );
}
