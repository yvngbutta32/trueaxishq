/**
 * IntakeFormsPanel — Questionnaire & Intake Form Builder
 * Lives inside OutreachPanel as the "Intake Forms" tab.
 * Features:
 *  - Create/edit/delete forms with a drag-free field builder
 *  - Copy public link to clipboard
 *  - View responses with "Convert to Client" action
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Plus, Trash2, Copy, ExternalLink, ChevronDown, ChevronRight,
  Users, Eye, X, Save, ToggleLeft, ToggleRight, ClipboardList,
  UserPlus, Mail, Phone, AlignLeft, List, CheckSquare, Hash, Calendar,
} from "lucide-react";

type FieldType = "text" | "textarea" | "email" | "phone" | "select" | "checkbox" | "date" | "number";

interface FormField {
  id: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[];
}

const FIELD_TYPES: { type: FieldType; label: string; icon: React.ElementType }[] = [
  { type: "text", label: "Short Text", icon: AlignLeft },
  { type: "textarea", label: "Long Text", icon: AlignLeft },
  { type: "email", label: "Email", icon: Mail },
  { type: "phone", label: "Phone", icon: Phone },
  { type: "number", label: "Number", icon: Hash },
  { type: "date", label: "Date", icon: Calendar },
  { type: "select", label: "Dropdown", icon: List },
  { type: "checkbox", label: "Checkbox", icon: CheckSquare },
];

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

export default function IntakeFormsPanel() {
  const utils = trpc.useUtils();
  const { data: forms = [], isLoading } = trpc.intake.listForms.useQuery();
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [viewingResponsesId, setViewingResponsesId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Form builder state
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [fields, setFields] = useState<FormField[]>([]);

  const createForm = trpc.intake.createForm.useMutation({
    onSuccess: () => {
      utils.intake.listForms.invalidate();
      toast.success("Form created!");
      resetBuilder();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateForm = trpc.intake.updateForm.useMutation({
    onSuccess: () => {
      utils.intake.listForms.invalidate();
      toast.success("Form updated!");
      resetBuilder();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteForm = trpc.intake.deleteForm.useMutation({
    onSuccess: () => {
      utils.intake.listForms.invalidate();
      toast.success("Form deleted.");
    },
    onError: (e) => toast.error(e.message),
  });

  const toggleActive = trpc.intake.updateForm.useMutation({
    onSuccess: () => utils.intake.listForms.invalidate(),
    onError: (e) => toast.error(e.message),
  });

  function resetBuilder() {
    setFormName("");
    setFormDesc("");
    setFields([]);
    setShowCreate(false);
    setEditingId(null);
  }

  function startEdit(form: typeof forms[0]) {
    setEditingId(form.id);
    setFormName(form.name);
    setFormDesc(form.description ?? "");
    try {
      setFields(JSON.parse(form.fields));
    } catch {
      setFields([]);
    }
    setShowCreate(true);
  }

  function addField(type: FieldType) {
    setFields(prev => [...prev, {
      id: genId(),
      type,
      label: FIELD_TYPES.find(f => f.type === type)?.label ?? type,
      placeholder: "",
      required: false,
      options: type === "select" ? ["Option 1", "Option 2"] : undefined,
    }]);
  }

  function updateField(id: string, patch: Partial<FormField>) {
    setFields(prev => prev.map(f => f.id === id ? { ...f, ...patch } : f));
  }

  function removeField(id: string) {
    setFields(prev => prev.filter(f => f.id !== id));
  }

  function handleSave() {
    if (!formName.trim()) { toast.error("Form name is required."); return; }
    if (editingId) {
      updateForm.mutate({ id: editingId, name: formName, description: formDesc, fields });
    } else {
      createForm.mutate({ name: formName, description: formDesc, fields });
    }
  }

  function copyLink(slug: string) {
    const url = `${window.location.origin}/intake/${slug}`;
    navigator.clipboard.writeText(url)
      .then(() => toast.success("Public form link copied!"))
      .catch(() => toast.info(`Link: ${url}`));
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-[#1A1A1A]">Intake Forms</h2>
          <p className="text-sm text-[rgba(26,26,26,0.55)]">Build questionnaires for new client onboarding</p>
        </div>
        <Button
          size="sm"
          className="gradient-amber text-white border-0 hover:opacity-90 gap-1.5"
          onClick={() => { resetBuilder(); setShowCreate(true); }}
        >
          <Plus className="w-3.5 h-3.5" />New Form
        </Button>
      </div>

      {/* Form Builder */}
      {showCreate && (
        <div className="bg-white border border-[#DDDBD7] rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-[#1A1A1A]">{editingId ? "Edit Form" : "New Intake Form"}</h3>
            <button onClick={resetBuilder} className="text-[rgba(26,26,26,0.4)] hover:text-[#1A1A1A] transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[rgba(26,26,26,0.6)] mb-1.5">Form Name *</label>
              <input
                value={formName}
                onChange={e => setFormName(e.target.value)}
                placeholder="e.g. New Client Questionnaire"
                className="form-input-light w-full"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[rgba(26,26,26,0.6)] mb-1.5">Description (optional)</label>
              <input
                value={formDesc}
                onChange={e => setFormDesc(e.target.value)}
                placeholder="Brief description shown to respondents"
                className="form-input-light w-full"
              />
            </div>
          </div>

          {/* Fields */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-[rgba(26,26,26,0.7)]">Fields ({fields.length})</span>
            </div>

            {fields.length === 0 && (
              <div className="text-center py-6 text-sm text-[rgba(26,26,26,0.60)] border border-dashed border-[#DDDBD7] rounded-xl">
                Add fields below to build your form
              </div>
            )}

            {fields.map((field, idx) => (
              <div key={field.id} className="bg-[#F7F6F3] rounded-xl p-3 border border-[#DDDBD7] space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-[rgba(26,26,26,0.60)] w-5 text-center">{idx + 1}</span>
                  <select
                    value={field.type}
                    onChange={e => updateField(field.id, { type: e.target.value as FieldType })}
                    className="form-input-light text-xs py-1 px-2 flex-shrink-0"
                  >
                    {FIELD_TYPES.map(ft => <option key={ft.type} value={ft.type}>{ft.label}</option>)}
                  </select>
                  <input
                    value={field.label}
                    onChange={e => updateField(field.id, { label: e.target.value })}
                    placeholder="Field label"
                    className="form-input-light text-xs py-1 flex-1"
                  />
                  <label className="flex items-center gap-1 text-xs text-[rgba(26,26,26,0.5)] cursor-pointer flex-shrink-0">
                    <input
                      type="checkbox"
                      checked={field.required}
                      onChange={e => updateField(field.id, { required: e.target.checked })}
                      className="w-3 h-3"
                    />
                    Required
                  </label>
                  <button onClick={() => removeField(field.id)} className="text-[rgba(26,26,26,0.3)] hover:text-red-400 transition-colors flex-shrink-0">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                {field.type === "select" && (
                  <div className="ml-7">
                    <label className="block text-[10px] text-[rgba(26,26,26,0.70)] mb-1">Options (one per line)</label>
                    <textarea
              maxLength={5000}
                      value={(field.options ?? []).join("\n")}
                      onChange={e => updateField(field.id, { options: e.target.value.split("\n").filter(Boolean) })}
                      rows={3}
                      className="form-input-light text-xs w-full"
                      placeholder="Option 1&#10;Option 2&#10;Option 3"
                    />
                  </div>
                )}
              </div>
            ))}

            {/* Add field buttons */}
            <div className="flex flex-wrap gap-2">
              {FIELD_TYPES.map(ft => (
                <button
                  key={ft.type}
                  onClick={() => addField(ft.type)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-[rgba(26,26,26,0.6)] hover:text-[#1A1A1A] transition-all border border-[#DDDBD7]"
                >
                  <ft.icon className="w-3 h-3" />
                  {ft.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-2 border-t border-[#DDDBD7]">
            <Button size="sm" variant="outline" onClick={resetBuilder}>Cancel</Button>
            <Button
              size="sm"
              className="gradient-amber text-white border-0 hover:opacity-90 gap-1.5"
              onClick={handleSave}
              disabled={createForm.isPending || updateForm.isPending}
            >
              <Save className="w-3.5 h-3.5" />
              {createForm.isPending || updateForm.isPending ? "Saving…" : "Save Form"}
            </Button>
          </div>
        </div>
      )}

      {/* Forms list */}
      {forms.length === 0 && !showCreate ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-[#DDDBD7]">
          <ClipboardList className="w-10 h-10 text-[rgba(26,26,26,0.2)] mx-auto mb-3" />
          <p className="text-sm font-semibold text-[rgba(26,26,26,0.5)]">No intake forms yet</p>
          <p className="text-xs text-[rgba(26,26,26,0.3)] mt-1 mb-4">Create your first questionnaire to collect client info</p>
          <Button size="sm" className="gradient-amber text-white border-0" onClick={() => setShowCreate(true)}>
            <Plus className="w-3.5 h-3.5 mr-1.5" />Create First Form
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {forms.map(form => {
            let fieldCount = 0;
            try { fieldCount = JSON.parse(form.fields).length; } catch {}
            const isExpanded = expandedId === form.id;
            return (
              <div key={form.id} className="bg-white border border-[#DDDBD7] rounded-2xl overflow-hidden">
                <div
                  className="flex items-center gap-3 p-4 cursor-pointer hover:bg-white/3 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : form.id)}
                >
                  <div className="w-9 h-9 rounded-xl bg-[#D4922A]/15 flex items-center justify-center flex-shrink-0">
                    <ClipboardList className="w-4.5 h-4.5 text-[#D4922A]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-[#1A1A1A] truncate">{form.name}</span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 border-0 ${form.active ? "bg-emerald-500/15 text-emerald-400" : "bg-white/8 text-[rgba(26,26,26,0.4)]"}`}
                      >
                        {form.active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <div className="text-xs text-[rgba(26,26,26,0.70)] mt-0.5">
                      {fieldCount} field{fieldCount !== 1 ? "s" : ""}
                      {form.description && ` · ${form.description}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => toggleActive.mutate({ id: form.id, active: !form.active })}
                      className="text-[rgba(26,26,26,0.4)] hover:text-[#1A1A1A] transition-colors p-1"
                      title={form.active ? "Deactivate" : "Activate"}
                    >
                      {form.active ? <ToggleRight className="w-4 h-4 text-emerald-400" /> : <ToggleLeft className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => form.publicSlug && copyLink(form.publicSlug)}
                      className="text-[rgba(26,26,26,0.4)] hover:text-[#1A1A1A] transition-colors p-1"
                      title="Copy public link"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    {form.publicSlug && (
                      <a
                        href={`/intake/${form.publicSlug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[rgba(26,26,26,0.4)] hover:text-[#1A1A1A] transition-colors p-1"
                        title="Preview form"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                    <button
                      onClick={() => setViewingResponsesId(viewingResponsesId === form.id ? null : form.id)}
                      className="text-[rgba(26,26,26,0.4)] hover:text-[#1A1A1A] transition-colors p-1"
                      title="View responses"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => startEdit(form)}
                      className="text-[rgba(26,26,26,0.4)] hover:text-[#1A1A1A] transition-colors p-1"
                      title="Edit form"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => deleteForm.mutate({ id: form.id })}
                      className="text-[rgba(26,26,26,0.3)] hover:text-red-400 transition-colors p-1"
                      title="Delete form"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {isExpanded ? <ChevronDown className="w-4 h-4 text-[rgba(26,26,26,0.4)] flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-[rgba(26,26,26,0.4)] flex-shrink-0" />}
                </div>

                {/* Responses panel */}
                {viewingResponsesId === form.id && (
                  <ResponsesView formId={form.id} formFields={form.fields} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ResponsesView({ formId, formFields }: { formId: number; formFields: string }) {
  const utils = trpc.useUtils();
  const { data: responses = [], isLoading } = trpc.intake.getResponses.useQuery({ formId });
  const createClient = trpc.clients.create.useMutation({
    onSuccess: () => {
      utils.clients.list.invalidate();
      toast.success("Client created from intake response!");
    },
    onError: (e) => toast.error(e.message),
  });

  let parsedFields: FormField[] = [];
  try { parsedFields = JSON.parse(formFields); } catch {}

  const emailField = parsedFields.find(f => f.type === "email");
  const phoneField = parsedFields.find(f => f.type === "phone");

  function convertToClient(response: typeof responses[0]) {
    let answers: Record<string, string> = {};
    try { answers = JSON.parse(response.answers); } catch {}
    const email = emailField ? answers[emailField.id] : response.respondentEmail;
    const phone = phoneField ? answers[phoneField.id] : undefined;
    createClient.mutate({
      name: response.respondentName || "Intake Respondent",
      email: email || undefined,
      phone: phone || undefined,
      notes: `Converted from intake form response on ${new Date(response.createdAt).toLocaleDateString()}`,
      status: "prospect",
    });
  }

  if (isLoading) return <div className="px-4 pb-4"><Skeleton className="h-20 rounded-xl" /></div>;

  return (
    <div className="border-t border-[#DDDBD7] px-4 pb-4 pt-3 space-y-3">
      <div className="flex items-center gap-2">
        <Users className="w-3.5 h-3.5 text-[rgba(26,26,26,0.4)]" />
        <span className="text-xs font-semibold text-[rgba(26,26,26,0.6)]">{responses.length} Response{responses.length !== 1 ? "s" : ""}</span>
      </div>
      {responses.length === 0 ? (
        <p className="text-xs text-[rgba(26,26,26,0.3)] text-center py-3">No responses yet. Share the public link to collect responses.</p>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {responses.map(r => {
            let answers: Record<string, string> = {};
            try { answers = JSON.parse(r.answers); } catch {}
            return (
              <div key={r.id} className="bg-[#F7F6F3] rounded-xl p-3 border border-[#EEECEA]">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="text-xs font-semibold text-[#1A1A1A]">{r.respondentName || "Anonymous"}</span>
                    {r.respondentEmail && <span className="text-[10px] text-[rgba(26,26,26,0.70)] ml-2">{r.respondentEmail}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[rgba(26,26,26,0.60)]">{new Date(r.createdAt).toLocaleDateString()}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-[10px] px-2 gap-1"
                      onClick={() => convertToClient(r)}
                      disabled={createClient.isPending}
                    >
                      <UserPlus className="w-3 h-3" />Convert to Client
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {parsedFields.slice(0, 4).map(f => (
                    <div key={f.id} className="text-[10px]">
                      <span className="text-[rgba(26,26,26,0.4)]">{f.label}: </span>
                      <span className="text-[rgba(26,26,26,0.7)]">{answers[f.id] || "—"}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
