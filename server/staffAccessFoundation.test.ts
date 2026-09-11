import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const projectFile = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("staff identity and role-based access foundation", () => {
  const schema = projectFile("drizzle/schema.ts");
  const router = projectFile("server/routers.ts");
  const staffAccessPage = projectFile("client/src/pages/StaffAccess.tsx");
  const staffWorkspacePage = projectFile("client/src/pages/StaffWorkspace.tsx");

  it("keeps authenticated staff membership separate from the owner-managed roster", () => {
    expect(schema).toContain('export const workspaceStaffInvites = mysqlTable("workspaceStaffInvites"');
    expect(schema).toContain('export const workspaceStaffMemberships = mysqlTable("workspaceStaffMemberships"');
    expect(schema).toContain('uniqueIndex("workspaceStaffMemberships_owner_member_unique_idx")');
    expect(schema).toContain('uniqueIndex("workspaceStaffMemberships_owner_team_unique_idx")');
    expect(schema).toContain('role: mysqlEnum("role", ["field_member", "operations_manager"])');
  });

  it("binds invite creation and revocation to the owner roster and trusted application origins", () => {
    const teamStart = router.indexOf("team: router({");
    const teamEnd = router.indexOf("// ── Dispatch Planning", teamStart);
    const team = router.slice(teamStart, teamEnd);
    expect(team).toContain("createStaffInvite: protectedProcedure");
    expect(team).toContain("getTrustedPaymentReturnOrigin(input.origin)");
    expect(team).toContain("eq(teamMembers.userId, ctx.user.id)");
    expect(team).toContain("revokeStaffAccess: protectedProcedure");
    expect(team).toContain("eq(workspaceStaffMemberships.ownerUserId, ctx.user.id)");
    expect(team).toContain("It does not send email automatically.");
  });

  it("requires final unused, unrevoked, normalized-email, and active-roster predicates before staff access activates", () => {
    const start = router.indexOf("staffAccess: router({");
    const end = router.indexOf("// ── Team Operations", start);
    const staff = router.slice(start, end);
    expect(staff).toContain("register: publicProcedure");
    expect(staff).toContain("accept: staffProcedure");
    expect(staff).toContain("isNull(workspaceStaffInvites.acceptedAt)");
    expect(staff).toContain("eq(workspaceStaffInvites.revoked, false)");
    expect(staff).toContain("gt(workspaceStaffInvites.expiresAt, now)");
    expect(staff).toContain("normalizedStaffInviteEmailPredicate(email)");
    expect(staff).toContain("activeStaffInviteRosterPredicate(invite)");
    expect(staff).toContain("isStaffInviteEmailMatch(invite.email, email)");
    expect(staff).toContain("await db.transaction");
  });

  it("returns only assigned operational work to staff and excludes full owner job data", () => {
    const start = router.indexOf("staffAccess: router({");
    const end = router.indexOf("// ── Team Operations", start);
    const staff = router.slice(start, end);
    expect(staff).toContain("assignments: staffProcedure");
    expect(staff).toContain("requireActiveStaffMembership");
    expect(staff).toContain("eq(jobAssignments.teamMemberId, membership.teamMemberId)");
    expect(staff).toContain("updateAssignmentStatus: staffProcedure");
    expect(staff).toContain('actor: "staff"');
    expect(staff).not.toContain("expenses:");
    expect(staff).not.toContain("financials:");
    expect(staff).not.toContain("dispatchNote");
    expect(staff).not.toContain("clientEmail");
  });

  it("gives operations managers read-only workload visibility without widening financial access", () => {
    const start = router.indexOf("staffAccess: router({");
    const end = router.indexOf("// ── Team Operations", start);
    const staff = router.slice(start, end);
    expect(staff).toContain("teamOverview: staffProcedure");
    expect(staff).toContain('requireStaffRole(membership, "operations_manager")');
    expect(staff).not.toContain("invoicePayments");
    expect(staff).not.toContain("clientEmail");
    expect(staffWorkspacePage).toContain("teamOverview");
    expect(staffWorkspacePage).toContain("operations_manager");
  });

  it("hydrates the authenticated staff account cache before routing a successful registration to assigned work", () => {
    const registrationSuccess = staffAccessPage.slice(
      staffAccessPage.indexOf("const register = trpc.staffAccess.register.useMutation"),
      staffAccessPage.indexOf("const accept = trpc.staffAccess.accept.useMutation"),
    );
    const cacheWrite = registrationSuccess.indexOf("utils.auth.me.setData(undefined, data.user as any)");
    const navigation = registrationSuccess.indexOf('navigate("/staff")');

    expect(staffAccessPage).toContain("const utils = trpc.useUtils()");
    expect(cacheWrite).toBeGreaterThan(-1);
    expect(navigation).toBeGreaterThan(cacheWrite);
  });

  it("offers staff an explicit session-clearing recovery path back to sign-in", () => {
    expect(staffWorkspacePage).toContain("const { user, loading, logout } = useAuth()");
    expect(staffWorkspacePage).toContain("await logout()");
    expect(staffWorkspacePage).toContain('navigate("/login")');
    expect(staffWorkspacePage).toContain("Sign out");
    expect(staffWorkspacePage).toContain('type="button"');
  });
});
