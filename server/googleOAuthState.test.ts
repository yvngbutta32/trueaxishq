import { describe, expect, it } from "vitest";
import { createGoogleOAuthState, GOOGLE_OAUTH_STATE_TTL, verifyGoogleOAuthState } from "./googleOAuthState";

describe("Google Calendar OAuth state integrity", () => {
  const secret = "test-state-secret";
  const origin = "https://trueaxishq.com";
  const now = 1_750_000_000_000;

  it("round-trips a signed owner-bound state", () => {
    const state = createGoogleOAuthState(42, origin, secret, now);
    expect(verifyGoogleOAuthState(state, secret, now + 1)).toEqual({ userId: 42, origin });
  });

  it("rejects a tampered owner identity", () => {
    const state = createGoogleOAuthState(42, origin, secret, now);
    const [payload, signature] = state.split(".");
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    const tampered = `${Buffer.from(JSON.stringify({ ...parsed, userId: 99 })).toString("base64url")}.${signature}`;
    expect(verifyGoogleOAuthState(tampered, secret, now + 1)).toBeNull();
  });

  it("rejects expired and insecure-origin state", () => {
    const state = createGoogleOAuthState(42, origin, secret, now);
    expect(verifyGoogleOAuthState(state, secret, now + GOOGLE_OAUTH_STATE_TTL + 1)).toBeNull();
    expect(() => createGoogleOAuthState(42, "http://example.com", secret, now)).toThrow("Invalid Google OAuth origin.");
  });
});
