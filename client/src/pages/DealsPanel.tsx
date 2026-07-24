/**
 * DealsPanel — Unified Deals hub
 * Tabs: Contracts · Proposals · Templates
 *
 * Consolidates: ContractsPanel, Proposals, ContractTemplatesPanel
 * into one place so the entire deal lifecycle (proposal → contract → signed) is managed together.
 */
import { PanelTabs } from "@/components/PanelTabs";
import { FileSignature, FileText, BookOpen } from "lucide-react";
import Proposals from "./Proposals";
import ContractTemplatesPanel from "./ContractTemplatesPanel";

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
          content: <Proposals />,
        },
        {
          id: "templates",
          label: "Templates",
          icon: BookOpen,
          badge: "New",
          content: <ContractTemplatesPanel />,
        },
      ]}
    />
  );
}
