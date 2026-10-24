import { describe, expect, it } from "vitest";
import { z } from "zod";

// Mirrors the production helper in server/routers.ts (safeOptionalMoney). Keep this
// in sync by importing the real one if it is ever extracted to shared/.
const safeOptionalMoney = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v === undefined || v === "" ? undefined : v.replace(/^[\$\s]+/, "").replace(/,/g, "")))
  .refine((v) => v === undefined || /^\d{1,6}(\.\d{1,2})?$/.test(v), {
    message: "Enter a valid rate like 85 or 85.50",
  });

describe("defaultRate money validation (live catch: raw text caused MySQL 500 + SQL leak)", () => {
  it("normalizes dollar and comma input", () => {
    expect(safeOptionalMoney.parse("$1,234.50")).toBe("1234.50");
    expect(safeOptionalMoney.parse(" 85 ")).toBe("85");
  });

  it("passes through undefined and empty as undefined", () => {
    expect(safeOptionalMoney.parse(undefined)).toBeUndefined();
    expect(safeOptionalMoney.parse("")).toBeUndefined();
  });

  it("rejects non-monetary text with a friendly message, never raw SQL", async () => {
    const r = await safeOptionalMoney.safeParseAsync("QA Test 42");
    expect(r.success).toBe(false);
    if (!r.success) {
      const msg = JSON.stringify(r.error.issues);
      expect(msg).toContain("Enter a valid rate");
      expect(msg).not.toContain("insert into");
    }
  });

  it("rejects more than two decimal places and >6 integer digits", async () => {
    expect((await safeOptionalMoney.safeParseAsync("12.345")).success).toBe(false);
    expect((await safeOptionalMoney.safeParseAsync("1234567")).success).toBe(false);
  });

  it("accepts plain rates a freelancer would type", () => {
    expect(safeOptionalMoney.parse("85")).toBe("85");
    expect(safeOptionalMoney.parse("85.5")).toBe("85.5");
    expect(safeOptionalMoney.parse("0")).toBe("0");
  });
});
