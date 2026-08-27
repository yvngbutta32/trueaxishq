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
    expect(source).toContain("assignment plan:");
    expect(source).toContain("Scheduled this UTC week:");
    expect(source).toContain("Review the load and confirm any exception intentionally.");
    expect(source).toContain("private owner-planning signals");
    expect(source).toContain("not GPS, staff availability, attendance, payroll, or client-visible promises");
  });

  it("retains the explicit manual dispatch boundary", () => {
    expect(source).toContain("No GPS, routing, or automated ETA claims");
    expect(source).toContain("Allow an intentional overlap");
  });
});
