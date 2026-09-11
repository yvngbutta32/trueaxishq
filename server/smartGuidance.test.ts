import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("smart guidance preference", () => {
  it("persists the preference and gates the onboarding guidance surface", () => {
    const schema = readFileSync(resolve(process.cwd(), "drizzle/schema.ts"), "utf8");
    const router = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
    const checklist = readFileSync(resolve(process.cwd(), "client/src/components/OnboardingChecklist.tsx"), "utf8");
    expect(schema).toContain('smartGuidanceEnabled: boolean("smartGuidanceEnabled").default(true)');
    expect(router).toContain("smartGuidanceEnabled: z.boolean().optional()");
    expect(checklist).toContain("settings?.smartGuidanceEnabled === false");
  });
});
