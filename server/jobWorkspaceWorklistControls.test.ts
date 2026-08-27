import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");
const workspace = fs.readFileSync(path.join(root, "client/src/pages/JobWorkspace.tsx"), "utf8");
const router = fs.readFileSync(path.join(root, "server/routers.ts"), "utf8");

describe("Job Workspace private worklist controls", () => {
  it("filters the already-authorized local worklist by existing status and minimally scoped searchable fields", () => {
    expect(workspace).toContain('const [worklistSearch, setWorklistSearch] = useState("")');
    expect(workspace).toContain('const [worklistStatus, setWorklistStatus] = useState<"all" | typeof JOB_STATUSES[number]>("all")');
    expect(workspace).toContain('const filteredJobs = useMemo(() => {');
    expect(workspace).toContain('job.status === worklistStatus');
    expect(workspace).toContain('[job.jobNumber, job.title, job.clientName]');
    expect(workspace).toContain('filteredJobs.map(job =>');
    expect(workspace).not.toContain('trpc.jobs.list.useQuery({ search: worklistSearch');
  });

  it("provides an accessible reset and no-match state without adding a public projection", () => {
    expect(workspace).toContain('htmlFor="job-worklist-search"');
    expect(workspace).toContain('id="job-worklist-search"');
    expect(workspace).toContain('No private jobs match');
    expect(workspace).toContain('setWorklistSearch(""); setWorklistStatus("all")');
    const portalStart = router.indexOf("getJobs: publicProcedure");
    const portalEnd = router.indexOf("// ── Contracts", portalStart);
    expect(router.slice(portalStart, portalEnd)).not.toContain("worklistSearch");
    expect(router.slice(portalStart, portalEnd)).not.toContain("worklistStatus");
  });
});
