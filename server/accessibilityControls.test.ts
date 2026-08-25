import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("owner icon-control accessibility contract", () => {
  it("gives proposal actions explicit action names", () => {
    const proposals = source("client/src/pages/Proposals.tsx");
    expect(proposals).toContain("aria-label={`Preview proposal ${p.title}`}");
    expect(proposals).toContain("aria-label={`Send proposal ${p.title}`}");
    expect(proposals).toContain("aria-label={`Convert proposal ${p.title} to invoice`}");
    expect(proposals).toContain("aria-label={`Delete proposal ${p.title}`}");
  });

  it("labels service and revenue-goal controls and prevents accidental form submission", () => {
    const services = source("client/src/pages/Services.tsx");
    const revenue = source("client/src/pages/RevenueForecastPanel.tsx");
    expect(services).toContain("aria-label={`Edit service ${service.name}`}");
    expect(services).toContain("aria-label={`${inactive ? \"Activate\" : \"Deactivate\"} service ${service.name}`}");
    expect(revenue).toContain('aria-label="Save annual revenue goal"');
    expect(revenue).toContain('aria-label="Save monthly revenue goal"');
    expect(revenue).toContain('type="button"');
  });

  it("labels close, preview, edit, and delete controls in contract templates", () => {
    const templates = source("client/src/pages/ContractTemplatesPanel.tsx");
    expect(templates).toContain('aria-label="Close template editor"');
    expect(templates).toContain('aria-label="Close apply template panel"');
    expect(templates).toContain("aria-label={`Preview template ${t.name}`}");
    expect(templates).toContain("aria-label={`Delete template ${t.name}`}");
  });
});
