import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/* The app renders Inter everywhere, but a broken font file was shipped for
 * weeks: the @font-face blocks only declared Vietnamese + latin-ext unicode
 * ranges, so every basic Latin character (U+0000-00FF) matched NO face and
 * the whole UI silently fell back to system-ui. This guard pins the fix. */

const root = resolve(import.meta.dirname, "..");
const fontsDir = resolve(root, "client/public/fonts");
const css = readFileSync(resolve(fontsDir, "inter.css"), "utf8");

describe("self-hosted Inter font coverage", () => {
  it("declares a normal latin face covering basic Latin (U+0000-00FF)", () => {
    const normalLatin = css.match(
      /font-style:\s*normal;[^}]*unicode-range:\s*([^;]+);/
    );
    expect(normalLatin).toBeTruthy();
    expect(normalLatin![1]).toContain("U+0000-00FF");
  });

  it("declares an italic latin face covering basic Latin", () => {
    const italicLatin = css.match(
      /font-style:\s*italic;[^}]*unicode-range:\s*([^;]+);/
    );
    expect(italicLatin).toBeTruthy();
    expect(italicLatin![1]).toContain("U+0000-00FF");
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

  it("the primary latin subset is preloaded in index.html (no first-paint swap)", () => {
    const html = readFileSync(resolve(root, "client/index.html"), "utf8");
    expect(html).toContain('rel="preload"');
    expect(html).toContain("inter-normal-latin.woff2");
    expect(html).toContain('crossorigin');
  });
});
