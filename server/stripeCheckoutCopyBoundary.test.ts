import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

// The rendered What's-New modal lives in the dashboard tree; this boundary
// test pins its copy so payments are never oversold in user-facing changelog
// text (the shipped feature itself is covered by payments/e2e suites).
const changelogSource = fs.readFileSync(path.resolve(import.meta.dirname, "../client/src/pages/dashboard/ChangelogModal.tsx"), "utf8");

describe("Stripe Checkout change-log boundary", () => {
  it("describes configured payments and verified provider processing without an instant-completion promise", () => {
    // Honest, gated phrasing actually used by the rendered modal
    expect(changelogSource).toContain("Provider checkout and signed webhook handling require separate validation.");
    expect(changelogSource).toContain("Notification center");
    // Never promise instant completion or auto-marking — payment status only
    // changes after verified provider processing
    expect(changelogSource).not.toContain("Clients can pay invoices instantly via Stripe Checkout");
    expect(changelogSource).not.toContain("invoices auto-mark paid.");
    expect(changelogSource).not.toContain("real-time alerts");
    expect(changelogSource).not.toContain("Share a secure portal link");
  });
});
