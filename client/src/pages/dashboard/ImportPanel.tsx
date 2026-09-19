import { useRef, useState } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, CircleAlert, Download, FileUp, Loader2, RefreshCw, Users, Wrench } from "lucide-react";
import { trpc } from "@/lib/trpc";

/* Data import wizard — the switching moat. Guides a business owner from a
 * competitor CSV export to imported TrueAxis records in one sitting, with a
 * mandatory dry-run before anything is written. */

type Step = "target" | "paste" | "review" | "results";
const STEP_ORDER: [Step, string][] = [
  ["target", "What to import"],
  ["paste", "Add your file"],
  ["review", "Check the mapping"],
  ["results", "Done"],
];
type Target = "clients" | "services";
type DuplicateMode = "skip" | "update" | "create";

interface PreviewData {
  source: string; sourceLabel: string;
  headers: string[];
  mapping: Record<string, number>;
  totalRows: number; validRows: number; issueCount: number;
  issues: { row: number; errors: string[] }[];
  duplicateCount: number;
  duplicates: { row: number; existingName: string; matchedOn: string }[];
  sample: Record<string, string | null>[];
}

interface CommitResult {
  created: number; updated: number; skipped: number;
  failedCount: number; failed: { row: number; errors: string[] }[];
  skippedReasons: { duplicate: number; emailConflict: number; nothingToUpdate: number };
}

