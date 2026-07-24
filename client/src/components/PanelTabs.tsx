/**
 * PanelTabs — reusable tabbed layout for consolidated panels.
 * Renders a pill-style tab bar at the top and the active tab's content below.
 * Readability: inactive tabs at 0.70 opacity, active at full amber.
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
      <div
        className="flex items-center gap-0.5 px-3 pt-3 pb-0 border-b border-[rgba(245,239,227,0.10)] overflow-x-auto scrollbar-none flex-shrink-0"
        role="tablist"
        aria-label="Panel sections"
      >
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = tab.id === active;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              aria-controls={`panel-tab-${tab.id}`}
              onClick={() => handleTab(tab.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-semibold rounded-t-lg border-b-2 transition-all duration-150 whitespace-nowrap relative -mb-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4922A] focus-visible:ring-offset-1 ${
                isActive
                  ? "border-[#D4922A] text-[#D4922A] bg-[rgba(212,146,42,0.08)]"
                  : "border-transparent text-[rgba(245,239,227,0.70)] hover:text-[rgba(245,239,227,0.92)] hover:bg-[rgba(255,255,255,0.05)]"
              }`}
            >
              {Icon && <Icon className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />}
              <span>{tab.label}</span>
              {tab.badge && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  isActive ? "bg-[#D4922A]/20 text-[#D4922A]" : "bg-[rgba(255,255,255,0.10)] text-[rgba(245,239,227,0.70)]"
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Active tab content */}
      <div
        id={`panel-tab-${activeTab?.id}`}
        role="tabpanel"
        className="flex-1 min-h-0 overflow-y-auto"
      >
        {activeTab?.content}
      </div>
    </div>
  );
}
