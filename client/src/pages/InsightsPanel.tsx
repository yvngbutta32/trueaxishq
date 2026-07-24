/**
 * InsightsPanel — Unified Business Intelligence hub
 * Tabs: Analytics · Client Pulse · Expenses & P&L · Forecast
 *
 * Consolidates: AnalyticsPanel, ClientPulse, Expenses, RevenueForecastPanel
 * into one place so all performance data is viewed together.
 */
import { PanelTabs } from "@/components/PanelTabs";
import { BarChart3, HeartPulse, Receipt, TrendingUp } from "lucide-react";
import ClientPulse from "./ClientPulse";
import Expenses from "./Expenses";
import RevenueForecastPanel from "./RevenueForecastPanel";

// AnalyticsPanel lives inside Dashboard.tsx — passed as a prop
interface InsightsPanelProps {
  analyticsPanel: React.ReactNode;
}

export default function InsightsPanel({ analyticsPanel }: InsightsPanelProps) {
  return (
    <PanelTabs
      defaultTab="analytics"
      tabs={[
        {
          id: "analytics",
          label: "Analytics",
          icon: BarChart3,
          content: analyticsPanel,
        },
        {
          id: "pulse",
          label: "Client Pulse",
          icon: HeartPulse,
          badge: "AI",
          content: <ClientPulse />,
        },
        {
          id: "expenses",
          label: "Expenses & P&L",
          icon: Receipt,
          content: <Expenses />,
        },
        {
          id: "forecast",
          label: "Forecast",
          icon: TrendingUp,
          badge: "New",
          content: <RevenueForecastPanel />,
        },
      ]}
    />
  );
}
