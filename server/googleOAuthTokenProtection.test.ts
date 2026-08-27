import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const callbackSource = readFileSync(resolve(process.cwd(), "server/_core/index.ts"), "utf8");

describe("Google Calendar OAuth token protection", () => {
  it("encrypts freshly issued provider tokens before database persistence", () => {
    expect(callbackSource).toContain('const { encryptWebhookSecret } = await import("../workflowWebhookDelivery")');
    expect(callbackSource).toContain("const encryptedAccessToken = encryptWebhookSecret(tokenData.access_token);");
    expect(callbackSource).toContain("const encryptedRefreshToken = tokenData.refresh_token ? encryptWebhookSecret(tokenData.refresh_token) : null;");
    expect(callbackSource).not.toContain("accessToken: tokenData.access_token");
    expect(callbackSource).not.toContain("refreshToken: tokenData.refresh_token || null");
  });
});
