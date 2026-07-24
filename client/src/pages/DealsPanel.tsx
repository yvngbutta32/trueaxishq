/**
 * DealsPanel — Unified Deals hub
 * Tabs: Contracts · Proposals
 *
 * Consolidates: ContractsPanel, Proposals
 * into one place so the entire deal lifecycle (proposal → contract → signed) is managed together.
 */
import { PanelTabs } from "@/components/PanelTabs";
import { FileSignature, FileText } from "lucide-react";
import Proposals from "./Proposals";

// ContractsPanel lives inside Dashboard.tsx — passed as a prop
interface DealsPanelProps {
  contractsPanel: React.ReactNode;
}

export default function DealsPanel({ contractsPanel }: DealsPanelProps) {
  return (
    <PanelTabs
      defaultTab="contracts"
      tabs={[
        {
          id: "contracts",
          label: "Contracts",
          icon: FileSignature,
          content: contractsPanel,
        },
        {
          id: "proposals",
          label: "Proposals",
          icon: FileText,
          badge: "New",
          content: <Proposals />,
        },
      ]}
    />
  );
}
