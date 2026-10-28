/* TrueAxis HQ — desktop sidebar.
 * Navigation groups come from navStructure.ts — the single source of truth
 * shared with the mobile "All Features" sheet.
 */

import { TRUEAXIS_LOGO_URL } from "@shared/const";
import { useLocation } from "wouter";
import { ChevronRight, Star } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NAV_GROUPS } from "./navStructure";
import { prefetchPanel } from "./panelPrefetch";
import { type ActivePanel } from "./shared";

function Sidebar({ active, setActive, collapsed, setCollapsed }: {
  active: ActivePanel; setActive: (p: ActivePanel) => void;
  collapsed: boolean; setCollapsed: (v: boolean | ((prev: boolean) => boolean)) => void;
}) {
  const [, navigate] = useLocation();
  const { user } = useAuth();

  return (
    <aside
      className={`fixed left-0 top-0 h-full bg-[#1B2D4F] border-r border-[#243A5E] flex flex-col transition-all duration-300 z-40 ${collapsed ? "w-16" : "w-60"}`}
      aria-label="Main navigation"
    >
      {/* Logo — click navigates to dashboard */}
      <div className="flex items-center justify-center px-3 py-4 border-b border-[#243A5E]">
        <button
          onClick={() => navigate("/dashboard")}
          className="flex items-center justify-center"
          aria-label="Go to dashboard"
          title="Dashboard"
          style={{ background: "none", border: "none", minHeight: "auto", minWidth: "auto", padding: 0 }}
        >
          {collapsed ? (
            <div className="w-8 h-8 rounded-lg overflow-hidden">
              <img
                src={TRUEAXIS_LOGO_URL}
                alt="TrueAxis HQ — Dashboard"
                className="w-full h-full object-cover object-left"
              />
            </div>
          ) : (
            <img
              src={TRUEAXIS_LOGO_URL}
              alt="TrueAxis HQ — Dashboard"
              className="h-9 w-auto object-contain"
            />
          )}
        </button>
      </div>

      {/* Nav — scrollable, footer stays pinned */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto min-h-0 scroll-smooth sidebar-scrollbar" aria-label="Dashboard sections">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} role="group" aria-label={group.label}>
            {!collapsed ? (
              <p className="px-3 pt-4 pb-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-white/35">{group.label}</p>
            ) : (
              <div className="my-2 mx-3 border-t border-white/10" aria-hidden="true" />
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <button
                  key={item.panel}
                  onClick={() => setActive(item.panel)}
                  onMouseEnter={() => prefetchPanel(item.panel)}
                  onFocus={() => prefetchPanel(item.panel)}
                  aria-current={active === item.panel ? "page" : undefined}
                  aria-label={item.label}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all relative ${
                    active === item.panel
                      ? "bg-[#D4922A]/20 text-white border-l-2 border-[#D4922A] pl-[10px] font-semibold"
                      : "text-white/65 hover:bg-white/10 hover:text-white border-l-2 border-transparent pl-[10px]"
                  }`}
                >
                  <item.icon className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                  {!collapsed && <span>{item.label}</span>}
                  {!collapsed && item.badge && active !== item.panel && (
                    <span className="ml-auto text-[9px] font-bold bg-[#D4922A]/25 text-[#D4922A] px-1.5 py-0.5 rounded-full">{item.badge}</span>
                  )}
                  {!collapsed && active === item.panel && <ChevronRight className="w-3 h-3 ml-auto" aria-hidden="true" />}
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-[#243A5E] space-y-1">

        {(user as { isOwner?: boolean } | null)?.isOwner && (
          <button onClick={() => navigate("/admin")} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/65 hover:bg-white/10 hover:text-white transition-all" aria-label="Admin panel">
            <Star className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>Admin Panel</span>}
          </button>
        )}
        {/* Keyboard shortcuts hint */}
        {!collapsed && (
          <div className="px-3 py-2 rounded-xl bg-white/5 border border-white/10">
            <p className="text-[9px] font-bold uppercase tracking-widest text-white/40 mb-1.5">Shortcuts</p>
            <div className="space-y-1">
              {[
                { keys: ["⌘", "K"], label: "Search" },
                { keys: ["N"],       label: "Billing" },
                { keys: ["C"],       label: "Clients" },
                { keys: ["B"],       label: "Schedule" },
                { keys: ["O"],       label: "Outreach" },
                { keys: ["D"],       label: "Deals" },
                { keys: ["I"],       label: "Insights" },
              ].map(({ keys, label }) => (
                <div key={label + keys.join()} className="flex items-center justify-between">
                  <span className="text-[10px] text-white/60">{label}</span>
                  <div className="flex items-center gap-0.5">
                    {keys.map(k => (
                      <kbd key={k} className="px-1 py-0.5 rounded border border-white/20 bg-white/10 text-[9px] text-white/70 font-mono leading-none">{k}</kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {/* Theme: light / dark */}
        <div className={collapsed ? "flex justify-center" : "flex justify-between items-center px-3"}>
          {!collapsed && <span className="text-xs text-white/50">Appearance</span>}
          <ThemeToggle compact className="text-white/50 border-white/15 hover:bg-white/10" />
        </div>
        {/* Collapse / Expand toggle */}
        <button
          onClick={() => setCollapsed(v => !v)}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/50 hover:bg-white/10 hover:text-white transition-all"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand" : "Collapse"}
        >
          <ChevronRight className={`w-4 h-4 flex-shrink-0 transition-transform duration-300 ${collapsed ? "" : "rotate-180"}`} />
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}


export { Sidebar };
