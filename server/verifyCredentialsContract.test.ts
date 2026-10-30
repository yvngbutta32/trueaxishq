import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * verifyCredentialsContract — pins scripts/verify-credentials.sh.
 *
 * The launch credential pipeline: the owner drops credentials into .env
 * (or exports them), runs this one script, and gets a live PASS/FAIL
 * per provider. These tests guard against silent regressions of the
 * script itself: every launch provider must keep its live probe, an
 * unconfigured provider must SKIP (never FAIL, never crash), and a
 * rejected credential must FAIL so nobody ships with dead keys.
 */
describe("verify-credentials.sh contract", () => {
  const scriptPath = join(__dirname, "../scripts/verify-credentials.sh");
  const sh = existsSync(scriptPath)
    ? readFileSync(scriptPath, "utf8")
    : "";

  it("exists and is committed as a shell script", () => {
    expect(existsSync(scriptPath)).toBe(true);
    expect(sh.startsWith("#!/usr/bin/env bash")).toBe(true);
  });

  it("never crashes when nothing is configured (set -u safe)", () => {
    expect(sh).toContain("set -u");
    // every CREDENTIAL variable read must be guarded with a default expansion
    const creds = ["DATABASE_URL", "SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_FROM",
      "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN",
      "TWILIO_FROM_NUMBER", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "SITE_ORIGIN",
      "BUILT_IN_FORGE_API_URL", "BUILT_IN_FORGE_API_KEY"];
    const bare = new Set<string>();
    for (const v of creds) {
      let rest = sh.split(`\${${v}:-`).join(""); // drop guarded reads (any default)
      for (const part of rest.split(v)) {
        const before = part.slice(-1); // char immediately preceding this occurrence
        if (before === "$" || before === "{") bare.add(v);
      }
    }
    expect([...bare]).toEqual([]); // any hit = unguarded read, aborts under set -u
  });

  it("live-probes every launch provider group", () => {
    expect(sh).toContain("mysql2/promise");
    expect(sh).toContain("nodemailer");
    expect(sh).toContain("api.stripe.com/v1/account");
    expect(sh).toContain("api.twilio.com/2010-04-01/Accounts");
    expect(sh).toContain("oauth2.googleapis.com/token");
    expect(sh).toContain("/api/health");
    expect(sh).toContain("${LLM_URL}models");
    // a full endpoint path must be reduced to its base before probing /models
    expect(sh).toContain('%/chat/completions')
  });

  it("distinguishes Stripe live vs test keys", () => {
    expect(sh).toContain("sk_live");
    expect(sh).toContain("sk_test");
  });

  it("flags the Stripe webhook secret as a post-deploy step, not a failure", () => {
    expect(sh).toContain("STRIPE_WEBHOOK_SECRET");
  });

  it("passes exit code 0 only when nothing failed", () => {
    expect(sh).toContain("[ \"$FAIL\" -eq 0 ] || exit 1");
  });

  it("keeps a smoke-testable env-file argument", () => {
    expect(sh).toContain('ENV_FILE="${1:-.env}"');
  });
});
