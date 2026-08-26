import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("client approval requests", () => {
  it("uses an owner-scoped schema and preserves per-job, per-client query boundaries", () => {
    const schema = source("drizzle/schema.ts");
    const router = source("server/routers.ts");

    expect(schema).toContain('export const clientApprovalRequests = mysqlTable("clientApprovalRequests"');
    expect(schema).toContain('mysqlEnum("status", ["pending", "approved", "changes_requested"])');
    expect(schema).toContain('index("clientApprovalRequests_owner_status_idx").on(t.userId, t.status)');

    const portalJobs = router.slice(router.indexOf("getJobs: publicProcedure"), router.indexOf("respondToApproval: publicProcedure"));
    expect(portalJobs).toContain("eq(clientApprovalRequests.userId, portalRecord.userId)");
    expect(portalJobs).toContain("eq(clientApprovalRequests.clientId, portalRecord.clientId)");
    expect(portalJobs).toContain("inArray(clientApprovalRequests.jobId, jobIds)");
    expect(portalJobs).not.toContain("teamMemberId");
    expect(portalJobs).not.toContain("internalDispatchNote");
  });

  it("allows one token-scoped client response and records a safe owner-visible activity", () => {
    const router = source("server/routers.ts");
    const response = router.slice(router.indexOf("respondToApproval: publicProcedure"), router.indexOf("// ── Contracts & Proposals"));

    expect(response).toContain('z.enum(["approved", "changes_requested"])');
    expect(response).toContain('if (approval.status !== "pending")');
    expect(response).toContain("eq(clientApprovalRequests.status, \"pending\")");
    expect(response).toContain('eventType: "approval_responded"');
    expect(response).toContain("actor: \"client\"");
  });

  it("offers explicit owner controls and client-side approve/request-changes actions", () => {
    const portal = source("client/src/pages/ClientPortal.tsx");
    const workspace = source("client/src/pages/JobWorkspace.tsx");

    expect(portal).toContain("Deliverable review");
    expect(portal).toContain('response: "approved"');
    expect(portal).toContain('response: "changes_requested"');
    expect(portal).toContain("Internal job planning and staff details remain private.");
    expect(workspace).toContain("Client approvals");
    expect(workspace).toContain("createApprovalRequest");
    expect(workspace).toContain("deleteApprovalRequest");
  });
});
