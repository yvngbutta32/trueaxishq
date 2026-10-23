import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * QR asset check-in labels — contract tests.
 *
 * Pins the privacy and honesty boundary end to end (mirrors subContract):
 * - The public scan page receives ONLY: business name + phone, asset
 *   name/tag/location, completed-service count, last service date. Never the
 *   asset's private notes, the client's name, or any client contact details.
 * - Tokens are 64-hex, minted lazily (only labeled assets are public), and
 *   unknown/malformed/deactivated labels are honest 404s.
 * - Service requests land in a per-owner queue (never a global table),
 *   audit-logged, with a fire-and-forget owner push that never blocks the
 *   customer.
 * - The public API is rate-limited like the sub API (30/min per IP+verb).
 */

const routers = readFileSync("server/routers.ts", "utf8");
const publicApi = readFileSync("server/publicApi.ts", "utf8");
const scanPage = readFileSync("client/src/pages/AssetScan.tsx", "utf8");
const jobWorkspace = readFileSync("client/src/pages/JobWorkspace.tsx", "utf8");
const appRoutes = readFileSync("client/src/App.tsx", "utf8");
const core = readFileSync("server/_core/index.ts", "utf8");
const schema = readFileSync("drizzle/schema.ts", "utf8");
const migration = readFileSync("drizzle/0086_asset_qr_scan.sql", "utf8");
const journal = readFileSync("drizzle/meta/_journal.json", "utf8");

const assetRouter = routers.slice(routers.indexOf("customerAssets: router({"), routers.indexOf("assetInspectionTemplates: router({"));

describe("schema & migration (0086)", () => {
  it("adds lazy scanToken + lastScanAt to assets and a per-owner request queue", () => {
    expect(migration).toContain("ADD COLUMN `scanToken` VARCHAR(64) NULL AFTER `assetTag`");
    expect(migration).toContain("ADD COLUMN `lastScanAt` TIMESTAMP NULL");
    expect(migration).toContain("UNIQUE INDEX `customerAssets_scanToken_unique_idx`");
    expect(migration).toContain("CREATE TABLE `assetServiceRequests`");
    expect(migration).toContain("`userId` int NOT NULL");
    expect(migration).toContain("`handled` boolean DEFAULT false NOT NULL");
    expect(journal).toContain('"tag": "0086_asset_qr_scan"');
    expect(schema).toContain('scanToken: varchar("scanToken", { length: 64 }).unique()');
    expect(schema).toContain("export const assetServiceRequests = mysqlTable");
  });
});

describe("public scan API (/api/asset/:token)", () => {
  it("is mounted as a public, keyless, token-gated router", () => {
    expect(core).toContain('app.use("/api/asset", assetApiRouter)');
    expect(publicApi).toContain("export const assetApiRouter = Router()");
  });

  it("validates 64-hex tokens and 404s malformed, unknown, and inactive labels", () => {
    expect(publicApi).toContain("const ASSET_TOKEN_RE = /^[0-9a-f]{64}$/");
    const loader = publicApi.slice(publicApi.indexOf("const loadAssetByToken"), publicApi.indexOf("assetApiRouter.get("));
    expect(loader).toContain("if (!ASSET_TOKEN_RE.test(rawToken)) return null");
    expect(loader).toContain("if (!asset || !asset.active) return null");
  });

  it("rate limits GET and POST separately at 30/min like the sub API", () => {
    expect(publicApi).toContain("const ASSET_RATE_LIMIT_MAX = 30");
    expect(publicApi).toContain('assetRateLimited(`get:${ip}`)');
    expect(publicApi).toContain('assetRateLimited(`post:${ip}`)');
  });

  it("projects only safe fields — never notes, client name, or client contact", () => {
    const getHandler = publicApi.slice(publicApi.indexOf("assetApiRouter.get("), publicApi.indexOf("const ASSET_REQ_PHONE_RE"));
    const safeFields = ["businessName", "businessPhone", "assetName", "assetTag", "functionalLocation", "servicesCompleted", "lastServiceAt"];
    for (const field of safeFields) expect(getHandler).toContain(field);
    // The forbidden fields must not be selected in the public GET.
    for (const forbidden of ["asset.notes", "clients.name", "clients.email", "clients.phone", "clientName", "clientEmail", "clientPhone"]) {
      expect(getHandler).not.toContain(forbidden);
    }
    expect(getHandler).not.toMatch(/\.select\(\)\.from\(clients\)/);
  });

  it("throttles the last-scan stamp (cheap analytics, no per-hit writes)", () => {
    const getHandler = publicApi.slice(publicApi.indexOf("assetApiRouter.get("), publicApi.indexOf("const ASSET_REQ_PHONE_RE"));
    expect(getHandler).toContain("lastScanAt");
    expect(getHandler).toContain("60_000");
  });

  it("records requests in the per-owner queue with audit + non-blocking push", () => {
    const postHandler = publicApi.slice(publicApi.indexOf("const ASSET_REQ_PHONE_RE"));
    expect(postHandler).toContain("db.insert(assetServiceRequests)");
    expect(postHandler).toContain("userId: asset.userId");
    expect(postHandler).toContain('action: "asset.qr.request"');
    expect(postHandler).toContain("void sendPushToUser");
    expect(postHandler).toContain("catch(() => {})");
    // No client attribution: the request row carries the asset + requester only.
    expect(postHandler).not.toContain("clients");
  });

  it("validates requester input before touching the queue", () => {
    const postHandler = publicApi.slice(publicApi.indexOf("const ASSET_REQ_PHONE_RE"));
    expect(postHandler).toContain("const ASSET_REQ_PHONE_RE = /^\\+?[0-9 \\-()]{7,20}$/");
    expect(postHandler).toContain("name.length < 2");
    expect(postHandler).toContain("message.length < 2");
    expect(postHandler).toContain("slice(0, 255)");
    expect(postHandler).toContain("slice(0, 2000)");
  });
});

