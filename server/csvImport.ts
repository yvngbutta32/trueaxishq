/**
 * CSV import engine — the heart of the "switch to TrueAxis in an afternoon" moat.
 *
 * Parses competitor CSV exports (RFC 4180), auto-detects the source system,
 * maps columns to canonical fields, and validates rows before anything touches
 * the database. Pure functions only: every branch is unit-testable and nothing
 * here performs I/O.
 */

export type ImportSource =
  | "jobber"
  | "housecall-pro"
  | "servicetitan"
  | "servicem8"
  | "buildertrend"
  | "generic";

export type ImportTarget = "clients" | "services";

/** Canonical fields the wizard maps CSV columns onto. */
export type CanonicalField =
  | "firstName" | "lastName" | "company" | "name"
  | "email" | "phone" | "phoneAlt" | "service" | "notes"
  | "description" | "price" | "unit" | "category";

export type FieldMapping = Partial<Record<CanonicalField, number>>;

export interface SourcePreset {
  label: string;
  /** Header aliases that, when found together, identify this export. */
  signatures: string[];
}

const normalizeHeader = (header: string) => header.toLowerCase().replace(/[^a-z0-9]/g, "");

export const SOURCE_PRESETS: Record<Exclude<ImportSource, "generic">, SourcePreset> = {
  jobber: {
    label: "Jobber",
    signatures: ["firstname", "lastname", "companyname", "email", "cellphone", "billingaddress", "postalzipcode"],
  },
  "housecall-pro": {
    label: "Housecall Pro",
    signatures: ["firstname", "lastname", "email", "mobilephone", "homephone", "company", "address", "zipcode"],
  },
  servicetitan: {
    label: "ServiceTitan",
    signatures: ["customername", "customer", "email", "phone", "address", "city", "zip"],
  },
  servicem8: {
    label: "ServiceM8",
    signatures: ["firstname", "lastname", "email", "mobile", "phone", "street", "suburb", "postcode"],
  },
  buildertrend: {
    label: "Buildertrend",
    signatures: ["firstname", "lastname", "email", "phone", "address", "city", "state", "zip"],
  },
};

const CLIENT_ALIASES: Partial<Record<CanonicalField, string[]>> = {
  firstName: ["firstname", "first", "fname", "givenname"],
  lastName: ["lastname", "last", "lname", "surname", "familyname"],
  company: ["company", "companyname", "businessname", "organization", "business"],
  name: ["fullname", "clientname", "customername", "name", "contactname"],
  email: ["email", "emailaddress", "primaryemail", "workemail"],
  phone: ["phone", "phonenumber", "primaryphone", "telephone", "contactphone", "mainphone"],
  phoneAlt: ["mobilephone", "mobile", "cellphone", "cell", "homephone", "alternatephone", "phonetype2"],
  service: ["service", "servicetype", "serviceprovided", "jobtype", "servicerequested", "tags", "categories"],
  notes: ["notes", "note", "comments", "description", "internalnotes", "customernote"],
};

const SERVICE_ALIASES: Partial<Record<CanonicalField, string[]>> = {
  name: ["name", "servicename", "itemname", "productname", "description"],
  description: ["description", "details", "notes", "longdescription", "itemdescription"],
  price: ["price", "unitprice", "rate", "cost", "amount", "pricetext", "servicecost"],
  unit: ["unit", "units", "billingunit", "priceunit", "uom"],
  category: ["category", "type", "servicetype", "group", "categoryname", "serviceline"],
};

/** RFC 4180 CSV parser: quoted fields, escaped quotes, CRLF, embedded newlines. */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else inQuotes = false;
      } else cell += char;
      continue;
    }
    if (char === '"') { inQuotes = true; continue; }
    if (char === ",") { row.push(cell); cell = ""; continue; }
    if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      // Skip fully empty lines (trailing newline / blank separators).
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
      continue;
    }
    cell += char;
  }
  // Flush the final cell/row (no trailing newline case).
  if (inQuotes) throw new Error("Malformed CSV: unterminated quoted field.");
  row.push(cell);
  if (row.length > 1 || row[0] !== "") rows.push(row);
  return rows;
}

