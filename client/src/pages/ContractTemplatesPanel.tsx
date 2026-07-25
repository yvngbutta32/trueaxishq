/**
 * ContractTemplatesPanel — Contract Template Library
 * Lives inside DealsPanel as the "Templates" tab.
 * Features:
 *  - 10 built-in templates auto-seeded on first load
 *  - Create / edit / delete custom templates
 *  - Preview template body
 *  - "Use Template" → opens a fill-in dialog and creates a new contract
 */
import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Plus, Trash2, Eye, X, Save, FileSignature, Edit2,
  ChevronRight, Sparkles, Copy, BookOpen,
} from "lucide-react";

const CATEGORIES = ["All", "Web Development", "Design", "Marketing", "Photography", "Consulting", "Video", "Writing", "Admin", "Other"];

export default function ContractTemplatesPanel() {
  const utils = trpc.useUtils();
  const { data: templates = [], isLoading } = trpc.contractTemplates.list.useQuery();
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [previewId, setPreviewId] = useState<number | null>(null);
  const [useTemplateId, setUseTemplateId] = useState<number | null>(null);

  // Form state
  const [tplName, setTplName] = useState("");
  const [tplCategory, setTplCategory] = useState("");
  const [tplBody, setTplBody] = useState("");

  // Use-template fill-in state
  const [fillClientName, setFillClientName] = useState("");
  const [fillYourName, setFillYourName] = useState("");
  const [fillDate, setFillDate] = useState(new Date().toISOString().split("T")[0]);

  // Seed built-in templates on first load
  const seedMutation = trpc.contractTemplates.seedBuiltIn.useMutation({
    onSuccess: (data) => {
      if (data.seeded > 0) {
        utils.contractTemplates.list.invalidate();
        toast.success(`Loaded ${data.seeded} built-in contract templates!`);
      }
    },
    onError: (e) => toast.error("Failed to load templates: " + e.message),
  });

  useEffect(() => {
    if (!isLoading && templates.length === 0) {
      seedMutation.mutate();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, templates.length]);

  const createTemplate = trpc.contractTemplates.create.useMutation({
    onSuccess: () => { utils.contractTemplates.list.invalidate(); toast.success("Template created!"); resetForm(); },
    onError: (e) => toast.error(e.message),
  });

  const updateTemplate = trpc.contractTemplates.update.useMutation({
    onSuccess: () => { utils.contractTemplates.list.invalidate(); toast.success("Template updated!"); resetForm(); },
    onError: (e) => toast.error(e.message),
  });

  const deleteTemplate = trpc.contractTemplates.delete.useMutation({
    onSuccess: () => { utils.contractTemplates.list.invalidate(); toast.success("Template deleted."); },
    onError: (e) => toast.error(e.message),
  });

  const applyTemplate = trpc.contractTemplates.applyToContract.useMutation({
    onSuccess: (data) => {
      navigator.clipboard.writeText(data.body)
        .then(() => toast.success("Contract text copied to clipboard! Paste it into a new contract."))
        .catch(() => toast.info("Template applied — copy the text from the preview."));
      setUseTemplateId(null);
    },
    onError: (e) => toast.error(e.message),
  });

  function resetForm() {
    setTplName(""); setTplCategory(""); setTplBody("");
    setShowCreate(false); setEditingId(null);
  }

  function startEdit(t: typeof templates[0]) {
    setEditingId(t.id);
    setTplName(t.name);
    setTplCategory(t.category ?? "");
    setTplBody(t.body);
    setShowCreate(true);
  }

  function handleSave() {
    if (!tplName.trim()) { toast.error("Template name is required."); return; }
    if (!tplBody.trim()) { toast.error("Template body is required."); return; }
    if (editingId) {
      updateTemplate.mutate({ id: editingId, name: tplName, category: tplCategory || undefined, body: tplBody });
    } else {
      createTemplate.mutate({ name: tplName, category: tplCategory || undefined, body: tplBody });
    }
  }

  function handleUseTemplate() {
    if (!useTemplateId) return;
    applyTemplate.mutate({
      templateId: useTemplateId,
      clientName: fillClientName || undefined,
      yourName: fillYourName || undefined,
      date: fillDate || undefined,
    });
  }

  const filtered = templates.filter(t =>
    categoryFilter === "All" || t.category === categoryFilter
  );

  const previewTemplate = templates.find(t => t.id === previewId);
  const useTemplate = templates.find(t => t.id === useTemplateId);

  if (isLoading || seedMutation.isPending) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 rounded-xl" />
        {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-[#1A1A1A]">Contract Templates</h2>
          <p className="text-sm text-[rgba(26,26,26,0.55)]">{templates.length} templates · click "Use" to apply to a new contract</p>
        </div>
        <Button
          size="sm"
          className="gradient-amber text-white border-0 hover:opacity-90 gap-1.5"
          onClick={() => { resetForm(); setShowCreate(true); }}
        >
          <Plus className="w-3.5 h-3.5" />New Template
        </Button>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 flex-wrap">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
              categoryFilter === cat
                ? "bg-[#D4922A] text-white"
                : "bg-white/5 text-[rgba(26,26,26,0.5)] hover:bg-white/10 hover:text-[#1A1A1A]"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Template editor */}
      {showCreate && (
        <div className="bg-white border border-[#DDDBD7] rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-[#1A1A1A]">{editingId ? "Edit Template" : "New Contract Template"}</h3>
            <button onClick={resetForm} className="text-[rgba(26,26,26,0.4)] hover:text-[#1A1A1A]"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[rgba(26,26,26,0.6)] mb-1.5">Template Name *</label>
              <input value={tplName} onChange={e => setTplName(e.target.value)} placeholder="e.g. Web Development Agreement" className="form-input-light w-full" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[rgba(26,26,26,0.6)] mb-1.5">Category</label>
              <select value={tplCategory} onChange={e => setTplCategory(e.target.value)} className="form-input-light w-full">
                <option value="">Select category…</option>
                {CATEGORIES.slice(1).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[rgba(26,26,26,0.6)] mb-1.5">
              Contract Body *
              <span className="ml-2 text-[rgba(26,26,26,0.60)] font-normal">Use [CLIENT NAME], [YOUR NAME], [DATE] as placeholders</span>
            </label>
            <textarea
              maxLength={50000}
              value={tplBody}
              onChange={e => setTplBody(e.target.value)}
              rows={14}
              className="form-input-light w-full font-mono text-xs"
              placeholder="Paste or write your contract template here…"
            />
          </div>
          <div className="flex gap-2 justify-end pt-2 border-t border-[#DDDBD7]">
            <Button size="sm" variant="outline" onClick={resetForm}>Cancel</Button>
            <Button size="sm" className="gradient-amber text-white border-0 hover:opacity-90 gap-1.5" onClick={handleSave} disabled={createTemplate.isPending || updateTemplate.isPending}>
              <Save className="w-3.5 h-3.5" />{createTemplate.isPending || updateTemplate.isPending ? "Saving…" : "Save Template"}
            </Button>
          </div>
        </div>
      )}

      {/* Use Template dialog */}
      {useTemplateId && useTemplate && (
        <div className="bg-white border border-[#D4922A]/30 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#D4922A]" />
              <h3 className="font-bold text-[#1A1A1A]">Apply Template: {useTemplate.name}</h3>
            </div>
            <button onClick={() => setUseTemplateId(null)} className="text-[rgba(26,26,26,0.4)] hover:text-[#1A1A1A]"><X className="w-4 h-4" /></button>
          </div>
          <p className="text-xs text-[rgba(26,26,26,0.5)]">Fill in the placeholders below. The filled contract text will be copied to your clipboard.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[rgba(26,26,26,0.6)] mb-1.5">Client Name</label>
              <input value={fillClientName} onChange={e => setFillClientName(e.target.value)} placeholder="[CLIENT NAME]" className="form-input-light w-full" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[rgba(26,26,26,0.6)] mb-1.5">Your Name</label>
              <input value={fillYourName} onChange={e => setFillYourName(e.target.value)} placeholder="[YOUR NAME]" className="form-input-light w-full" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[rgba(26,26,26,0.6)] mb-1.5">Date</label>
              <input type="date" value={fillDate} onChange={e => setFillDate(e.target.value)} className="form-input-light w-full" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="outline" onClick={() => setUseTemplateId(null)}>Cancel</Button>
            <Button size="sm" className="gradient-amber text-white border-0 hover:opacity-90 gap-1.5" onClick={handleUseTemplate} disabled={applyTemplate.isPending}>
              <Copy className="w-3.5 h-3.5" />{applyTemplate.isPending ? "Applying…" : "Copy to Clipboard"}
            </Button>
          </div>
        </div>
      )}

      {/* Preview dialog */}
      {previewId && previewTemplate && (
        <div className="bg-white border border-[#DDDBD7] rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[rgba(26,26,26,0.5)]" />
              <h3 className="font-bold text-[#1A1A1A]">{previewTemplate.name}</h3>
              {previewTemplate.category && <Badge variant="outline" className="text-[10px] border-[#C8C5BF] text-[rgba(26,26,26,0.4)]">{previewTemplate.category}</Badge>}
            </div>
            <button onClick={() => setPreviewId(null)} className="text-[rgba(26,26,26,0.4)] hover:text-[#1A1A1A]"><X className="w-4 h-4" /></button>
          </div>
          <pre className="text-xs text-[rgba(26,26,26,0.7)] whitespace-pre-wrap font-mono bg-[#F7F6F3] rounded-xl p-4 max-h-80 overflow-y-auto border border-[#EEECEA]">
            {previewTemplate.body}
          </pre>
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(previewTemplate.body); toast.success("Copied!"); }}>
              <Copy className="w-3.5 h-3.5 mr-1.5" />Copy Raw
            </Button>
            <Button size="sm" className="gradient-amber text-white border-0 hover:opacity-90 gap-1.5" onClick={() => { setPreviewId(null); setUseTemplateId(previewTemplate.id); }}>
              <Sparkles className="w-3.5 h-3.5" />Use Template
            </Button>
          </div>
        </div>
      )}

      {/* Templates list */}
      {filtered.length === 0 ? (
        <div className="text-center py-10 bg-white rounded-2xl border border-[#DDDBD7]">
          <FileSignature className="w-10 h-10 text-[rgba(26,26,26,0.2)] mx-auto mb-3" />
          <p className="text-sm text-[rgba(26,26,26,0.4)]">No templates in this category</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(t => (
            <div key={t.id} className="bg-white border border-[#DDDBD7] rounded-xl flex items-center gap-3 px-4 py-3 hover:border-[#C8C5BF] transition-all group">
              <div className="w-8 h-8 rounded-lg bg-[#D4922A]/12 flex items-center justify-center flex-shrink-0">
                <FileSignature className="w-4 h-4 text-[#D4922A]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-[#1A1A1A] truncate">{t.name}</span>
                  {t.isBuiltIn && (
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-[#D4922A]/30 text-[#D4922A] bg-[#D4922A]/8 flex-shrink-0">
                      Built-in
                    </Badge>
                  )}
                  {t.category && (
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-[#DDDBD7] text-[rgba(26,26,26,0.4)] flex-shrink-0">
                      {t.category}
                    </Badge>
                  )}
                </div>
                <p className="text-[10px] text-[rgba(26,26,26,0.60)] mt-0.5 truncate">
                  {t.body.slice(0, 80)}…
                </p>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                <button onClick={() => setPreviewId(t.id)} className="p-1.5 rounded-lg hover:bg-[#EEECEA] text-[rgba(26,26,26,0.4)] hover:text-[#1A1A1A] transition-colors" title="Preview">
                  <Eye className="w-3.5 h-3.5" />
                </button>
                {!t.isBuiltIn && (
                  <button onClick={() => startEdit(t)} className="p-1.5 rounded-lg hover:bg-[#EEECEA] text-[rgba(26,26,26,0.4)] hover:text-[#1A1A1A] transition-colors" title="Edit">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => { setUseTemplateId(t.id); setPreviewId(null); }}
                  className="px-2.5 py-1 rounded-lg bg-[#D4922A]/15 text-[#D4922A] hover:bg-[#D4922A]/25 text-xs font-semibold transition-colors flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3" />Use
                </button>
                {!t.isBuiltIn && (
                  <button onClick={() => deleteTemplate.mutate({ id: t.id })} className="p-1.5 rounded-lg hover:bg-red-500/10 text-[rgba(26,26,26,0.3)] hover:text-red-400 transition-colors" title="Delete">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <ChevronRight className="w-4 h-4 text-[rgba(26,26,26,0.2)] flex-shrink-0 group-hover:text-[rgba(26,26,26,0.4)] transition-colors" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
