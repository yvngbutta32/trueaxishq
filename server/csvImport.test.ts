import { describe, expect, it } from "vitest";
import {
  buildAutoMapping,
  detectSource,
  extractClientRow,
  extractServiceRow,
  looksLikeEmail,
  normalizeEmail,
  normalizePhoneDigits,
  parseCsv,
  validateClientRow,
  validateServiceRow,
} from "./csvImport";

describe("RFC 4180 CSV parsing", () => {
  it("parses basic rows with CRLF and trailing newline", () => {
    expect(parseCsv("a,b\r\nc,d\r\n")).toEqual([["a", "b"], ["c", "d"]]);
  });

  it("handles quoted fields with commas, escaped quotes, and embedded newlines", () => {
    expect(parseCsv('"Smith, John","He said ""hi""","line1\nline2",x')).toEqual([
      ["Smith, John", 'He said "hi"', "line1\nline2", "x"],
    ]);
  });

  it("strips a UTF-8 BOM and skips blank lines", () => {
    expect(parseCsv("\uFEFFName,Email\r\n\r\nJane,j@x.com\r\n\r\n")).toEqual([
      ["Name", "Email"],
      ["Jane", "j@x.com"],
    ]);
  });

  it("rejects unterminated quotes instead of silently mangling data", () => {
    expect(() => parseCsv('"open,text')).toThrow(/unterminated/i);
  });

  it("preserves single-cell rows", () => {
    expect(parseCsv("only")).toEqual([["only"]]);
  });
});

describe("source detection", () => {
  it("recognizes a Jobber clients export", () => {
    const headers = ["First Name", "Last Name", "Company Name", "Email", "Cell Phone", "Billing Address", "Postal/Zip Code"];
    const result = detectSource(headers);
    expect(result.source).toBe("jobber");
    expect(result.label).toBe("Jobber");
  });

  it("recognizes Housecall Pro, ServiceTitan, ServiceM8, and Buildertrend signatures", () => {
    expect(detectSource(["First Name", "Last Name", "Email", "Mobile Phone", "Home Phone", "Company", "Zip Code"]).source).toBe("housecall-pro");
    expect(detectSource(["Customer Name", "Email", "Phone", "Address", "City", "Zip"]).source).toBe("servicetitan");
    expect(detectSource(["First Name", "Last Name", "Email", "Mobile", "Street", "Suburb", "Postcode"]).source).toBe("servicem8");
    expect(detectSource(["First Name", "Last Name", "Email", "Phone", "Address", "City", "State", "Zip"]).source).toBe("buildertrend");
  });

  it("falls back to generic CSV instead of guessing from one header", () => {
    expect(detectSource(["Name", "Email"]).source).toBe("generic");
  });
});

describe("auto mapping", () => {
  it("maps first/last name correctly — never lets the generic name alias steal them", () => {
    const mapping = buildAutoMapping(["First Name", "Last Name", "Email", "Phone"], "clients");
    expect(mapping.firstName).toBe(0);
    expect(mapping.lastName).toBe(1);
    expect(mapping.email).toBe(2);
    expect(mapping.phone).toBe(3);
    expect(mapping.name).toBeUndefined();
  });

  it("prefers the specific mobile column over generic phone", () => {
    const mapping = buildAutoMapping(["Phone", "Mobile Phone", "Email"], "clients");
    expect(mapping.phoneAlt).toBe(1); // "mobilephone" is phoneAlt's exact alias
    expect(mapping.phone).toBe(0);
  });

  it("contains-matches decorated headers", () => {
    const mapping = buildAutoMapping(["Customer Email", "Client Phone Number", "Client Name"], "clients");
    expect(mapping.email).toBe(0);
    expect(mapping.phone).toBe(1);
    expect(mapping.name).toBe(2);
  });

  it("maps service/price-book exports", () => {
    const mapping = buildAutoMapping(["Service Name", "Description", "Price", "Unit", "Category"], "services");
    expect(mapping.name).toBe(0);
    expect(mapping.description).toBe(1);
    expect(mapping.price).toBe(2);
    expect(mapping.unit).toBe(3);
    expect(mapping.category).toBe(4);
  });
});

describe("row extraction and validation", () => {
  const jobberLike = ["First Name", "Last Name", "Company Name", "Email", "Cell Phone", "Service", "Notes"];
  it("merges first+last, falls back to company, and fills phone from the alt column", () => {
    const mapping = buildAutoMapping(jobberLike, "clients");
    const row = extractClientRow(["Jane", "Ortiz", "", "JANE@X.com ", "(512) 555-0100", "Mowing", "VIP"], mapping);
    expect(row.name).toBe("Jane Ortiz");
    expect(row.email).toBe("jane@x.com");
    expect(row.phone).toBe("(512) 555-0100");
    expect(row.service).toBe("Mowing");
    expect(row.notes).toBe("VIP");

    const company = extractClientRow(["", "", "Ortiz Landscaping", "ops@x.com", "512-555-0100", "", ""], mapping);
    expect(company.name).toBe("Ortiz Landscaping");
  });

  it("flags rows that cannot be imported, with actionable messages", () => {
    expect(validateClientRow(extractClientRow(["", "", "", "", "", "", ""], buildAutoMapping(jobberLike, "clients")))).toHaveLength(1);
    expect(validateClientRow({ name: "X", email: "not-an-email", phone: "", service: null, notes: null })).toEqual([expect.stringContaining("valid email")]);
    expect(validateClientRow({ name: "A".repeat(300), email: "", phone: "", service: null, notes: null })).toEqual([expect.stringContaining("255")]);
  });

  it("validates price-book rows", () => {
    expect(validateServiceRow({ name: "Mow", description: null, price: "45", unit: "job", category: "service" })).toEqual([]);
    expect(validateServiceRow({ name: "Mow", description: null, price: "", unit: "job", category: "service" })[0]).toContain("price");
    expect(validateServiceRow({ name: "", description: null, price: "10", unit: "job", category: "service" })[0]).toContain("name");
    expect(validateServiceRow({ name: "Mow", description: null, price: "free", unit: "job", category: "service" })[0]).toContain("price");
  });

  it("extracts prices with currency noise", () => {
    const row = extractServiceRow(["Weekly Mow", "Front and back", "$45.00", "job", "Lawn"], buildAutoMapping(["Service Name", "Description", "Price", "Unit", "Category"], "services"));
    expect(row).toEqual({ name: "Weekly Mow", description: "Front and back", price: "45.00", unit: "job", category: "Lawn" });
  });
});

describe("normalization helpers", () => {
  it("normalizes emails and phones for dedupe matching", () => {
    expect(normalizeEmail("  JANE@X.COM ")).toBe("jane@x.com");
    expect(normalizePhoneDigits("(512) 555-0100")).toBe("5125550100");
    expect(looksLikeEmail("jane@x.com")).toBe(true);
    expect(looksLikeEmail("jane@x")).toBe(false);
  });
});