/** Detects the source system from header signatures; needs 2+ hits to commit. */
export function detectSource(headers: string[]): { source: ImportSource; label: string; confidence: number } {
  const normalized = new Set(headers.map(normalizeHeader));
  let best: { source: ImportSource; label: string; hits: number } = { source: "generic", label: "Generic CSV", hits: 0 };
  for (const [source, preset] of Object.entries(SOURCE_PRESETS) as [Exclude<ImportSource, "generic">, SourcePreset][]) {
    const hits = preset.signatures.filter(alias => normalized.has(alias)).length;
    if (hits > best.hits) best = { source, label: preset.label, hits };
  }
  if (best.hits >= 2) return { source: best.source, label: best.label, confidence: best.hits };
  return { source: "generic", label: "Generic CSV", confidence: 0 };
}

/**
 * Suggests a mapping from CSV headers to canonical fields for a target.
 * Two strict passes, so exact aliases always beat fuzzy ones — "Last Name"
 * goes to lastName, never to the generic "name" alias.
 *   Pass 1: exact normalized match ("mobilephone" -> phoneAlt).
 *   Pass 2: contains match for decorated headers ("customeremail" -> email),
 *           longer aliases first.
 */
export function buildAutoMapping(headers: string[], target: ImportTarget): FieldMapping {
  const aliases = target === "clients" ? CLIENT_ALIASES : SERVICE_ALIASES;
  const mapping: FieldMapping = {};
  const used = new Set<number>();
  const normalized = headers.map(normalizeHeader);
  const fields = Object.entries(aliases) as [CanonicalField, string[]][];
  const byLongestAlias = (a: [CanonicalField, string[]], b: [CanonicalField, string[]]) =>
    Math.max(...b[1].map(x => x.length)) - Math.max(...a[1].map(x => x.length));

  const claim = (field: CanonicalField, idx: number) => { mapping[field] = idx; used.add(idx); };
  for (const [field, fieldAliases] of fields) {
    const idx = fieldAliases.findIndex(alias => normalized.findIndex((h, i) => !used.has(i) && h === alias) !== -1);
    const found = idx === -1 ? -1 : normalized.findIndex((h, i) => !used.has(i) && h === fieldAliases[idx]);
    if (found !== -1) claim(field, found);
  }
  for (const [field, fieldAliases] of [...fields].sort(byLongestAlias)) {
    if (mapping[field] !== undefined) continue;
    for (const alias of fieldAliases) {
      const found = normalized.findIndex((h, i) => !used.has(i) && h.includes(alias));
      if (found !== -1) { claim(field, found); break; }
    }
  }
  return mapping;
}

