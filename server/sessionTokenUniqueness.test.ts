import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { createSessionToken, hashSessionToken, verifySessionToken } from "./auth";

// Oct 8 2026 regression: tokens issued in the same second used to be byte-identical
// (payload had no unique claim; exp is second-precision), so a second login within
// the same second hit the userSessions UNIQUE(tokenHash) with ER_DUP_ENTRY and an
// opaque 500. jti (RFC 7519) makes every token unique regardless of issue time.
describe("session token uniqueness (jti regression)", () => {
  it("two tokens issued in the same millisecond are different", async () => {
    const a = await createSessionToken(1, "same-second@example.com");
    const b = await createSessionToken(1, "same-second@example.com");
    expect(a).not.toBe(b);
    expect(hashSessionToken(a)).not.toBe(hashSessionToken(b));
  });

  it("burst of 20 concurrent same-second tokens all hash uniquely", async () => {
    const tokens = await Promise.all(
      Array.from({ length: 20 }, () => createSessionToken(7, "burst@example.com"))
    );
    const hashes = new Set(tokens.map((t) => hashSessionToken(t)));
    expect(hashes.size).toBe(20);
  });

  it("tokens still verify via the app verifier and carry the user + jti", async () => {
    const token = await createSessionToken(42, "verify@example.com");
    const payload = await verifySessionToken(token);
    expect(payload?.userId).toBe(42);
    expect(payload?.email).toBe("verify@example.com");
    const claims = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
    expect(typeof claims.jti).toBe("string");
    expect(claims.jti.length).toBeGreaterThanOrEqual(32);
    expect(createHash("sha256").update(token).digest("hex")).toBe(hashSessionToken(token));
  });
});
