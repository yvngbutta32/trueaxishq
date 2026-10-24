import { describe, expect, it, vi, afterEach } from "vitest";
import { trpcErrorMessage } from "./_core/trpc";

describe("trpcErrorMessage (error formatter logic)", () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it("flattens the first zod issue into a human-readable message", () => {
    const out = trpcErrorMessage("Validation failed", "BAD_REQUEST", "clients.create",
      [{ path: ["defaultRate"], message: "Enter a valid rate like 85 or 85.50" }]);
    expect(out).toBe("defaultRate: Enter a valid rate like 85 or 85.50");
  });

  it("shows the issue message alone when no path is present", () => {
    expect(trpcErrorMessage("Validation failed", "BAD_REQUEST", undefined, [{ message: "Required" }])).toBe("Required");
  });

  it("masks 500 internals in production and logs the real cause", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const out = trpcErrorMessage("Failed query: insert into clients ... params: 170", "INTERNAL_SERVER_ERROR", "clients.create", undefined, true);
    expect(out).toBe("Something went wrong on our end. Please try again.");
    expect(err).toHaveBeenCalled();
  });

  it("keeps 500 details outside production for dev DX", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const detail = "Failed query: insert into clients ...";
    expect(trpcErrorMessage(detail, "INTERNAL_SERVER_ERROR", "clients.create", undefined, false)).toBe(detail);
    expect(err).toHaveBeenCalled();
  });

  it("passes through normal operational errors untouched", () => {
    expect(trpcErrorMessage("Client not found", "NOT_FOUND", "clients.get", undefined)).toBe("Client not found");
  });
});
