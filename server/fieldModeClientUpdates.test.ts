import { describe, expect, it } from "vitest";
import { chooseFieldModeUpdateTemplate, fieldModeUpdateTemplates } from "../shared/fieldModeClientUpdates";

describe("Field Mode client update templates", () => {
  it("provides owner-reviewed portal update starters without automatic delivery semantics", () => {
    expect(fieldModeUpdateTemplates.map(template => template.id)).toEqual([
      "on-the-way", "work-started", "next-step", "work-complete",
    ]);
    expect(chooseFieldModeUpdateTemplate("on-the-way")).toContain("on my way");
    expect(chooseFieldModeUpdateTemplate("unknown")).toBeNull();
    expect(fieldModeUpdateTemplates.every(template => !/email|sms|automatically/i.test(template.message))).toBe(true);
  });
});
