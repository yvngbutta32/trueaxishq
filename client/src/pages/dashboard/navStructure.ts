/* TrueAxis HQ — dashboard navigation: single source of truth.
 * Shared by the desktop sidebar and the mobile "All Features" sheet so the
 * two surfaces can never drift apart (owner IA directive, Oct 24 2026).
 *
 * Information-architecture rules this structure encodes:
 * 1. Groups follow the owner's real workflow, top to bottom:
 *    run the day → win & keep customers → schedule & deliver the work →
 *    staff → money → intelligence → system.
 * 2. Coexisting functions sit adjacent: Deals next to Outreach (sales
 *    pipeline), Billing next to Inventory (cost of doing the job), Insights
 *    next to Reports (intelligence), Integrations next to Webhooks (connect).
 * 3. One-time setup tools (Launch onboarding, Import Data migration) live in
 *    System — not permanently parked at the top of the nav.
 * 4. Exactly 23 live panels. Every other ActivePanel id is a legacy alias
 *    handled by LEGACY_PANEL_REDIRECTS in shared.tsx and must NOT appear here.
 */

import {
  Activity, BarChart3, Bot, Briefcase, Building2, Calendar, Camera, Download,
  FileBarChart, FileSignature, FileText, HardHat, LayoutDashboard, Mail, MapPin,
  Package, PlugZap, Rocket, Settings, Smartphone, Users, UsersRound, Webhook,
  type LucideIcon,
} from "lucide-react";
import { type ActivePanel } from "./shared";

export interface NavItem {
  icon: LucideIcon;
  label: string;
  panel: ActivePanel;
  badge?: string;
  /** One of the 4 fixed mobile bottom tabs. Excluded from the mobile sheet. */
  primaryMobile?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Home",
    items: [
      { icon: LayoutDashboard, label: "Dashboard",  panel: "overview",   primaryMobile: true },
      { icon: Activity,        label: "Operations", panel: "executive"   },
      { icon: Bot,             label: "AI Assistant", panel: "ai", badge: "AI" },
    ],
  },
  {
    label: "Customers",
    items: [
      { icon: Users,           label: "Clients",    panel: "clients",    primaryMobile: true },
      { icon: FileSignature,   label: "Deals",      panel: "deals"       },
      { icon: Mail,            label: "Outreach",   panel: "outreach"    },
    ],
  },
  {
    label: "Work",
    items: [
      { icon: Calendar,        label: "Scheduling", panel: "scheduling", primaryMobile: true },
      { icon: Briefcase,       label: "Jobs",       panel: "jobs"        },
      { icon: Camera,          label: "Job Photos",  panel: "photos"      },
      { icon: MapPin,          label: "Dispatch",    panel: "dispatch"    },
      { icon: Smartphone,      label: "Field Mode",  panel: "field"       },
    ],
  },
  {
    label: "Team",
    items: [
      { icon: UsersRound,      label: "Team",        panel: "team"        },
      { icon: HardHat,         label: "Subs",        panel: "subs"        },
    ],
  },
  {
    label: "Money",
    items: [
      { icon: FileText,        label: "Billing",     panel: "billing",    primaryMobile: true },
      { icon: Package,         label: "Inventory",   panel: "inventory"   },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { icon: BarChart3,       label: "Insights",    panel: "insights"    },
      { icon: FileBarChart,    label: "Reports",     panel: "reports"     },
    ],
  },
  {
    label: "System",
    items: [
      { icon: PlugZap,         label: "Integrations", panel: "integrations" },
      { icon: Webhook,         label: "Webhooks",     panel: "webhooks"     },
      { icon: Building2,       label: "Sub-Accounts", panel: "agency"       },
      { icon: Rocket,          label: "Launch",       panel: "launch"       },
      { icon: Download,        label: "Import Data",  panel: "import"      },
      { icon: Settings,        label: "Settings",     panel: "settings"    },
    ],
  },
];

/** The 4 fixed bottom tabs on mobile — the highest-frequency destinations. */
export const MOBILE_PRIMARY_TABS: NavItem[] =
  NAV_GROUPS.flatMap((g) => g.items).filter((i) => i.primaryMobile);

/** Groups for the mobile "All Features" sheet. The primary tabs are already
 *  permanent bottom-bar destinations, so they are removed here; any group
 *  left empty disappears. Result: the sheet mirrors the desktop sidebar 1:1. */
export const MOBILE_SHEET_GROUPS: NavGroup[] = NAV_GROUPS
  .map((g) => ({ label: g.label, items: g.items.filter((i) => !i.primaryMobile) }))
  .filter((g) => g.items.length > 0);
