import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const contactSource = fs.readFileSync(path.resolve(import.meta.dirname, "../client/src/pages/Contact.tsx"), "utf8");

describe("public contact delivery boundary", () => {
  it("confirms receipt while keeping support follow-up and email delivery conditional on configured validation", () => {
    expect(contactSource).toContain("Message received. Follow-up depends on configured support delivery.");
    expect(contactSource).toContain("Response timing requires verified support delivery");
    expect(contactSource).toContain("Your message was received in TrueAxis HQ.");
    expect(contactSource).not.toContain("We'll be in touch within 4 hours.");
    expect(contactSource).not.toContain("Please email us directly at support@trueaxishq.com");
  });
});
