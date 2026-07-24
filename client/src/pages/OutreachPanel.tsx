/**
 * OutreachPanel — Unified Client Communication hub
 * Tabs: Follow-Ups · Smart Inbox · Automations · Intake Forms
 *
 * Consolidates: FollowUpsPanel, SmartInboxPanel, Automations, IntakeFormsPanel
 * into one place so all outbound/inbound communication is managed together.
 */
import { PanelTabs } from "@/components/PanelTabs";
import { Mail, Inbox, Zap, ClipboardList } from "lucide-react";
import Automations from "./Automations";
import IntakeFormsPanel from "./IntakeFormsPanel";

// FollowUpsPanel and SmartInboxPanel live inside Dashboard.tsx — passed as props
interface OutreachPanelProps {
  followUpsPanel: React.ReactNode;
  inboxPanel: React.ReactNode;
}

export default function OutreachPanel({ followUpsPanel, inboxPanel }: OutreachPanelProps) {
  return (
    <PanelTabs
      defaultTab="followups"
      tabs={[
        {
          id: "followups",
          label: "Follow-Ups",
          icon: Mail,
          content: followUpsPanel,
        },
        {
          id: "inbox",
          label: "Smart Inbox",
          icon: Inbox,
          content: inboxPanel,
        },
        {
          id: "automations",
          label: "Automations",
          icon: Zap,
          content: <Automations />,
        },
        {
          id: "intake",
          label: "Intake Forms",
          icon: ClipboardList,
          badge: "New",
          content: <IntakeFormsPanel />,
        },
      ]}
    />
  );
}
