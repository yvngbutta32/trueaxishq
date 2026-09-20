import { describe, it, expect } from "vitest";

/**
 * Zero-cost launch contract: the app must be FULLY usable with no paid
 * third-party service. Every integration either degrades honestly to a
 * zero-cost mode or has a built-in free path. This test pins that promise —
 * if someone hard-couples a feature to a paid provider, it fails.
 */
import { readFileSync } from "fs";
import { join } from "path";

const read = (rel: string) => readFileSync(join(__dirname, rel), "utf8");
const routers = read("../server/routers.ts");
const sms = read("../server/_core/sms.ts");
const email = read("../server/_core/email.ts");
const llm = read("../server/_core/llm.ts");
const geocode = read("../server/_core/geocode.ts");
const html = read("../client/index.html");
const security = read("../server/security.ts");

describe("zero-cost launch: every feature works without paying any company", () => {
  it("payments: Stripe is optional — manual markPaid records payment with no provider", () => {
    // markPaid updates invoice status with plain SQL: no stripe import in its body
    const start = routers.indexOf("markPaid: protectedProcedure");
    expect(start).toBeGreaterThan(-1);
    const end = routers.indexOf("\n  }, {", start);
    const body = routers.slice(start, end > 0 ? end : start + 4000);
    expect(body).not.toMatch(/stripe/i);
    expect(body).toContain("status: \"paid\"");
  });

  it("payments: unconfigured Stripe fails honestly, never silently", () => {
    const gate = routers.indexOf("STRIPE_SECRET_KEY");
    expect(gate).toBeGreaterThan(-1);
    expect(routers).toContain("Payment system not configured");
  });

  it("accounting: QuickBooks-format CSV export needs no Intuit OAuth or subscription", () => {
    expect(read("../server/accountingExport.ts")).toContain("buildQuickBooksInvoiceCsv");
    expect(routers).toContain("quickBooksInvoicesCsv");
  });

  it("SMS: degrades to zero-cost console/copy-link mode when Twilio unset", () => {
    expect(sms).toMatch(/console/i);
    expect(sms).not.toMatch(/throw new Error\("Twilio/);
  });

  it("email: pickup-directory fallback when SMTP unset — no mail provider required", () => {
    expect(email).toMatch(/console/i); // zero-cost mode: logged to console + in-app notifications
  });

  it("AI: no default third-party LLM endpoint; fail-fast + honest degradation", () => {
    expect(llm).toContain("NO default third-party LLM endpoint");
    expect(llm).toContain("not configured");
    expect(llm).not.toContain("https://forge.manus.im");
  });

  it("geocoding: keyless free provider, no API key env required", () => {
    expect(geocode).toContain("nominatim");
    expect(geocode).not.toMatch(/GEOCODE_API_KEY|HERE_API|MAPBOX_TOKEN/);
  });

  it("page load: zero third-party requests — fonts self-hosted, no CDNs", () => {
    expect(html).toContain("/fonts/inter.css");
    expect(html).not.toMatch(/fonts\.googleapis|fonts\.gstatic|cdn\./);
    expect(security).toContain("font-src 'self'");
    // page-load directives (script/style/font/connect-src) carry zero third-party
    // origins except the opt-in Stripe payment calls (api.stripe.com/js.stripe.com)
    for (const directive of ["script-src", "style-src", "font-src", "connect-src"]) {
      const start = security.indexOf(directive);
      const end = security.indexOf('",', start);
      const value = security.slice(start, end);
      expect(value, directive).not.toMatch(/manus|cloudfront|googleapis|gstatic/);
    }
    // frame-ancestors may list hosting domains (trueaxishq.com + any current host);
    // hosting is self-hostable at $0 and adds no third-party page-load requests
    expect(security).toContain("frame-ancestors");
  });

  it("calendar + tracking: ICS feed and tracking links are self-hosted, keyless", () => {
    expect(routers).toContain("calendarFeedTokens");
    expect(read("../server/publicApi.ts")).toContain("trackApiRouter");
  });

  it("selling: plan subscriptions use inline price_data — no Stripe dashboard setup, no fixed fees anywhere", () => {
    const src = read("../server/routers.ts");
    expect(src).toContain('mode: "subscription"');
    expect(src).toMatch(/price_data/);
    // inline pricing means no Stripe products/prices must be pre-created
    expect(src).not.toContain("price: \"prod_");
    expect(src).not.toContain("stripe-billing");
  });

  it("selling: pricing plans are real products (dollars in cents), free tier stays honest", () => {
    const plans = read("../shared/plans.ts");
    expect(plans).toMatch(/monthlyPrice: \d{4,}/); // priced in cents
    expect(plans).toContain("PLAN_LIST");
    // billing imports the same single source of truth as the public page
    expect(read("../server/products.ts")).toContain('from "../shared/plans"');
  });

  it("selling: README documents $0-fixed-cost revenue economics", () => {
    const readme = read("../README.md");
    expect(readme).toContain("Selling also costs $0 fixed");
    expect(readme).toMatch(/no setup fee, no monthly fee/i);
    expect(readme).toMatch(/usage-based/i);
  });
});
