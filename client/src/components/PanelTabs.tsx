/**
 * PanelTabs — reusable tabbed layout for consolidated panels.
 * Renders a pill-style tab bar at the top and the active tab's content below.
 */
import React, { useState } from "react";

export interface Tab {
  id: string;
  label: string;
  icon?: React.ElementType;
  badge?: string;
  content: React.ReactNode;
}

interface PanelTabsProps {
  tabs: Tab[];
  defaultTab?: string;
  /** Called when the active tab changes */
  onTabChange?: (id: string) => void;
}

export function PanelTabs({ tabs, defaultTab, onTabChange }: PanelTabsProps) {
  const [active, setActive] = useState(defaultTab ?? tabs[0]?.id ?? "");

  function handleTab(id: string) {
    setActive(id);
    onTabChange?.(id);
  }

  const activeTab = tabs.find(t => t.id === active) ?? tabs[0];

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Tab bar */}
      <div className="flex items-center gap-1 px-4 pt-3 pb-0 border-b border-[rgba(245,239,227,0.08)] overflow-x-auto scrollbar-none flex-shrink-0">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = tab.id === active;
          return (
            <button
              key={tab.id}
              onClick={() => handleTab(tab.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-all whitespace-nowrap relative -mb-px ${
                isActive
                  ? "border-[#D4922A] text-[#D4922A] bg-[rgba(212,146,42,0.06)]"
                  : "border-transparent text-[rgba(245,239,227,0.45)] hover:text-[rgba(245,239,227,0.8)] hover:bg-[rgba(255,255,255,0.04)]"
              }`}
            >
              {Icon && <Icon className="w-3.5 h-3.5 flex-shrink-0" />}
              <span>{tab.label}</span>
              {tab.badge && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  isActive ? "bg-[#D4922A]/20 text-[#D4922A]" : "bg-[rgba(255,255,255,0.08)] text-[rgba(245,239,227,0.55)]"
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Active tab content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {activeTab?.content}
      </div>
    </div>
  );
}
