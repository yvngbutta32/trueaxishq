import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getTrustedPaymentReturnOrigin } from "./paymentReturnOrigin";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("public invoice payment integrity", () => {
  it("permits only application, preview, or local origins for checkout returns", () => {
    expect(getTrustedPaymentReturnOrigin("https://trueaxishq.com")).toBe("https://trueaxishq.com");
    expect(getTrustedPaymentReturnOrigin("https://trueaxishq.manus.space")).toBe("https://trueaxishq.manus.space");
    expect(getTrustedPaymentReturnOrigin("https://3000-example.manus.computer")).toBe("https://3000-example.manus.computer");
    expect(getTrustedPaymentReturnOrigin("http://localhost:3000")).toBe("http://localhost:3000");
    expect(getTrustedPaymentReturnOrigin("https://attacker.example")).toBeNull();
    expect(getTrustedPaymentReturnOrigin("https://trueaxishq.com/pay/anything")).toBeNull();
    expect(getTrustedPaymentReturnOrigin("http://trueaxishq.com")).toBeNull();
  });

  it("registers a public invoice route and keeps payment returns webhook-authoritative", () => {
    const router = source("server/routers.ts");
    const app = source("client/src/App.tsx");
    const payPage = source("client/src/pages/PublicInvoicePayment.tsx");
    const portal = source("client/src/pages/ClientPortal.tsx");
    const tokenQuery = router.slice(router.indexOf("payByToken: publicProcedure"), router.indexOf("createStripePaymentForToken: publicProcedure"));

    expect(app).toContain('path="/pay/:token"');
    expect(router).toContain("getTrustedPaymentReturnOrigin(input.origin)");
    expect(router).toContain("Use the official TrueAxis HQ checkout to continue.");
    expect(router).toContain("?payment_returned=1");
    expect(tokenQuery).not.toContain("userId: invoices.userId");
    expect(tokenQuery).not.toContain("clientEmail: invoices.clientEmail");
    expect(payPage).toContain("webhook-confirmed invoice status");
    expect(payPage).not.toContain("Payment successful! Your invoice has been marked as paid.");
    expect(portal).toContain("payment_returned");
    expect(portal).not.toContain("Payment successful! Your invoice has been marked as paid.");
  });
});
