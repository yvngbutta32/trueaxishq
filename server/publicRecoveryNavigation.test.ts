import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("public invalid-link recovery navigation", () => {
  it("keeps a safe return route on every audited public recovery state", () => {
    const pages = [
      "client/src/pages/BookingPage.tsx",
      "client/src/pages/ProposalSign.tsx",
      "client/src/pages/IntakeFormPage.tsx",
      "client/src/pages/TestimonialSubmit.tsx",
      "client/src/pages/BookingCancel.tsx",
    ];

    for (const page of pages) {
      const content = source(page);
      expect(content).toContain('href="/"');
      expect(content).toContain("Return to TrueAxis HQ");
    }
  });
});
