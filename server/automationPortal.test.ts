import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { SUPPORTED_AUTOMATION_ACTIONS } from "./automationEngine";

function makeCtx(overrides: Partial<TrpcContext> = {}): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn(), cookie: vi.fn() } as unknown as TrpcContext["res"],
    ...overrides,
  };
}

function makeAuthenticatedCtx(): TrpcContext {
  return makeCtx({
    user: {
      id: 1,
      openId: "automation-test-user",
      name: "Automation Tester",
      email: "automation@example.com",
      loginMethod: "password",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
  });
}

describe("public client-photo safeguards", () => {
  it("rejects a client photo confirmation without a booking host or portal token", async () => {
    const caller = appRouter.createCaller(makeCtx());
    await expect(caller.photos.confirmClientUpload({
      photoUrl: "https://cdn.example.com/photo.jpg",
      photoKey: "job-photos/1/estimate/public-client/photo.jpg",
    })).rejects.toThrow("booking host or portal token is required");
  });

  it("rejects a blank portal token before any data lookup", async () => {
    const caller = appRouter.createCaller(makeCtx());
    await expect(caller.portal.getPhotos({ token: "" })).rejects.toThrow();
  });
});

describe("automation action contract", () => {
  it("rejects previously unimplemented task actions at the API boundary", async () => {
    const caller = appRouter.createCaller(makeAuthenticatedCtx());
    await expect(caller.automations.create({
      name: "Unsupported task rule",
      trigger: "booking_confirmed",
      actions: [{ type: "create_task" as never, config: { title: "Do not accept" } }],
    })).rejects.toThrow();
  });

  it("publishes only executable notification, email, and follow-up action types", () => {
    expect(SUPPORTED_AUTOMATION_ACTIONS).toEqual(["send_email", "create_followup", "notify_owner"]);
  });
});
