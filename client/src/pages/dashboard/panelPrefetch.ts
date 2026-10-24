/* Panel prefetch — "seamless navigation" infrastructure.
 *
 * Every dashboard panel is a lazy chunk. Without prefetch, the FIRST click
 * on a section downloads its chunk and the user sees the loading fallback.
 * With hover/focus prefetch, the chunk is already cached by click time and
 * the panel mounts instantly.
 *
 * The import() paths here are byte-identical to the lazy loaders in
 * ../Dashboard.tsx, so Vite resolves them to the same chunks — no duplicate
 * downloads, no dead weight in the dashboard entry chunk.
 */

import { useCallback, useEffect } from "react";
import type { ActivePanel } from "./shared";

const panelLoaders: Partial<Record<ActivePanel, (() => Promise<unknown>)[]>> = {
  executive: [() => import("../ExecutiveDashboard")],
  launch: [() => import("../LaunchReadiness")],
  jobs: [() => import("../JobWorkspace")],
  team: [() => import("../TeamOperations")],
  dispatch: [() => import("../DispatchBoard")],
  field: [() => import("../FieldMode")],
  photos: [() => import("../JobPhotosPanel")],
  integrations: [() => import("../IntegrationHub")],
  webhooks: [() => import("../WorkflowWebhooks")],
  inventory: [() => import("./InventoryPanel")],
  subs: [() => import("./SubcontractorsPanel")],
  reports: [() => import("./ReportsPanel")],
  import: [() => import("./ImportPanel")],
  agency: [() => import("./SubAccountsPanel")],
  settings: [() => import("./SettingsPanel")],
  contracts: [() => import("./ContractsPanel")],
  testimonials: [() => import("./TestimonialsPanel")],
  analytics: [() => import("./AnalyticsPanel")],
  inbox: [() => import("./SmartInboxPanel")],
  pulse: [() => import("../ClientPulse")],
  time: [() => import("../TimeTracking")],
  services: [() => import("../Services")],
  expenses: [() => import("../Expenses")],
  proposals: [() => import("../Proposals")],
  automations: [() => import("../Automations")],
  billing: [() => import("../BillingPanel"), () => import("./InvoicesPanel")],
  outreach: [() => import("../OutreachPanel"), () => import("./SmartInboxPanel")],
  deals: [() => import("../DealsPanel"), () => import("../Proposals")],
  insights: [() => import("../InsightsPanel"), () => import("./AnalyticsPanel")],
};

const prefetched = new Set<ActivePanel>();

/** Fetch a panel's chunk(s) in the background. Idempotent and fire-and-forget. */
export function prefetchPanel(panel: ActivePanel): void {
  if (prefetched.has(panel)) return;
  const loaders = panelLoaders[panel];
  if (!loaders) return; // statically imported panels (overview, clients, …) have no chunk
  prefetched.add(panel);
  for (const load of loaders) {
    load().catch(() => {
      // Network hiccup during prefetch is not fatal — the lazy Suspense
      // boundary will retry on click. Un-mark so a later hover retries.
      prefetched.delete(panel);
    });
  }
}

/** After first paint, quietly warm the highest-traffic panels.
 * Callers must pass a module-level constant array so the effect runs once. */
export function useIdlePanelPrefetch(panels: ActivePanel[]): void {
  const delayMs = 1800;
  useEffect(() => {
    const start = () => {
      for (const panel of panels) prefetchPanel(panel);
    };
    const ric = (window as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    const t = window.setTimeout(() => {
      if (ric) {
        ric(() => start(), { timeout: 4000 });
      } else {
        start();
      }
    }, delayMs);
    return () => window.clearTimeout(t);
  }, [panels]);
}
