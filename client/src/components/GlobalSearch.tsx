/**
 * GlobalSearch — Cmd+K / Ctrl+K command palette
 * Searches clients, invoices, bookings, and contracts in real-time.
 * Keyboard-navigable: ↑/↓ to move, Enter to select, Esc to close.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Search, X, Users, FileText, Calendar, FileSignature, ArrowRight, Loader2, Command, BriefcaseBusiness, UsersRound, MapPin, PlugZap, Webhook, BarChart3 } from "lucide-react";

type SearchResult =
  | { _type: "client"; id: number; name: string; email: string | null; service: string | null; status: string | null }
  | { _type: "invoice"; id: number; invoiceNumber: string; clientName: string; amount: string; status: string; service: string | null }
  | { _type: "booking"; id: number; clientName: string; service: string | null; date: string; time: string; status: string }
  | { _type: "contract"; id: number; title: string; clientName: string; type: string; status: string };

type FlatResult = SearchResult & { _idx: number };

interface GlobalSearchProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (panel: string) => void;
}

const TYPE_META = {
  client:   { icon: Users,          label: "Client",   panel: "clients",    color: "#6366F1" },
  invoice:  { icon: FileText,        label: "Invoice",  panel: "billing",    color: "#D4922A" },
  booking:  { icon: Calendar,        label: "Booking",  panel: "scheduling", color: "#F59E0B" },
  contract: { icon: FileSignature,   label: "Contract", panel: "deals",      color: "#5A9A7A" },
} as const;

function formatAmount(amount: string) {
  const n = parseFloat(amount);
  return isNaN(n) ? amount : `$${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function getResultLabel(r: SearchResult): string {
  if (r._type === "client")   return r.name;
  if (r._type === "invoice")  return `${r.invoiceNumber} — ${r.clientName}`;
  if (r._type === "booking")  return `${r.clientName} · ${r.date} ${r.time}`;
  if (r._type === "contract") return r.title;
  return "";
}

function getResultSub(r: SearchResult): string {
  if (r._type === "client")   return r.service || r.email || "";
  if (r._type === "invoice")  return `${formatAmount(r.amount)} · ${r.status}`;
  if (r._type === "booking")  return `${r.service || "Session"} · ${r.status}`;
  if (r._type === "contract") return `${r.clientName} · ${r.type} · ${r.status}`;
  return "";
}

const STATUS_COLOR: Record<string, string> = {
  active: "#22c55e", paid: "#22c55e", completed: "#22c55e", signed: "#22c55e",
  draft: "#9CA3AF", scheduled: "#6366F1", sent: "#F59E0B",
  overdue: "#EF4444", cancelled: "#EF4444", declined: "#EF4444",
  prospect: "#F59E0B", inactive: "#6B7280",
};

const OPERATIONAL_SHORTCUTS = [
  { panel: "clients", label: "Clients", detail: "CRM and relationships", icon: Users, color: "#6366F1" },
  { panel: "scheduling", label: "Schedule", detail: "Bookings and calendar", icon: Calendar, color: "#D4922A" },
  { panel: "jobs", label: "Jobs", detail: "Work and proof", icon: BriefcaseBusiness, color: "#007A68" },
  { panel: "team", label: "Team", detail: "Capacity and assignments", icon: UsersRound, color: "#7C3AED" },
  { panel: "dispatch", label: "Dispatch", detail: "Service visits", icon: MapPin, color: "#EA580C" },
  { panel: "billing", label: "Billing", detail: "Invoices and time", icon: FileText, color: "#059669" },
  { panel: "insights", label: "Insights", detail: "Signals and reporting", icon: BarChart3, color: "#2563EB" },
  { panel: "integrations", label: "Integrations", detail: "Provider readiness", icon: PlugZap, color: "#0F766E" },
  { panel: "webhooks", label: "Webhooks", detail: "Workflow event bridge", icon: Webhook, color: "#BE123C" },
] as const;

export default function GlobalSearch({ open, onClose, onNavigate }: GlobalSearchProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce query
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 180);
    return () => clearTimeout(t);
  }, [query]);

  // Focus input when opened — store timer in a ref so we can clear it on unmount
  useEffect(() => {
    if (open) {
      setQuery("");
      setDebouncedQuery("");
      setCursor(0);
      focusTimerRef.current = setTimeout(() => inputRef.current?.focus(), 50);
    }
    return () => {
      if (focusTimerRef.current !== null) {
        clearTimeout(focusTimerRef.current);
        focusTimerRef.current = null;
      }
    };
  }, [open]);

  const { data, isFetching, isError } = trpc.search.global.useQuery(
    { query: debouncedQuery },
    { enabled: debouncedQuery.length >= 1, retry: 1 }
  );

  // Flatten results for keyboard navigation
  const flat: FlatResult[] = [];
  if (data && !isError) {
    [...data.clients, ...data.invoices, ...data.bookings, ...data.contracts].forEach((r, i) => {
      flat.push({ ...r, _idx: i } as FlatResult);
    });
  }

  // Clamp cursor
  useEffect(() => {
    if (cursor >= flat.length && flat.length > 0) setCursor(flat.length - 1);
  }, [flat.length, cursor]);

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${cursor}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  const handleSelect = useCallback((r: SearchResult) => {
    onNavigate(TYPE_META[r._type].panel);
    onClose();
  }, [onNavigate, onClose]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { onClose(); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setCursor(c => Math.min(c + 1, flat.length - 1)); return; }
    if (e.key === "ArrowUp")   { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)); return; }
    if (e.key === "Enter" && flat[cursor]) { handleSelect(flat[cursor]); return; }
  };

  if (!open) return null;

  const hasResults = flat.length > 0;
  const showEmpty = debouncedQuery.length >= 1 && !isFetching && !hasResults;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center pt-[12vh] px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Global search"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className="relative w-full max-w-xl rounded-2xl overflow-hidden shadow-2xl border border-[#DDDBD7] search-modal-enter"
        style={{ background: "#FFFFFF" }}
      >
        {/* Search input row */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#DDDBD7]">
          {isFetching
            ? <Loader2 className="w-4 h-4 text-[#D4922A] animate-spin flex-shrink-0" />
            : <Search className="w-4 h-4 text-[rgba(26,26,26,0.70)] flex-shrink-0" />
          }
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setCursor(0); }}
            onKeyDown={handleKeyDown}
            placeholder="Search records or jump to an operation…"
            className="flex-1 bg-transparent text-[#1A1A1A] placeholder-[rgba(26,26,26,0.60)] text-sm outline-none"
            autoComplete="off"
            spellCheck={false}
          />
          {query && (
            <button onClick={() => { setQuery(""); setDebouncedQuery(""); inputRef.current?.focus(); }} className="p-1 rounded hover:bg-white/10 transition-colors" aria-label="Clear search">
              <X className="w-3.5 h-3.5 text-[rgba(26,26,26,0.70)]" />
            </button>
          )}
          <kbd className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-[#C8C5BF] text-[10px] text-[rgba(26,26,26,0.60)] font-mono">
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[400px] overflow-y-auto">
          {!debouncedQuery && (
            <div className="px-4 py-6">
              <div className="w-10 h-10 rounded-xl bg-[#D4922A]/10 flex items-center justify-center mx-auto mb-3">
                <Command className="w-5 h-5 text-[#D4922A]" />
              </div>
              <p className="text-center text-sm font-medium text-[rgba(26,26,26,0.72)]">Find a record or jump into an operation</p>
              <p className="mt-1 text-center text-xs text-[rgba(26,26,26,0.60)]">Search clients, invoices, bookings, and contracts—or use a workflow shortcut.</p>
              <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {OPERATIONAL_SHORTCUTS.map(shortcut => {
                  const Icon = shortcut.icon;
                  return <button key={shortcut.panel} type="button" onClick={() => { onNavigate(shortcut.panel); onClose(); }} className="flex min-h-16 items-center gap-2.5 rounded-xl border border-[#E7E5E4] bg-[#FCFCFB] p-3 text-left transition hover:border-[#D4922A]/40 hover:bg-[#FFF9EF] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00A88F]">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: `${shortcut.color}16`, color: shortcut.color }}><Icon className="h-4 w-4" aria-hidden="true" /></span>
                    <span className="min-w-0"><span className="block truncate text-xs font-bold text-[#1A1A1A]">{shortcut.label}</span><span className="mt-0.5 block truncate text-[10px] text-[#666]">{shortcut.detail}</span></span>
                  </button>;
                })}
              </div>
            </div>
          )}

          {showEmpty && (
            <div className="py-10 text-center">
              <Search className="w-8 h-8 text-[rgba(26,26,26,0.20)] mx-auto mb-2" />
              <p className="text-sm text-[rgba(26,26,26,0.70)]">No results for "<span className="text-[#1A1A1A]">{debouncedQuery}</span>"</p>
            </div>
          )}

          {hasResults && (
            <div className="py-1">
              {(["client", "invoice", "booking", "contract"] as const).map(type => {
                const group = flat.filter(r => r._type === type);
                if (!group.length) return null;
                const meta = TYPE_META[type];
                return (
                  <div key={type}>
                    <div className="px-4 py-1.5 flex items-center gap-2">
                      <meta.icon className="w-3 h-3" style={{ color: meta.color }} />
                      <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: meta.color }}>{meta.label}s</span>
                    </div>
                    {group.map(r => {
                      const isActive = r._idx === cursor;
                      const label = getResultLabel(r);
                      const sub = getResultSub(r);
                      const statusVal = (r as any).status as string | undefined;
                      return (
                        <button
                          key={`${r._type}-${r.id}`}
                          data-idx={r._idx}
                          onClick={() => handleSelect(r)}
                          onMouseEnter={() => setCursor(r._idx)}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${isActive ? "bg-[#D4922A]/12" : "hover:bg-white/5"}`}
                        >
                          <div
                            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: `${meta.color}18` }}
                          >
                            <meta.icon className="w-3.5 h-3.5" style={{ color: meta.color }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-[#1A1A1A] truncate">{label}</p>
                            {sub && (
                              <p className="text-xs text-[rgba(26,26,26,0.70)] truncate flex items-center gap-1.5">
                                {statusVal && (
                                  <span className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: STATUS_COLOR[statusVal] || "#9CA3AF" }} />
                                )}
                                {sub}
                              </p>
                            )}
                          </div>
                          {isActive && <ArrowRight className="w-3.5 h-3.5 text-[#D4922A] flex-shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer hints */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-white/6">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-[10px] text-[rgba(26,26,26,0.60)]">
              <kbd className="px-1 py-0.5 rounded border border-[#C8C5BF] font-mono text-[9px]">↑↓</kbd> navigate
            </span>
            <span className="flex items-center gap-1 text-[10px] text-[rgba(26,26,26,0.60)]">
              <kbd className="px-1 py-0.5 rounded border border-[#C8C5BF] font-mono text-[9px]">↵</kbd> open panel
            </span>
          </div>
          {data && data.total > 0 && (
            <span className="text-[10px] text-[rgba(26,26,26,0.60)]">{data.total} result{data.total !== 1 ? "s" : ""}</span>
          )}
        </div>
      </div>
    </div>
  );
}