/** Emails cannot legally contain whitespace; strip artifacts from spreadsheet exports. */
export const normalizeEmail = (raw: string | undefined): string => (raw ?? "").replace(/\s+/g, "").toLowerCase();
export const normalizePhoneDigits = (raw: string | undefined): string => (raw ?? "").replace(/\D/g, "");
export const looksLikeEmail = (raw: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(raw.trim());

export interface ExtractedClientRow { name: string; email: string; phone: string; service: string | null; notes: string | null; }
export interface ExtractedServiceRow { name: string; description: string | null; price: string; unit: string; category: string; }

export function extractClientRow(cells: string[], mapping: FieldMapping): ExtractedClientRow {
  const at = (idx: number | undefined) => (idx === undefined ? "" : (cells[idx] ?? "")).trim();
  const first = at(mapping.firstName), last = at(mapping.lastName);
  // Person-first: when a row has both a person and a company, the person is the client
  // (their name drives personalized email, portal, and follow-ups). Company is the
  // fallback for records that only have one.
  const name = at(mapping.name) || [first, last].filter(Boolean).join(" ") || at(mapping.company);
  const phone = at(mapping.phone) || at(mapping.phoneAlt);
  return {
    name,
    email: normalizeEmail(at(mapping.email)),
    phone,
    service: at(mapping.service) || null,
    notes: at(mapping.notes) || null,
  };
}

export function extractServiceRow(cells: string[], mapping: FieldMapping): ExtractedServiceRow {
  const at = (idx: number | undefined) => (idx === undefined ? "" : (cells[idx] ?? "")).trim();
  const rawPrice = at(mapping.price).replace(/[^0-9.\-]/g, "");
  return {
    name: at(mapping.name),
    description: at(mapping.description) || null,
    price: rawPrice,
    unit: at(mapping.unit) || "job",
    category: at(mapping.category) || "service",
  };
}

export function validateClientRow(row: ExtractedClientRow): string[] {
  const errors: string[] = [];
  if (!row.name) errors.push("No name — map a name, company, or first/last name column.");
  if (row.email && !looksLikeEmail(row.email)) errors.push(`"${row.email}" is not a valid email.`);
  if (row.email.length > 320) errors.push("Email is longer than 320 characters.");
  if (row.name.length > 255) errors.push("Name is longer than 255 characters.");
  if (row.phone.length > 32) errors.push("Phone is longer than 32 characters.");
  if ((row.service ?? "").length > 255) errors.push("Service is longer than 255 characters.");
  return errors;
}

export function validateServiceRow(row: ExtractedServiceRow): string[] {
  const errors: string[] = [];
  if (!row.name) errors.push("No service name.");
  if (row.name.length > 255) errors.push("Name is longer than 255 characters.");
  if ((row.description ?? "").length > 1024) errors.push("Description is longer than 1024 characters.");
  if (row.unit.length > 32) errors.push("Unit is longer than 32 characters.");
  if (row.category.length > 64) errors.push("Category is longer than 64 characters.");
  if (row.price === "" || Number.isNaN(Number(row.price)) || Number(row.price) < 0) errors.push("Missing or invalid price.");
  if (Number(row.price) > 99_999_999.99) errors.push("Price exceeds the supported range.");
  return errors;
}

export interface ImportIssue { row: number; errors: string[] }
export interface ImportAnalysis {
  issues: ImportIssue[];
  valid: { row: number; record: ExtractedClientRow | ExtractedServiceRow }[];
}

/**
 * Full validation pipeline: extract and validate every row, dedupe within
 * the file (clients by email-or-phone digits, services by name), and return
 * the rows that are safe to import. Row numbers are 1-based against the
 * data rows (excluding the header), matching what the wizard shows.
 */
export function analyzeRows(dataRows: string[][], target: ImportTarget, mapping: FieldMapping): ImportAnalysis {
  const issues: ImportIssue[] = [];
  const valid: { row: number; record: ExtractedClientRow | ExtractedServiceRow }[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < dataRows.length; i++) {
    const cells = dataRows[i].map(c => c.trim());
    if (target === "clients") {
      const record = extractClientRow(cells, mapping);
      const errors = validateClientRow(record);
      const key = record.email || normalizePhoneDigits(record.phone);
      if (errors.length === 0 && key) {
        if (seen.has(key)) errors.push("Duplicate of an earlier row in this file (same email or phone).");
        else seen.add(key);
      }
      if (errors.length) issues.push({ row: i + 1, errors });
      else valid.push({ row: i + 1, record });
    } else {
      const record = extractServiceRow(cells, mapping);
      const errors = validateServiceRow(record);
      if (errors.length === 0) {
        const key = record.name.toLowerCase();
        if (seen.has(key)) errors.push("Duplicate of an earlier row in this file (same name).");
        else seen.add(key);
      }
      if (errors.length) issues.push({ row: i + 1, errors });
      else valid.push({ row: i + 1, record });
    }
  }
  return { issues, valid };
}
