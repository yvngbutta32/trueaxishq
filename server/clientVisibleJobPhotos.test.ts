import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("client-visible job proof photos", () => {
  it("keeps new job photo sharing default-private in the schema", () => {
    const schema = source("drizzle/schema.ts");
    const photoTable = schema.slice(schema.indexOf('export const jobPhotos = mysqlTable("jobPhotos"'), schema.indexOf("export type JobPhoto"));

    expect(photoTable).toContain('clientVisible: boolean("clientVisible").notNull().default(false)');
    expect(photoTable).toContain("jobPhotos_user_job_clientVisible_idx");
  });

  it("requires same-owner, same-job-client, non-receipt photo review before client sharing", () => {
    const router = source("server/routers.ts");
    const photoVisibility = router.slice(router.indexOf("setPhotoClientVisibility: protectedProcedure"), router.indexOf("attachPhoto: protectedProcedure"));
    const attachment = router.slice(router.indexOf("attachPhoto: protectedProcedure"), router.indexOf("  }),\n});\nexport type AppRouter"));

    expect(photoVisibility).toContain("eq(jobPhotos.id, input.photoId), eq(jobPhotos.userId, ctx.user.id)");
    expect(photoVisibility).toContain("photo.clientId !== job.clientId");
    expect(photoVisibility).toContain('photo.photoType === "receipt"');
    expect(photoVisibility).toContain("eq(jobPhotos.jobId, job.id)");
    expect(photoVisibility).toContain("eq(jobPhotos.clientId, job.clientId)");
    expect(photoVisibility).toContain("photo_visibility_changed");
    expect(attachment).toContain("photo.clientId !== job.clientId");
  });

  it("filters both token-scoped portal photo projections to reviewed non-receipt fields", () => {
    const router = source("server/routers.ts");
    const portal = source("client/src/pages/ClientPortal.tsx");
    const portalPhotos = router.slice(router.indexOf("getPhotos: publicProcedure"), router.indexOf("// Public: job progress"));
    const portalJobs = router.slice(router.indexOf("getJobs: publicProcedure"), router.indexOf("respondToApproval: publicProcedure"));

    expect(portalPhotos).toContain("eq(jobPhotos.clientVisible, true)");
    expect(portalPhotos).toContain('inArray(jobPhotos.photoType, ["estimate", "wip", "finished"])');
    expect(portalPhotos).not.toContain("photoKey: jobPhotos.photoKey");
    expect(portalJobs).toContain("eq(jobPhotos.clientVisible, true)");
    expect(portalJobs).not.toContain("photoKey: jobPhotos.photoKey");
    expect(portal).toContain("Only proof photos your provider has chosen to share appear here.");
  });

  it("provides a deliberate owner sharing control distinct from photo type", () => {
    const workspace = source("client/src/pages/JobWorkspace.tsx");

    expect(workspace).toContain("Share this proof photo in the client portal");
    expect(workspace).toContain("Shared with client");
    expect(workspace).toContain("Private to your workspace");
  });
});
