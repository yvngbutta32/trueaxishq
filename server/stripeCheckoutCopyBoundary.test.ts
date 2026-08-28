import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const changelogSource = fs.readFileSync(path.resolve(import.meta.dirname, "../client/src/components/ChangelogModal.tsx"), "utf8");

describe("Stripe Checkout change-log boundary", () => {
  it("describes configured payments and verified provider processing without an instant-completion promise", () => {
    expect(changelogSource).toContain("Configured invoice payments can use Stripe Checkout; payment status is recorded after verified provider processing.");
    expect(changelogSource).not.toContain("Clients can pay invoices instantly via Stripe Checkout");
    expect(changelogSource).not.toContain("invoices auto-mark paid.");
  });
});
