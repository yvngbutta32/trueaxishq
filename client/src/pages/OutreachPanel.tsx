/**
 * OutreachPanel — Unified Client Communication hub
 * Tabs: Follow-Ups · Smart Inbox · Automations
 *
 * Consolidates: FollowUpsPanel, SmartInboxPanel, Automations
 * into one place so all outbound/inbound communication is managed together.
 */
import { PanelTabs } from "@/components/PanelTabs";
import { Mail, Inbox, Zap } from "lucide-react";
import Automations from "./Automations";

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
          badge: "New",
          content: <Automations />,
        },
      ]}
    />
  );
}
