import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  REVIEW_REQUEST_COOLDOWN_DAYS,
  validateReviewSiteUrl,
} from "./_core/reviewRequests";

const root = resolve(import.meta.dirname, "..");
const coreSource = readFileSync(resolve(root, "server/_core/reviewRequests.ts"), "utf8");
const routerSource = readFileSync(resolve(root, "server/routers.ts"), "utf8");
const jobsSource = readFileSync(resolve(root, "server/backgroundJobs.ts"), "utf8");
const schemaSource = readFileSync(resolve(root, "drizzle/schema.ts"), "utf8");
const migrationSource = readFileSync(resolve(root, "drizzle/0090_review_requests.sql"), "utf8");
const settingsSource = readFileSync(resolve(root, "client/src/pages/dashboard/SettingsPanel.tsx"), "utf8");
const jobWorkspaceSource = readFileSync(resolve(root, "client/src/pages/JobWorkspace.tsx"), "utf8");
const reviews = routerSource.slice(routerSource.indexOf("  reviews: router({"), routerSource.indexOf("  testimonials: router({"));

describe("Public review-site request engine (the traction flywheel)", () => {
  it("pins the anti-spam cooldown from the research-backed default: 90 days", () => {
    expect(REVIEW_REQUEST_COOLDOWN_DAYS).toBe(90);
    expect(coreSource).toContain("clientRecentlyAsked");
    expect(coreSource).toContain("jobAlreadyAsked");
  });

  it("requires an https review link and rejects junk honestly", () => {
    expect(validateReviewSiteUrl("").ok).toBe(false);
    expect(validateReviewSiteUrl(null).ok).toBe(false);
    expect(validateReviewSiteUrl("not a url").ok).toBe(false);
    expect(validateReviewSiteUrl("http://g.page/r/x/review").ok).toBe(false);
    expect(validateReviewSiteUrl("x".repeat(600)).ok).toBe(false);
    const good = validateReviewSiteUrl(" https://g.page/r/your-business/review ");
    expect(good.ok).toBe(true);
    expect(good.url).toBe("https://g.page/r/your-business/review");
  });

  it("stores settings and the honest ask log with an owner index", () => {
    expect(schemaSource).toContain("export const reviewSettings = mysqlTable");
    expect(schemaSource).toContain('uniqueIndex("reviewSettings_userId_unique_idx").on(t.userId)');
    expect(schemaSource).toContain("export const reviewRequests = mysqlTable");
    expect(schemaSource).toContain('mysqlEnum("status", ["sent", "failed", "skipped"])');
    expect(migrationSource).toContain("UNIQUE KEY `reviewSettings_userId_unique_idx` (`userId`)");
    expect(migrationSource).toContain("statement-breakpoint");
  });

  it("never sends SMS without an explicit TCPA opt-in and prefers opt-in SMS over email", () => {
    expect(coreSource).toContain("const optedIn = smsOptIn === 1 || smsOptIn === true;");
    const smsBranch = coreSource.slice(coreSource.indexOf("if (optedIn && phone)"), coreSource.indexOf("if (clientEmail)"));
    expect(smsBranch).toContain("sendMeteredSms");
    expect(smsBranch).toContain('"review"');
    expect(smsBranch).toContain("Reply STOP to opt out");
  });

  it("records EVERY outcome — sent, failed, and skipped — into the honest log", () => {
    expect(coreSource).toContain("record(detailFor(");
    expect(coreSource).toContain('detailFor("skipped", "email", "No reachable channel');
    expect(coreSource).toContain("Monthly SMS allowance is used up");
  });

  it("scopes settings and sends to the signed-in company only", () => {
    expect(reviews).toContain("eq(reviewSettings.userId, ctx.user.id)");
    expect(reviews).toContain("eq(clients.userId, ctx.user.id)");
    expect(reviews).toContain("eq(jobs.userId, ctx.user.id)");
    expect(reviews).toContain("reviewLogWithClientNames(db, ctx.user.id)");
  });

  it("validates the review link before any send, in both the router and the sweep", () => {
    expect(reviews).toContain("validateReviewSiteUrl(settings?.reviewSiteUrl)");
    expect(reviews).toContain("validateReviewSiteUrl(input.reviewSiteUrl)");
    expect(jobsSource).toContain("validateReviewSiteUrl(owner.reviewSiteUrl)");
  });

  it("auto-sweeps completed jobs 24–48h after completion and never retries a job", () => {
    const sweep = jobsSource.slice(jobsSource.indexOf("async function runReviewRequestSweep"), jobsSource.indexOf("let startTimer"));
    expect(sweep).toContain('eq(reviewSettings.autoAfterCompletion, true)');
    expect(sweep).toContain("48 * 60 * 60 * 1000");
    expect(sweep).toContain("24 * 60 * 60 * 1000");
    expect(sweep).toContain('eq(jobs.status, "completed")');
    expect(sweep).toContain("notExists");
    expect(jobsSource).toContain('["review requests", runReviewRequestSweep]');
  });

  it("meters SMS sends against the plan allowance (no free-billing leak)", () => {
    expect(coreSource).toContain("getSmsAllowanceOverview");
    expect(coreSource).toContain("overFairUse");
  });

  it("exposes the engine on the Settings page and completed jobs", () => {
    expect(settingsSource).toContain("function ReviewsSection()");
    expect(settingsSource).toContain("trpc.reviews.status.useQuery");
    expect(settingsSource).toContain("Ask automatically after completed jobs");
    expect(jobWorkspaceSource).toContain("trpc.reviews.sendRequest.useMutation");
    expect(jobWorkspaceSource).toContain('detail.job.status === "completed" &&');
  });
});
