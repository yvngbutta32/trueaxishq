import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/pages/DispatchBoard.tsx"), "utf8");

describe("Dispatch Board capacity preflight", () => {
  it("loads the owner-scoped capacity view and matches it to the selected job assignment", () => {
    expect(source).toContain("trpc.team.capacity.useQuery()");
    expect(source).toContain("capacity.find(member => member.id === selectedAssignment.teamMemberId)");
  });

  it("makes capacity pressure visible before a visit is created without exposing it to clients", () => {
    expect(source).toContain("planned capacity:");
    expect(source).toContain("This owner is already over planned capacity");
    expect(source).toContain("private planning signal");
    expect(source).toContain("not GPS, availability, payroll, or a client-visible promise");
  });

  it("retains the explicit manual dispatch boundary", () => {
    expect(source).toContain("No GPS, routing, or automated ETA claims");
    expect(source).toContain("Allow an intentional overlap");
  });
});
