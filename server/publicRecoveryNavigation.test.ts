import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("public invalid-link recovery navigation", () => {
  it("keeps a safe return route through the shared recovery state on every audited public page", () => {
    const pages = [
      "client/src/pages/BookingPage.tsx",
      "client/src/pages/ProposalSign.tsx",
      "client/src/pages/IntakeFormPage.tsx",
      "client/src/pages/TestimonialSubmit.tsx",
      "client/src/pages/BookingCancel.tsx",
    ];

    const recoveryComponent = source("client/src/components/PublicRecoveryState.tsx");
    expect(recoveryComponent).toContain('href="/"');
    expect(recoveryComponent).toContain("Return to TrueAxis HQ");
    expect(recoveryComponent).toContain("privacyNote?: string");
    expect(recoveryComponent).toContain("{privacyNote &&");

    for (const page of pages) expect(source(page)).toContain("PublicRecoveryState");
  });
});
