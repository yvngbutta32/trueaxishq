import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/* The app renders three self-hosted brand faces (Instrument Sans, Bricolage
 * Grotesque, Spline Sans Mono) with Inter kept as the glyph fallback — but a
 * broken font file was shipped for weeks: the @font-face blocks only declared
 * Vietnamese + latin-ext unicode ranges, so every basic Latin character
 * (U+0000-00FF) matched NO face and the whole UI silently fell back to
 * system-ui. This guard pins the fix across every shipped stylesheet. */

const root = resolve(import.meta.dirname, "..");
const fontsDir = resolve(root, "client/public/fonts");
const fontCssFiles = readdirSync(fontsDir).filter((f) => f.endsWith(".css"));
const css = fontCssFiles
  .map((f) => readFileSync(resolve(fontsDir, f), "utf8"))
  .join("\n");

describe("self-hosted font coverage", () => {
  it("every brand face is declared: Instrument Sans, Bricolage Grotesque, Spline Sans Mono (+ Inter fallback)", () => {
    for (const family of ["Inter", "Instrument Sans", "Bricolage Grotesque", "Spline Sans Mono"]) {
      expect(css).toContain("font-family: '" + family + "';");
    }
  });

  it("every declared family ships at least one face covering basic Latin (U+0000-00FF)", () => {
    const faces = [...css.matchAll(/font-family:\s*'([^']+)';[^}]*unicode-range:\s*([^;]+);/g)];
    expect(faces.length).toBeGreaterThanOrEqual(8);
    const covered = new Map<string, boolean>();
    for (const [, family, range] of faces) {
      if (range.includes("U+0000-00FF")) covered.set(family, true);
    }
    for (const family of ["Inter", "Instrument Sans", "Bricolage Grotesque", "Spline Sans Mono"]) {
      expect(covered.get(family), family + " lacks a basic-Latin face").toBe(true);
    }
  });

  it("every declared woff2 file actually exists in client/public/fonts", () => {
    const urls = [...css.matchAll(/url\(([^)]+\.woff2)\)/g)].map((m) =>
      m[1].replace("/fonts/", "")
    );
    expect(urls.length).toBeGreaterThanOrEqual(2);
    for (const file of urls) {
      expect(existsSync(resolve(fontsDir, file)), file).toBe(true);
    }
  });

  it("no orphan woff2 files in the fonts directory", () => {
    const declared = new Set(
      [...css.matchAll(/url\(([^)]+\.woff2)\)/g)].map((m) =>
        m[1].replace("/fonts/", "")
      )
    );
    const onDisk = readdirSync(fontsDir).filter((f) => f.endsWith(".woff2"));
    expect(onDisk.sort()).toEqual([...declared].sort());
  });

  it("fonts are served with immutable long-term caching (no revalidation per reload)", () => {
    const vite = readFileSync(resolve(root, "server/_core/vite.ts"), "utf8");
    expect(vite).toContain('filePath.endsWith(".woff2")');
    expect(vite).toContain("max-age=31536000, immutable");
  });

  it("the primary latin subsets are preloaded in index.html (no first-paint swap)", () => {
    const html = readFileSync(resolve(root, "client/index.html"), "utf8");
    expect(html).toContain('rel="preload"');
    expect(html).toContain("instrument-normal-latin.woff2");
    expect(html).toContain("spline-mono-variable-latin.woff2");
    expect(html).toContain('crossorigin');
  });
});
