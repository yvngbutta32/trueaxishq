import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// The Oct 23 2026 full-scope audit caught a launch-blocking defect: hand-written
// migrations 0083-0086 had `--> statement-breakpoint` markers placed INSIDE
// single ALTER statements, so drizzle split them into orphaned `ADD COLUMN ...`
// fragments. drizzle-kit migrate aborted at 0083 on every FRESH install (dev DBs
// hid it because the changes had been hand-applied and drizzle skips applied
// entries by journal timestamp, not file hash). These tests pin the ledger so
// that class of defect can never ship again:
//   1. every journal entry has a matching SQL file, and vice versa (no orphans)
//   2. journal `when` timestamps are strictly increasing (drizzle applies new
//      entries only when when > the last applied row — an out-of-order entry
//      would silently never run on existing databases)
//   3. every statement chunk split by the breakpoint marker is non-empty and
//      starts with a real statement keyword (catches breakpoints placed inside
//      ALTER/CREATE statements and stray leading markers)
// The live proof that fresh installs actually apply everything is
// scripts/fresh-install-proof.sh (runbook step).

const root = resolve(import.meta.dirname, "..");
const journal = JSON.parse(readFileSync(resolve(root, "drizzle/meta/_journal.json"), "utf8")) as { entries: { idx: number; when: number; tag: string }[] };
const sqlFiles = readdirSync(resolve(root, "drizzle")).filter(f => /^\d{4}_.*\.sql$/.test(f)).sort();
const STATEMENT_KEYWORDS = /^(ALTER|CREATE|INSERT|UPDATE|DELETE|DROP|RENAME|TRUNCATE|SET|USE|LOCK|UNLOCK|GRANT|REVOKE)\b/i;

function chunksOf(tag: string): { file: string; chunks: string[] } {
  const file = resolve(root, `drizzle/${tag}.sql`);
  const raw = readFileSync(file, "utf8");
  return { file, chunks: raw.split("--> statement-breakpoint").map(c => c.trim()).filter(c => c.length > 0) };
}

/** SQL comments are legitimate chunk content — the executable statement starts at the first non-comment line. */
function stripComments(chunk: string): string {
  return chunk.split("\n").filter(line => !line.trimStart().startsWith("--")).join("\n").trim();
}

describe("migration ledger integrity (fresh-install guarantee)", () => {
  it("journal and drizzle/*.sql files are in perfect parity — no orphans, no gaps", () => {
    const tags = journal.entries.map(e => `${e.tag}.sql`);
    expect(tags).toEqual(sqlFiles);
    expect(journal.entries.every((e, i) => e.idx === i)).toBe(true);
  });

  it("journal timestamps are strictly increasing so existing databases pick up every new migration", () => {
    const whens = journal.entries.map(e => e.when);
    for (let i = 1; i < whens.length; i++) {
      expect(whens[i], `entry ${journal.entries[i].tag} must have a later timestamp than ${journal.entries[i - 1].tag}`).toBeGreaterThan(whens[i - 1]);
    }
  });

  it("every statement chunk starts with a real SQL keyword — no breakpoints inside statements, no stray markers", () => {
    for (const entry of journal.entries) {
      const { chunks } = chunksOf(entry.tag);
      expect(chunks.length, `${entry.tag} has no statements`).toBeGreaterThan(0);
      for (const chunk of chunks) {
        const statement = stripComments(chunk);
        expect(statement.length, `${entry.tag} contains a comment-only chunk — breakpoint marker misplaced?`).toBeGreaterThan(0);
        expect(
          STATEMENT_KEYWORDS.test(statement),
          `${entry.tag} contains a fragment that is not a complete statement (breakpoint marker misplaced?):\n${chunk.slice(0, 120)}`
        ).toBe(true);
      }
    }
  });

  it("all chunks that modify schema carry a terminating semicolon", () => {
    for (const entry of journal.entries) {
      const { chunks } = chunksOf(entry.tag);
      for (const chunk of chunks) {
        expect(stripComments(chunk).endsWith(";"), `${entry.tag} statement does not end with a semicolon:\n${chunk.slice(0, 120)}`).toBe(true);
      }
    }
  });
});
