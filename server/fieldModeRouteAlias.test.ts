import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(resolve(process.cwd(), "client/src/App.tsx"), "utf8");

describe("Field Mode route alias", () => {
  it("redirects the legacy mobile entry path to the authenticated Field Mode dashboard section", () => {
    expect(appSource).toContain('import { Redirect, Route, Switch } from "wouter"');
    expect(appSource).toContain('<Route path="/field-mode"><Redirect to="/dashboard/field" /></Route>');
  });
});
