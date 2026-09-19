import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * Guards against the NaN-insertId bug class found in the Sept 19 2026
 * manual end-to-end test: `await db.insert(...)` in drizzle-orm mysql2
 * returns the raw mysql2 tuple `[ResultSetHeader, fields]`. Code that
 * declares the result WITHOUT destructuring and then reads
 * `result.insertId` gets `undefined` (surfacing to clients as `id: NaN`).
 * Correct form: `const [result] = await db.insert(...)` then `result.insertId`.
 */

function listServerFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...listServerFiles(full));
    else if (entry.endsWith(".ts") && !entry.endsWith(".test.ts")) out.push(full);
  }
  return out;
}

const serverDir = resolve(import.meta.dirname);
const offenders: string[] = [];

for (const file of listServerFiles(serverDir)) {
  const lines = readFileSync(file, "utf8").split("\n");
  for (let i = 0; i < lines.length; i++) {
    const m = /^(\s*)const (\w+) = await (?:db|tx)\.insert\(/.exec(lines[i]);
    if (!m) continue;
    const v = m[2];
    const scope = lines.slice(i + 1, i + 31).join("\n");
    const usesInsertId = new RegExp(`${v}(?: as any\\))?\\.insertId`).test(scope);
    if (usesInsertId) offenders.push(`${file.split("/").pop()}:${i + 1} (var ${v})`);
  }
}

describe("drizzle insertId shape contract", () => {
  it("every insert whose result id is read is destructured from the mysql2 tuple", () => {
    expect(offenders).toEqual([]);
  });
});