describe("owner router (customerAssets)", () => {
  it("mints tokens lazily with a collision-safe retry and returns idempotently", () => {
    expect(assetRouter).toContain("ensureScanToken: protectedProcedure");
    expect(assetRouter).toContain('randomBytes(32).toString("hex")');
    expect(assetRouter).toContain("isNull(customerAssets.scanToken)");
    expect(assetRouter).toContain("if (asset.scanToken) return { token: asset.scanToken");
  });

  it("renders QR labels in one owner click (mint-on-print, no create-first step)", () => {
    expect(assetRouter).toContain("labelQr: protectedProcedure");
    expect(assetRouter).toContain("QRCode.toDataURL");
    // The mint-on-print branch must exist (self-sufficient label call).
    expect(assetRouter).toContain("if (!scanToken) {");
  });

  it("scopes the service request queue and resolution to the owner", () => {
    expect(assetRouter).toContain("serviceRequests: protectedProcedure");
    expect(assetRouter).toContain("eq(assetServiceRequests.userId, ctx.user.id)");
    expect(assetRouter).toContain("resolveServiceRequest: protectedProcedure");
    const resolve = assetRouter.slice(assetRouter.indexOf("resolveServiceRequest: protectedProcedure"));
    expect(resolve).toContain("eq(assetServiceRequests.userId, ctx.user.id)");
  });
});

describe("client surfaces", () => {
  it("routes the public scan page at /asset/:token", () => {
    expect(appRoutes).toContain('<Route path="/asset/:token" component={AssetScan} />');
    expect(appRoutes).toContain('const AssetScan = lazy(() => import("./pages/AssetScan"))');
  });

  it("scan page fetches and posts ONLY the token endpoint", () => {
    expect(scanPage).toContain("fetch(`/api/asset/${token}`");
    expect(scanPage).not.toContain("/api/sub/");
    expect(scanPage).not.toContain("/api/trpc");
    // Honest 404 state, never a guessed state.
    expect(scanPage).toContain('res.status === 404) { setError("not_found")');
    expect(scanPage).toContain("This asset label is no longer active");
  });

  it("scan page declares the privacy boundary it receives", () => {
    expect(scanPage).toContain("Never the asset's"); // privacy comment in page docblock
  });

  it("JobWorkspace prints labels and shows the owner request queue", () => {
    expect(jobWorkspace).toContain("printAssetLabel = trpc.customerAssets.labelQr.useMutation");
    expect(jobWorkspace).toContain("QR label");
    expect(jobWorkspace).toContain("serviceRequests = trpc.customerAssets.serviceRequests.useQuery");
    expect(jobWorkspace).toContain("Mark handled");
    expect(jobWorkspace).toContain("QR service requests");
    // Deactivated assets must not be printable (their tokens 404 publicly).
    expect(jobWorkspace).toContain("disabled={printAssetLabel.isPending || !asset.active}");
  });
});
