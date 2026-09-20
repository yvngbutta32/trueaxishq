import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Zero-install subcontractor workflow — contract tests.
 *
 * Pins the privacy and honesty boundary end to end:
 * - The public sub page receives ONLY: job number/title/status, schedule, the
 *   owner-written scope note, and the client contact only when explicitly
 *   allowed. No budget, no client email, no internal notes, no other subs.
 * - Token links are 64-hex, expire in 14 days, and revoked/expired/declined
 *   links are honest 404s (never guessed states).
 * - SMS is honest: delivered only when Twilio accepts; the copyable link is
 *   always returned so the workflow works with zero credentials.
 * - Owner actions (invite, resend, revoke) are audit-logged.
 */

const routers = readFileSync("server/routers.ts", "utf8");
const publicApi = readFileSync("server/publicApi.ts", "utf8");
const subPage = readFileSync("client/src/pages/SubJobPage.tsx", "utf8");
const panel = readFileSync("client/src/pages/dashboard/SubcontractorsPanel.tsx", "utf8");
const appRoutes = readFileSync("client/src/App.tsx", "utf8");
const core = readFileSync("server/_core/index.ts", "utf8");
const schema = readFileSync("drizzle/schema.ts", "utf8");
const migration = readFileSync("drizzle/0074_loving_callisto.sql", "utf8");

const subRouter = routers.slice(routers.indexOf("subcontractors: router({"), routers.indexOf("tracking: router({"));

describe("schema & migration (0074)", () => {
  it("creates the three tables with a token boundary and expiry", () => {
    for (const table of ["subcontractors", "jobSubcontractors", "jobSubcontractorNotes"]) {
      expect(migration).toContain(`CREATE TABLE \`${table}\``);
    }
    expect(migration).toContain("`token` varchar(96) NOT NULL");
    expect(migration).toContain("`expiresAt` timestamp NOT NULL");
    expect(migration).toContain("`shareClientContact` boolean NOT NULL DEFAULT false");
    expect(migration).toContain("UNIQUE(`token`)");
    expect(schema).toContain("mysqlEnum(\"status\", [\"invited\", \"accepted\", \"declined\", \"completed\"])");
  });
});

describe("public sub API (/api/sub/:token)", () => {
  it("is mounted as a public, keyless, token-gated router", () => {
    expect(core).toContain('app.use("/api/sub", subApiRouter)');
    expect(publicApi).toContain("export const subApiRouter = Router()");
    expect(publicApi).toContain("SUB_TOKEN_RE = /^[0-9a-f]{64}$/");
  });

  it("fails closed on revoked, expired, or malformed links — honest 404s", () => {
    const loaded = publicApi.slice(publicApi.indexOf("const loadSubAssignment"), publicApi.indexOf("subApiRouter.get("));
    expect(loaded).toContain("!assignment.active || assignment.revokedAt || assignment.expiresAt.getTime() <= Date.now()");
    expect(loaded).toContain("SUB_TOKEN_RE.test(rawToken)");
  });

  it("exposes only the owner-approved projection — no budget, client email, or internal notes", () => {
    const getHandler = publicApi.slice(publicApi.indexOf('subApiRouter.get("/:token"'), publicApi.indexOf('subApiRouter.post("/:token"'));
    for (const allowed of ["businessName", "jobNumber", "jobTitle", "jobStatus", "schedule", "scopeNote", "clientContact"]) {
      expect(getHandler).toContain(allowed);
    }
    // Pin the actual JSON response keys: nothing beyond the approved projection is sent.
    const responseKeys = getHandler.slice(getHandler.indexOf("res.json({"), getHandler.indexOf("});", getHandler.indexOf("res.json({")));
    for (const banned of ["budgetAmount", "clientSummary", "description", "email", "subId", "userId", "notes"]) {
      expect(responseKeys).not.toContain(banned);
    }
  });

  it("shares the client contact only when the owner explicitly allowed it", () => {
    const getHandler = publicApi.slice(publicApi.indexOf('subApiRouter.get("/:token"'), publicApi.indexOf('subApiRouter.post("/:token"'));
    expect(getHandler).toContain("if (assignment.shareClientContact)");
    expect(getHandler).toContain("clients.phone");
    expect(getHandler).not.toContain("clients.email");
  });

  it("state-machines every action: only invited→accept/decline, accepted→complete/note", () => {
    const postHandler = publicApi.slice(publicApi.indexOf('subApiRouter.post("/:token"'));
    expect(postHandler).toContain('action === "accept" && assignment.status === "invited"');
    expect(postHandler).toContain('action === "decline" && assignment.status === "invited"');
    expect(postHandler).toContain('action === "complete" && assignment.status === "accepted"');
    expect(postHandler).toContain('action === "note" && (assignment.status === "accepted" || assignment.status === "invited")');
    expect(postHandler).not.toContain('action === "complete" && assignment.status === "invited"');
  });

  it("rate-limits public posts and caps note length server-side", () => {
    const postHandler = publicApi.slice(publicApi.indexOf('subApiRouter.post("/:token"'));
    expect(postHandler).toContain("subRateLimited(");
    expect(postHandler).toContain("slice(0, 1000)");
    expect(postHandler).toContain("429");
  });

  it("records every sub response on the job timeline and as a note", () => {
    const postHandler = publicApi.slice(publicApi.indexOf('subApiRouter.post("/:token"'));
    for (const evt of ["subcontractor_accepted", "subcontractor_declined", "subcontractor_completed"]) {
      expect(postHandler).toContain(evt);
      expect(postHandler).toContain("insert(jobActivities)");
      expect(postHandler).toContain("insert(jobSubcontractorNotes)");
    }
  });
});

