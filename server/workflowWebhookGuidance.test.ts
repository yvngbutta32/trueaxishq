import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("workflow webhook receiver guidance", () => {
  it("documents the signed headers, raw-body HMAC preimage, idempotency, and supported event examples", () => {
    const page = readFileSync(resolve(process.cwd(), "client/src/pages/WorkflowWebhooks.tsx"), "utf8");

    expect(page).toContain("X-TrueAxis-Event-Id");
    expect(page).toContain("X-TrueAxis-Timestamp");
    expect(page).toContain("X-TrueAxis-Signature");
    expect(page).toContain('timestamp + "." + rawRequestBody');
    expect(page).toContain("idempotency key");
    expect(page).toContain("Automatic retry scheduling is not included in this release.");
    expect(page).toContain('"job.status_changed"');
    expect(page).toContain('"service_visit.scheduled"');
    expect(page).toContain('"service_visit.status_changed"');
  });
});
