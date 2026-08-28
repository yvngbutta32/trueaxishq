import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("public evidence-boundary copy", () => {
  it("does not represent the login workflow as autonomous, live, or predictive", () => {
    const login = source("client/src/pages/Login.tsx");

    expect(login).not.toContain("running itself");
    expect(login).not.toContain("Live analytics");
    expect(login).not.toContain("detect churn before it happens");
    expect(login).not.toContain("Automated invoicing with overdue alerts");
  });

  it("does not make unverified security, retention, notification, or support-response commitments", () => {
    const privacy = source("client/src/pages/Privacy.tsx");

    expect(privacy).not.toContain("AES-256 encryption");
    expect(privacy).not.toContain("Regular security audits and penetration testing");
    expect(privacy).not.toContain("within 30 days");
    expect(privacy).not.toContain("notify you of material changes by email");
    expect(privacy).not.toContain("within 5 business days");
    expect(privacy).toContain("not a security certification");
  });

  it("does not make unverified trials, refunds, backup, deletion, arbitration, or provider-processing claims", () => {
    const terms = source("client/src/pages/Terms.tsx");
    const pricing = source("client/src/pages/Pricing.tsx");

    expect(terms).not.toContain("14-day free trial");
    expect(terms).not.toContain("We do not provide refunds");
    expect(terms).not.toContain("regular backups");
    expect(terms).not.toContain("within 30 days");
    expect(terms).not.toContain("binding arbitration");
    expect(terms).toContain("qualified legal review");
    expect(pricing).not.toContain("Automated invoicing");
  });
});
