import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { asyncRoute } from "./_core/asyncRoute";

/**
 * Express 4 never sees async rejections: an async route handler that throws
 * mid-request skips the global error middleware and the socket hangs until
 * the client gives up (Node keeps it open indefinitely). This exact defect
 * shipped once on the voice webhooks (fixed with withGracefulVoice) and the
 * Oct 23 2026 audit found every OTHER Express router still raw — ~20 public
 * endpoints could hang on a transient DB error.
 *
 * These tests pin both halves:
 *  1. functional — asyncRoute routes rejections to next(err) so the existing
 *     global error handler answers with an honest 500.
 *  2. source-pinning — every `async (req` handler in the affected router files
 *     must be wrapped. If someone adds a raw route, this fails at CI time.
 */

const WRAPPED_FILES = [
  "server/publicApi.ts",
  "server/avatarUpload.ts",
  "server/photoUpload.ts",
  "server/documentUpload.ts",
  "server/icalExport.ts",
  "server/invoicePdf.ts",
  "server/_core/index.ts",
];

describe("asyncRoute (Express async rejection guard)", () => {
  it("routes a handler rejection to next(err) so the global error handler answers", async () => {
    const boom = new Error("transient DB error");
    const next = vi.fn();
    const wrapped = asyncRoute(async () => {
      throw boom;
    });
    await wrapped({} as never, {} as never, next as never);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(boom);
  });

  it("does not call next when the handler resolves normally", async () => {
    const next = vi.fn();
    const wrapped = asyncRoute(async () => "ok");
    await wrapped({} as never, {} as never, next as never);
    expect(next).not.toHaveBeenCalled();
  });

  it("passes req/res through to the handler untouched", async () => {
    const seen: unknown[] = [];
    const fakeReq = { method: "GET" } as never;
    const fakeRes = { ended: false } as never;
    const wrapped = asyncRoute(async (req, res) => {
      seen.push(req, res);
    });
    await wrapped(fakeReq, fakeRes, (() => {}) as never);
    expect(seen[0]).toBe(fakeReq);
    expect(seen[1]).toBe(fakeRes);
  });
});

describe("asyncRoute source-pinning (no raw async Express routes)", () => {
  for (const file of WRAPPED_FILES) {
    it(`${file}: every async handler is wrapped in asyncRoute(...)`, () => {
      const src = readFileSync(file, "utf8");
      // Every route handler in these files starts with `async (req`. If it is
      // not immediately preceded by `asyncRoute(` (whitespace between is fine),
      // it is a raw handler whose rejections hang the socket.
      const offenders: number[] = [];
      src.split("\n").forEach((line, i) => {
        let idx = line.indexOf("async (req");
        while (idx !== -1) {
          const before = line.slice(0, idx).replace(/\s+$/, "");
          if (!before.endsWith("asyncRoute(")) offenders.push(i + 1);
          idx = line.indexOf("async (req", idx + 1);
        }
      });
      expect(offenders, `raw async handlers at lines ${offenders.join(", ")} — wrap them in asyncRoute()`).toEqual([]);
    });
  }

  it("the wrapped file list itself stays in sync with the router files that exist", () => {
    // Guard against the list drifting out of date.
    for (const file of WRAPPED_FILES) {
      expect(() => readFileSync(file, "utf8")).not.toThrow();
    }
  });
});
