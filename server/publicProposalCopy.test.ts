import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const publicProposalSource = readFileSync(resolve(import.meta.dirname, "../client/src/pages/ProposalSign.tsx"), "utf8");
const termsSource = readFileSync(resolve(import.meta.dirname, "../client/src/pages/Terms.tsx"), "utf8");

describe("factual public proposal signing copy", () => {
  it("describes a recorded product action without making a universal legal-enforceability claim", () => {
    expect(publicProposalSource).toContain("record acceptance of this proposal");
    expect(publicProposalSource).toContain("record my acceptance in TrueAxis HQ");
    expect(publicProposalSource).toContain("Acceptance is recorded in TrueAxis HQ");
    expect(publicProposalSource).not.toContain("legally binding");
    expect(publicProposalSource).not.toContain("full legal name");
  });

  it("keeps the public Terms introduction factual rather than asserting universal enforceability", () => {
    expect(termsSource).toContain("platform policies intended to govern access and use");
    expect(termsSource).toContain("qualified legal review");
    expect(termsSource).not.toContain("constitute a legally binding agreement");
  });
});
