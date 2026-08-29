import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const routerPath = path.resolve(process.cwd(), "server/routers.ts");
describe("owner proof-photo client association", () => {
  it("accepts an optional client input only after final owner and active-client validation", () => {
    const router = fs.readFileSync(routerPath, "utf8");
    const confirmUpload = router.slice(router.indexOf("confirmUpload: protectedProcedure"), router.indexOf("confirmClientUpload: publicProcedure"));

    expect(confirmUpload).toContain("clientId: z.number().int().positive().optional()");
    expect(confirmUpload).toContain("eq(clients.id, input.clientId)");
    expect(confirmUpload).toContain("eq(clients.userId, ctx.user.id)");
    expect(confirmUpload).toContain('eq(clients.status, "active")');
    expect(confirmUpload).toContain("Only active clients in your workspace can be selected for an owner photo.");
    expect(confirmUpload).toContain("clientId: verifiedClientId");
  });

  it("associates an unlinked owner proof photo only through a final owner-scoped same-client job attachment", () => {
    const router = fs.readFileSync(routerPath, "utf8");
    const attachment = router.slice(router.indexOf("attachPhoto: protectedProcedure"), router.indexOf("  }),\n});\nexport type AppRouter"));

    expect(attachment).toContain("photo.jobId !== null");
    expect(attachment).toContain('photo.photoType === "receipt"');
    expect(attachment).toContain("photo.clientId !== null && photo.clientId !== job.clientId");
    expect(attachment).toContain("clientId: job.clientId");
    expect(attachment).toContain("isNull(jobPhotos.jobId)");
    expect(attachment).toContain("clientVisible: false");
  });

  it("returns only target-job-safe unlinked proof-photo candidates to the owner picker", () => {
    const router = fs.readFileSync(routerPath, "utf8");
    const candidates = router.slice(router.indexOf("listAttachableForJob: protectedProcedure"), router.indexOf("    // Update caption or line item details"));

    expect(candidates).toContain("eq(jobs.id, input.jobId)");
    expect(candidates).toContain("eq(jobs.userId, ctx.user.id)");
    expect(candidates).toContain("isNull(jobPhotos.jobId)");
    expect(candidates).toContain('ne(jobPhotos.photoType, "receipt")');
    expect(candidates).toContain("or(isNull(jobPhotos.clientId), eq(jobPhotos.clientId, job.clientId))");
    expect(candidates).not.toContain("photoKey:");
  });
});
