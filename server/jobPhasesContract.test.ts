import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const routerSource = readFileSync(resolve(root, "server/routers.ts"), "utf8");
const schemaSource = readFileSync(resolve(root, "drizzle/schema.ts"), "utf8");
const workspaceSource = readFileSync(resolve(root, "client/src/pages/JobWorkspace.tsx"), "utf8");
const migrationSource = (() => {
  const dir = readdirSync(resolve(root, "drizzle"));
  return dir.filter(name => name.endsWith(".sql") && name.startsWith("0068_"))
    .map(name => readFileSync(resolve(root, "drizzle", name), "utf8")).join("");
})();

describe("Hybrid workflows (day-tickets + multi-phase projects)", () => {
  it("models phases on the same job record instead of a separate project entity", () => {
    expect(schemaSource).toContain('export const jobPhases = mysqlTable("jobPhases"');
    expect(schemaSource).toContain('mysqlEnum("status", ["planned", "in_progress", "done"])');
    expect(schemaSource).toContain('index("jobPhases_user_job_position_idx").on(t.userId, t.jobId, t.position)');
    // Tasks optionally link to a phase; unlinked tasks keep the day-ticket behavior.
    expect(schemaSource).toContain('phaseId: int("phaseId")');
    expect(schemaSource).toContain('index("jobTasks_phaseId_idx").on(t.userId, t.phaseId)');
  });

  it("ships the phase tables with the migration", () => {
    expect(migrationSource).toContain("CREATE TABLE `jobPhases`");
    expect(migrationSource).toContain("ALTER TABLE `jobTasks` ADD `phaseId`");
    expect(migrationSource).toContain("CREATE INDEX `jobPhases_user_job_position_idx`");
  });

  it("exposes owner-scoped phase CRUD with activity logging and task unlinking", () => {
    // Ownership is enforced on every path.
    const phaseEndpoints = ["addPhase", "updatePhase", "deletePhase", "reorderPhases"] as const;
    for (const endpoint of phaseEndpoints) {
      expect(routerSource).toContain(`    ${endpoint}: protectedProcedure`);
    }
    expect((routerSource.match(/eq\(jobPhases\.userId, ctx\.user\.id\)/g) ?? []).length).toBeGreaterThanOrEqual(8);
    // Phase lifecycle is recorded in the job activity feed.
    expect(routerSource).toContain('"phase_added"');
    expect(routerSource).toContain('"phase_status_changed"');
    expect(routerSource).toContain('"phase_removed"');
    // Removing a phase unlinks its tasks instead of deleting work.
    expect(routerSource).toContain("set({ phaseId: null })");
    // Reorder validates the id list belongs to the job exactly once.
    expect(routerSource).toContain("The phase order must list this job's phases exactly once.");
  });

  it("validates task phase assignment stays within the same job", () => {
    expect(routerSource).toContain("That phase does not belong to this job.");
    expect(routerSource).toMatch(/eq\(jobPhases\.jobId, task\.jobId\)/);
  });

  it("returns phases from the job detail query so one fetch powers the workspace", () => {
    expect(routerSource).toContain("jobExpenses, phases] = await Promise.all");
    expect(routerSource).toMatch(/db\.select\(\)\.from\(jobPhases\)/);
  });

  it("renders phases in the Job Workspace with safe delete and phase-aware tasks", () => {
    expect(workspaceSource).toContain('aria-label="Project phases"');
    expect(workspaceSource).toContain("addPhase.mutate({ jobId: detail.job.id, name: phaseName.trim() })");
    expect(workspaceSource).toContain("updatePhase.mutate({ id: phase.id, status:");
    expect(workspaceSource).toContain("reorderPhases.mutate({ jobId: detail.job.id, phaseIds:");
    // Deleting a phase asks first and explains tasks are kept.
    expect(workspaceSource).toContain("setPhasePendingDelete({ id: phase.id, name: phase.name })");
    expect(workspaceSource).toContain("checklist items are kept and simply unassigned");
    // Tasks can be assigned to phases only once phases exist (day-tickets stay clean).
    expect(workspaceSource).toContain("{detail.phases.length > 0 && <select aria-label={`Assign ${task.title} to a phase`}");
    expect(workspaceSource).toContain('<option value="">No phase</option>');
  });
});
