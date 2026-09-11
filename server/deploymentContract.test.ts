import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("deployment contract", () => {
  it("keeps container health and backup guidance wired", () => {
    const compose = readFileSync(resolve(process.cwd(), "docker-compose.yml"), "utf8");
    const readme = readFileSync(resolve(process.cwd(), "deploy/README.md"), "utf8");
    expect(compose).toContain("healthcheck:");
    expect(compose).toContain("/api/health");
    expect(readme).toContain("docker compose ps");
    expect(readme).toContain("mysqldump");
    expect(readme).toContain("uploads");
  });
});