const CLIENT_FIELDS: { key: string; label: string; hint?: string }[] = [
  { key: "name", label: "Full name", hint: "or use First/Last below" },
  { key: "firstName", label: "First name" },
  { key: "lastName", label: "Last name" },
  { key: "company", label: "Company" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone", hint: "main number" },
  { key: "phoneAlt", label: "Second phone", hint: "mobile/cell fallback" },
  { key: "service", label: "Service type" },
  { key: "notes", label: "Notes" },
];

const SERVICE_FIELDS: { key: string; label: string; hint?: string }[] = [
  { key: "name", label: "Service name" },
  { key: "description", label: "Description" },
  { key: "price", label: "Price" },
  { key: "unit", label: "Unit", hint: "job, hour, sq ft…" },
  { key: "category", label: "Category" },
];

const downloadTemplate = (target: Target) => {
  const header = target === "clients" ? "Name,Email,Phone,Service,Notes" : "Service Name,Description,Price,Unit,Category";
  const example = target === "clients" ? "Jane Ortiz,jane@example.com,(512) 555-0100,Mowing,Referral" : "Weekly Mow,Front and back,45,job,Lawn";
  const blob = new Blob([`${header}\n${example}\n`], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `trueaxis-${target}-template.csv`; a.click();
  URL.revokeObjectURL(url);
};

export default function ImportPanel() {
  const [step, setStep] = useState<Step>("target");
  const [target, setTarget] = useState<Target>("clients");
  const [csvText, setCsvText] = useState("");
  const [mapping, setMapping] = useState<Record<string, number>>({});
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [duplicateMode, setDuplicateMode] = useState<DuplicateMode>("skip");
  const [result, setResult] = useState<CommitResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const previewMutation = trpc.migration.preview.useMutation({
    onSuccess: data => { setPreview(data as unknown as PreviewData); setMapping(data.mapping); setStep("review"); setError(null); },
    onError: err => setError(err.message),
  });
  const commitMutation = trpc.migration.commit.useMutation({
    onSuccess: data => { setResult(data as unknown as CommitResult); setStep("results"); setError(null); },
    onError: err => setError(err.message),
  });

  const readFile = (file: File) => {
    if (file.size > 2_000_000) { setError("That file is larger than the 2 MB import limit. Split it and import in parts."); return; }
    const reader = new FileReader();
    reader.onload = () => { setCsvText(String(reader.result ?? "")); setError(null); };
    reader.readAsText(file);
  };

  const reset = () => {
    setStep("target"); setCsvText(""); setPreview(null); setResult(null); setMapping({});
  };

  const fields = target === "clients" ? CLIENT_FIELDS : SERVICE_FIELDS;
  const duplicateOptions: [DuplicateMode, string][] = target === "clients"
    ? [["skip", "Skip them (keep my existing client)"], ["update", "Fill in missing details on my existing client"], ["create", "Import phone-only matches as new clients"]]
    : [["skip", "Skip them (keep my existing service)"], ["update", "Update price and details on my existing service"], ["create", "Import everything as new services"]];

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-8">
      <header className="rounded-3xl bg-[#1C2333] p-6 text-white sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#f5c36d]">Switch to TrueAxis HQ</p>
        <h1 className="mt-2 text-3xl font-bold">Bring your data with you</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/70">
          Export your client list or price book from your current system as CSV, and this wizard maps and checks it with you
          before anything is saved. Nothing is written until you approve the preview.
        </p>
      </header>

      {/* Step indicator */}
      <ol className="flex flex-wrap gap-2 text-xs font-semibold">
        {STEP_ORDER.map(([id, label], i) => {
          const stepIndex = STEP_ORDER.findIndex(([id2]) => id2 === step);
          const reached = i <= stepIndex;
          const active = step === id;
          return (
            <li key={id} className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 ${active ? "bg-[#D4922A] text-white" : reached ? "bg-[#EDE9E1] text-[#1A1A1A]" : "bg-slate-100 text-slate-400"}`}>
              <span className={active ? "" : reached ? "text-[#D4922A]" : ""}>{i + 1}.</span> {label}
            </li>
          );
        })}
      </ol>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800" role="alert">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {step === "target" && (
        <section className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <button onClick={() => { setTarget("clients"); setStep("paste"); }}
              className="rounded-2xl border border-[rgba(26,26,26,0.1)] bg-white p-5 text-left transition hover:border-[#D4922A]/50">
              <Users className="h-6 w-6 text-[#D4922A]" />
              <h2 className="mt-3 font-bold text-[#1A1A1A]">Client list</h2>
              <p className="mt-1 text-sm text-[rgba(26,26,26,0.62)]">Names, emails, phones, service types, and notes. Duplicates against your existing clients are detected before anything is saved.</p>
            </button>
            <button onClick={() => { setTarget("services"); setStep("paste"); }}
              className="rounded-2xl border border-[rgba(26,26,26,0.1)] bg-white p-5 text-left transition hover:border-[#D4922A]/50">
              <Wrench className="h-6 w-6 text-[#D4922A]" />
              <h2 className="mt-3 font-bold text-[#1A1A1A]">Price book services</h2>
              <p className="mt-1 text-sm text-[rgba(26,26,26,0.62)]">Service names, prices, units, and categories — ready for proposals and invoices.</p>
            </button>
          </div>
          <div className="rounded-2xl border border-[#D4922A]/25 bg-[#fffaf0] p-5">
            <h3 className="text-sm font-bold text-[#1A1A1A]">Where do I get a CSV?</h3>
            <p className="mt-1 text-sm leading-relaxed text-[rgba(26,26,26,0.65)]">
              Jobber, Housecall Pro, ServiceTitan, ServiceM8, and Buildertrend can all export client data as CSV from their
              reports or contacts screens. The wizard recognizes their standard headers automatically — and you can adjust
              any mapping by hand. We never ask for your old system's password.
            </p>
          </div>
        </section>
      )}

      {step === "paste" && (
        <section className="space-y-4">
          <div className="rounded-2xl border border-[rgba(26,26,26,0.1)] bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-bold text-[#1A1A1A]">{target === "clients" ? "Client list" : "Price book"} CSV</h2>
              <button onClick={() => downloadTemplate(target)} className="inline-flex items-center gap-1.5 rounded-lg border border-[rgba(26,26,26,0.14)] px-3 py-1.5 text-xs font-bold text-[#1A1A1A] hover:bg-[#F0EEE9]">
                <Download className="h-3.5 w-3.5" /> Download a blank template
              </button>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-[auto_1fr]">
              <div>
                <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) readFile(f); }} />
                <button onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-2 rounded-xl border-2 border-dashed border-[rgba(26,26,26,0.2)] px-5 py-4 text-sm font-bold text-[#1A1A1A] hover:border-[#D4922A]/60 hover:bg-[#fffaf0]">
                  <FileUp className="h-5 w-5 text-[#D4922A]" /> Choose CSV file
                </button>
              </div>
              <div className="text-xs leading-5 text-[rgba(26,26,26,0.55)]">
                Or paste the CSV text below. Up to 10,000 rows per import — for larger books, split the file and run it again.
                <textarea
                  value={csvText}
                  onChange={e => setCsvText(e.target.value)}
                  placeholder={"Name,Email,Phone\nJane Ortiz,jane@example.com,(512) 555-0100"}
                  rows={6}
                  className="mt-2 w-full rounded-xl border border-[rgba(26,26,26,0.14)] p-3 font-mono text-xs"
                  aria-label="CSV text"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setStep("target")} className="rounded-lg px-4 py-2 text-sm font-bold text-[#6B6B6B] hover:bg-[#F0EEE9]">Back</button>
              <button
                disabled={csvText.trim().length < 10 || previewMutation.isPending}
                onClick={() => previewMutation.mutate({ csv: csvText, target })}
                className="gradient-amber inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50">
                {previewMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                Preview the import
              </button>
            </div>
          </div>
        </section>
      )}

      {step === "review" && preview && (
        <section className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-[rgba(26,26,26,0.1)] bg-white p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-[#6B6B6B]">Source detected</p>
              <p className="mt-1 text-lg font-bold text-[#1A1A1A]">{preview.sourceLabel}</p>
            </div>
            <div className="rounded-2xl border border-[rgba(26,26,26,0.1)] bg-white p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-[#6B6B6B]">Ready to import</p>
              <p className="mt-1 text-lg font-bold text-emerald-700">{preview.validRows} of {preview.totalRows} rows</p>
            </div>
            <div className="rounded-2xl border border-[rgba(26,26,26,0.1)] bg-white p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-[#6B6B6B]">Needs attention</p>
              <p className="mt-1 text-lg font-bold text-[#1A1A1A]">{preview.issueCount + preview.duplicateCount} rows</p>
            </div>
          </div>

          <div className="rounded-2xl border border-[rgba(26,26,26,0.1)] bg-white p-5">
            <h2 className="font-bold text-[#1A1A1A]">Column mapping</h2>
            <p className="mt-1 text-sm text-[rgba(26,26,26,0.62)]">We auto-detected this from your headers. Change any mapping — the preview updates when you re-check.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {fields.map(field => (
                <label key={field.key} className="text-xs font-bold text-[#1A1A1A]">
                  {field.label}{field.hint ? <span className="ml-1 font-normal text-[rgba(26,26,26,0.5)]">({field.hint})</span> : null}
                  <select
                    value={mapping[field.key] ?? ""}
                    onChange={e => { const next = { ...mapping }; if (e.target.value === "") delete next[field.key]; else next[field.key] = Number(e.target.value); setMapping(next); }}
                    className="mt-1 w-full rounded-lg border border-[rgba(26,26,26,0.14)] bg-white p-2 text-xs font-normal">
                    <option value="">— Not mapped —</option>
                    {preview.headers.map((h, i) => <option key={i} value={i}>{h || `(column ${i + 1})`}</option>)}
                  </select>
                </label>
              ))}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setStep("paste")} className="rounded-lg px-4 py-2 text-sm font-bold text-[#6B6B6B] hover:bg-[#F0EEE9]">Back</button>
              <button
                disabled={previewMutation.isPending}
                onClick={() => previewMutation.mutate({ csv: csvText, target, mapping })}
                className="inline-flex items-center gap-2 rounded-xl border border-[#D4922A]/40 px-4 py-2 text-sm font-bold text-[#8A5A0B] hover:bg-[#D4922A]/10">
                <RefreshCw className={`h-4 w-4 ${previewMutation.isPending ? "animate-spin" : ""}`} /> Re-check with this mapping
              </button>
            </div>
          </div>

          {preview.sample.length > 0 && (
            <div className="rounded-2xl border border-[rgba(26,26,26,0.1)] bg-white p-5">
              <h2 className="font-bold text-[#1A1A1A]">First rows, as they will be imported</h2>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b text-xs uppercase tracking-wide text-[#6B6B6B]">
                      {Object.keys(preview.sample[0]).map(key => <th key={key} className="py-2 pr-4 font-bold">{key}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.sample.map((row, i) => (
                      <tr key={i} className="border-b last:border-0">
                        {Object.values(row).map((value, j) => <td key={j} className="py-2 pr-4 text-[rgba(26,26,26,0.78)]">{String(value ?? "—")}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {preview.duplicates.length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
              <h2 className="flex items-center gap-2 font-bold text-[#1A1A1A]"><AlertTriangle className="h-4 w-4 text-amber-600" /> {preview.duplicateCount} row{preview.duplicateCount === 1 ? "" : "s"} match clients you already have</h2>
              <ul className="mt-2 space-y-1 text-sm text-[rgba(26,26,26,0.7)]">
                {preview.duplicates.slice(0, 5).map(d => <li key={d.row}>Row {d.row} → already have <strong>{d.existingName}</strong> (same {d.matchedOn})</li>)}
                {preview.duplicateCount > 5 && <li>…and {preview.duplicateCount - 5} more</li>}
              </ul>
              <fieldset className="mt-3">
                <legend className="text-xs font-bold uppercase tracking-wide text-[#6B6B6B]">For those matches:</legend>
                <div className="mt-2 flex flex-wrap gap-4 text-sm">
                  {duplicateOptions.map(([mode, label]) => (
                    <label key={mode} className="inline-flex items-center gap-1.5">
                      <input type="radio" name="duplicateMode" checked={duplicateMode === mode} onChange={() => setDuplicateMode(mode)} className="accent-[#D4922A]" />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
          )}

          {preview.issues.length > 0 && (
            <div className="rounded-2xl border border-[rgba(26,26,26,0.1)] bg-white p-5">
              <h2 className="font-bold text-[#1A1A1A]">{preview.issueCount} row{preview.issueCount === 1 ? "" : "s"} can't be imported</h2>
              <ul className="mt-2 space-y-1 text-sm text-[rgba(26,26,26,0.7)]">
                {preview.issues.slice(0, 6).map(issue => <li key={issue.row}>Row {issue.row}: {issue.errors.join(" ")}</li>)}
                {preview.issueCount > 6 && <li>…and {preview.issueCount - 6} more — they'll be skipped, not imported</li>}
              </ul>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button onClick={reset} className="rounded-lg px-4 py-2 text-sm font-bold text-[#6B6B6B] hover:bg-[#F0EEE9]">Start over</button>
            <button
              disabled={preview.validRows === 0 || commitMutation.isPending}
              onClick={() => commitMutation.mutate({ csv: csvText, target, mapping, duplicateMode })}
              className="gradient-amber inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50">
              {commitMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Import {preview.validRows} row{preview.validRows === 1 ? "" : "s"}
            </button>
          </div>
        </section>
      )}

      {step === "results" && result && (
        <section className="space-y-4">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-6 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
            <h2 className="mt-2 text-xl font-bold text-[#1A1A1A]">Import complete</h2>
            <p className="mt-1 text-sm text-[rgba(26,26,26,0.65)]">Every change is recorded in your audit log under “import”.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-[rgba(26,26,26,0.1)] bg-white p-4"><p className="text-xs font-bold uppercase tracking-wide text-[#6B6B6B]">Created</p><p className="mt-1 text-2xl font-bold text-emerald-700">{result.created}</p></div>
            <div className="rounded-2xl border border-[rgba(26,26,26,0.1)] bg-white p-4"><p className="text-xs font-bold uppercase tracking-wide text-[#6B6B6B]">Updated</p><p className="mt-1 text-2xl font-bold text-[#1A1A1A]">{result.updated}</p></div>
            <div className="rounded-2xl border border-[rgba(26,26,26,0.1)] bg-white p-4"><p className="text-xs font-bold uppercase tracking-wide text-[#6B6B6B]">Skipped</p><p className="mt-1 text-2xl font-bold text-[#1A1A1A]">{result.skipped}</p></div>
          </div>
          {(result.skippedReasons.duplicate > 0 || result.skippedReasons.emailConflict > 0) && (
            <p className="text-center text-xs text-[rgba(26,26,26,0.55)]">
              Skipped because: {result.skippedReasons.duplicate} duplicate{result.skippedReasons.duplicate === 1 ? "" : "s"}
              {result.skippedReasons.emailConflict > 0 ? `, ${result.skippedReasons.emailConflict} email already in use` : ""}
              {result.skippedReasons.nothingToUpdate > 0 ? `, ${result.skippedReasons.nothingToUpdate} with nothing new to add` : ""}.
            </p>
          )}
          {result.failedCount > 0 && (
            <div className="rounded-2xl border border-[rgba(26,26,26,0.1)] bg-white p-5">
              <h3 className="font-bold text-[#1A1A1A]">{result.failedCount} row{result.failedCount === 1 ? "" : "s"} couldn't be imported</h3>
              <ul className="mt-2 space-y-1 text-sm text-[rgba(26,26,26,0.7)]">
                {result.failed.slice(0, 8).map(issue => <li key={issue.row}>Row {issue.row}: {issue.errors.join(" ")}</li>)}
                {result.failedCount > 8 && <li>…and {result.failedCount - 8} more</li>}
              </ul>
            </div>
          )}
          <div className="flex flex-wrap justify-center gap-2">
            <button onClick={reset} className="inline-flex items-center gap-2 rounded-xl border border-[#D4922A]/40 px-4 py-2 text-sm font-bold text-[#8A5A0B] hover:bg-[#D4922A]/10"><RefreshCw className="h-4 w-4" /> Import another file</button>
          </div>
        </section>
      )}
    </div>
  );
}