describe("owner router (subcontractors.*)", () => {
  it("scopes every query and mutation to the owner", () => {
    expect((subRouter.match(/eq\(subcontractors\.userId, ctx\.user\.id\)/g) ?? []).length).toBeGreaterThanOrEqual(4);
    expect((subRouter.match(/eq\(jobSubcontractors\.userId, ctx\.user\.id\)/g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect(subRouter).toContain("eq(jobs.id, input.jobId), eq(jobs.userId, ctx.user.id)");
  });

  it("invites with fresh 64-hex tokens, 14-day expiry, one live invite per sub per job", () => {
    expect(subRouter).toContain("randomBytes(32).toString(\"hex\")");
    expect(subRouter).toContain("14 * 24 * 60 * 60 * 1000");
    expect(subRouter).toContain("One live invitation per sub per job");
  });

  it("attempts SMS honestly and always returns the copyable link (works with zero credentials)", () => {
    expect(subRouter).toContain("getSmsDeliveryStatus().configured");
    expect(subRouter).toContain("wasSmsAcceptedByConfiguredTwilio(smsResult)");
    expect(subRouter).toContain("return { assignmentId: assignment.insertId, inviteUrl, smsDelivered, expiresAt }");
  });

  it("audit-logs every invite, resend, and revoke", () => {
    for (const action of ["subcontractor.invited", "subcontractor.invite_resent", "subcontractor.invite_revoked"]) {
      expect(subRouter).toContain(`"${action}"`);
    }
  });

  it("normalizes sub phones to E.164 on create and update", () => {
    expect(subRouter).toContain("normalizePhoneToE164(input.phone)");
  });

  it("keeps history intact when deleting a sub with assignments (soft delete)", () => {
    expect(subRouter).toContain("softDeleted");
    expect(subRouter).toContain("set({ active: false })");
  });
});

describe("sub job page (/sub/:token)", () => {
  it("is routed as a public token-gated page with no auth dependency", () => {
    expect(appRoutes).toContain('path="/sub/:token"');
    expect(subPage).toContain("/api/sub/${token}");
    expect(subPage).not.toContain("trpc");
  });

  it("renders honest terminal states — declined, completed, expired — never a guess", () => {
    expect(subPage).toContain("You declined this job");
    expect(subPage).toContain("Work reported complete");
    expect(subPage).toContain("This job link is no longer active");
  });

  it("shows the client contact only when the server sends it — no client fields exist in the page's own state", () => {
    expect(subPage).toContain("clientContact");
    for (const banned of ["clientEmail", "budgetAmount", "internalNote", "otherSub"]) {
      expect(subPage).not.toContain(banned);
    }
  });

  it("offers accept/decline only while invited and complete/note only after accepting", () => {
    expect(subPage).toContain('data.status === "invited"');
    expect(subPage).toContain('data.status === "accepted"');
    expect(subPage).toContain('act("complete"');
    expect(subPage).toContain('act("note"');
  });
});

describe("owner panel", () => {
  it("uses only the owner-scoped tRPC router", () => {
    for (const proc of ["trpc.subcontractors.list", "trpc.subcontractors.create", "trpc.subcontractors.update", "trpc.subcontractors.delete", "trpc.subcontractors.inviteToJob", "trpc.subcontractors.listInvitations", "trpc.subcontractors.resend", "trpc.subcontractors.revoke"]) {
      expect(panel).toContain(proc);
    }
    expect(panel).not.toContain("fetch(");
  });

  it("surfaces the copy-link path honestly when Twilio isn't configured", () => {
    expect(panel).toContain("Twilio isn't configured yet");
    expect(panel).toContain("Copy link");
    expect(panel).toContain("smsDelivered");
  });

  it("asks for explicit consent before sharing the client contact", () => {
    expect(panel).toContain("Share the client's name and phone with this sub");
    expect(panel).toContain("shareClientContact");
  });
});
