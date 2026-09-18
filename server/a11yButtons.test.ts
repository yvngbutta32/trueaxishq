import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * A11y source guard: every <button> must expose an accessible name.
 * Buttons whose only content is an icon (or nothing, or a spinner while a
 * mutation is pending) are invisible to screen readers unless they carry
 * aria-label / title. This scan fails CI if any icon-only button lacks one.
 */

function walkTsx(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walkTsx(full, acc);
    else if (entry.endsWith(".tsx")) acc.push(full);
  }
  return acc;
}

/** Mirrors the audit heuristic: true when the button body renders visible text. */
function bodyHasVisibleText(body: string): boolean {
  let stripped = body.replace(/<[^>]+>/g, " ");
  stripped = stripped.replace(/\{([^}]*)\}/g, (_m, expr: string) => {
    if (expr.includes("<")) return " "; // JSX/conditional icons — not text
    if (/^\s*["']\s*["']\s*$/.test(expr)) return " "; // empty string
    return /[A-Za-z0-9]/.test(expr) ? "text" : " ";
  });
  return /[A-Za-z0-9]/.test(stripped);
}

describe("a11y: icon-only buttons are named", () => {
  const clientDir = resolve(import.meta.dirname, "../client/src");

  it("every icon-only button carries aria-label or title", () => {
    const files = walkTsx(clientDir);
    const offenders: string[] = [];

    for (const file of files) {
      const raw = readFileSync(file, "utf8");
      // Neutralize arrow functions so the ">" in "=>" can't truncate a tag.
      const src = raw.replace(/=>/g, "=:");
      for (const m of src.matchAll(/<button\b[^>]*>/gs)) {
        const tag = m[0];
        if (tag.includes("aria-label") || tag.includes("title=")) continue;
        const start = m.index! + m[0].length;
        let body = src.slice(start, start + 600);
        const end = body.indexOf("</button");
        if (end > -1) body = body.slice(0, end);
        if (!bodyHasVisibleText(body)) {
          const line = raw.slice(0, m.index!).split("\n").length;
          offenders.push(`${file.replace(clientDir + "/", "")}:${line}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
