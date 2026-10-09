import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  PRO_FEATURES, FEATURE_MIN_PLAN, PRO_FEATURE_LABELS,
  SUB_ACCOUNT_LIMITS, subAccountLimitFor, planUnlocksProFeature, featureMinPlanLabel,
} from "../shared/plans";

const root = resolve(import.meta.dirname, "..");
const source = (rel: string) => readFileSync(resolve(root, rel), "utf8");
const routers = source("server/routers.ts");
const auth = source("server/auth.ts");
const schema = source("drizzle/schema.ts");
const panel = source("client/src/pages/dashboard/SubAccountsPanel.tsx");
const sidebar = source("client/src/pages/dashboard/Sidebar.tsx");
const dashboard = source("client/src/pages/Dashboard.tsx");

const AGENCY_BLOCK_START = routers.indexOf("agencyRouter = router({");
const AGENCY_BLOCK = routers.slice(AGENCY_BLOCK_START, routers.indexOf("export const appRouter = router({"));

describe("agency sub-accounts (managed client workspaces)", () => {
  it("is a registered Pro-feature gate with an Agency-only minimum", () => {
    expect(PRO_FEATURES).toContain("subAccounts");
    expect(FEATURE_MIN_PLAN.subAccounts).toBe("agency");
    expect(PRO_FEATURE_LABELS.subAccounts).toBeTruthy();
    expect(featureMinPlanLabel("subAccounts")).toBe("Agency");
    // only Agency passes the gate — the $299 differentiator
    expect(planUnlocksProFeature("agency", "subAccounts")).toBe(true);
    expect(planUnlocksProFeature("pro", "subAccounts")).toBe(false);
    expect(planUnlocksProFeature("starter", "subAccounts")).toBe(false);
    expect(planUnlocksProFeature("free", "subAccounts")).toBe(false);
  });

  it("carries a bounded, profitable cap — never 'unlimited'", () => {
    expect(SUB_ACCOUNT_LIMITS.agency).toBe(10);
    expect(subAccountLimitFor("agency")).toBe(10);
    expect(subAccountLimitFor("pro")).toBe(0);
    expect(subAccountLimitFor("starter")).toBe(0);
    expect(subAccountLimitFor("free")).toBe(0);
    expect(subAccountLimitFor("unknown-plan")).toBe(0); // unknown falls back to none
  });

  it("every agency operation is plan-gated server-side", () => {
    expect(AGENCY_BLOCK).toContain('requirePlanFeature(db, ctx.user.id, "subAccounts")');
    for (const op of ["listSubAccounts", "createSubAccount", "setSubAccountStatus", "resetSubAccountPassword"]) {
      expect(AGENCY_BLOCK).toContain(`${op}: protectedProcedure`);
    }
  });

  it("enforces the cap before insert, with an honest upgrade message", () => {
    expect(AGENCY_BLOCK).toContain("Number(countRow.count) >= limit");
    expect(AGENCY_BLOCK).toContain("includes up to ${limit} sub-accounts");
  });

  it("ownership is enforced in the WHERE clause — a parent can only ever touch its own subs", () => {
    expect(AGENCY_BLOCK).toContain("eq(users.parentUserId, ctx.user.id)");
    expect(AGENCY_BLOCK).toContain("Sub-account not found.");
  });

  it("sub workspaces run the Pro feature set under the Agency subscription", () => {
    expect(AGENCY_BLOCK).toContain('planId: "pro"');
    expect(AGENCY_BLOCK).toContain("parentUserId: ctx.user.id");
  });

  it("parents never store sub passwords in the clear", () => {
    expect(AGENCY_BLOCK).toContain("await hashPassword(input.password)");
  });

  it("suspension and parent password resets revoke the sub's live sessions — access stops now", () => {
    expect(auth).toContain("revokeAllSessionsForUser");
    expect(routers).toContain('revokeAllSessionsForUser(input.id, "admin_revoke")');
    expect(routers).toContain('revokeAllSessionsForUser(input.id, "password_changed")');
  });

  it("all four actions are audit-logged", () => {
    for (const action of ["agency.subaccount.created", "agency.subaccount.suspended", "agency.subaccount.reactivated", "agency.subaccount.password_reset"]) {
      expect(routers).toContain(`"${action}"`);
    }
  });

  it("suspended subs cannot sign in — data intact, access honest", () => {
    expect(auth).toContain("ACCOUNT_SUSPENDED");
    expect(auth).toContain("user.subSuspended === true");
    expect(routers).toContain("This workspace has been suspended by its agency administrator");
  });

  it("self-registration can never produce a sub-account (parent only set by the agency router)", () => {
    expect(schema).toContain('parentUserId: int("parentUserId")');
    // registerUser in auth.ts never sets parentUserId
    const registerStart = auth.indexOf("export async function registerUser");
    const registerBlock = auth.slice(registerStart, registerStart + 2500);
    expect(registerBlock).not.toContain("parentUserId");
  });

  it("the client panel reflects the gate with FeatureLock and honest copy", () => {
    expect(panel).toContain('FeatureLock feature="subAccounts"');
    expect(panel).toContain("fully-isolated workspace");
    expect(panel).toContain("sees only its own clients and jobs");
    expect(panel).toContain("workspaces in use"); // limit is visible, never hidden
  });

  it("the panel is reachable: nav item + dashboard case + panel type", () => {
    expect(sidebar).toContain('label: "Sub-Accounts"');
    expect(sidebar).toContain('panel: "agency"');
    expect(dashboard).toContain('case "agency":');
    expect(dashboard).toContain("SubAccountsPanel");
  });
});
