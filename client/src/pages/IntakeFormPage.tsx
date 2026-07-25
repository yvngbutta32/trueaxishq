/**
 * IntakeFormPage — Public form submission page
 * Route: /intake/:slug
 * Accessible without authentication.
 */
import { useState } from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle, ClipboardList } from "lucide-react";

type FieldType = "text" | "textarea" | "email" | "phone" | "select" | "checkbox" | "date" | "number";

interface FormField {
  id: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[];
}

export default function IntakeFormPage() {
  const { slug } = useParams<{ slug: string }>();
  const [submitted, setSubmitted] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [respondentName, setRespondentName] = useState("");
  const [respondentEmail, setRespondentEmail] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const { data: formData, isLoading, isError } = trpc.intake.getPublicForm.useQuery(
    { slug: slug ?? "" },
    { enabled: !!slug, retry: false }
  );

  const submitMutation = trpc.intake.submitResponse.useMutation({
    onSuccess: () => setSubmitted(true),
    onError: (e) => setFieldErrors({ _form: e.message }),
  });

  let parsedFields: FormField[] = [];
  if (formData) {
    try { parsedFields = JSON.parse(formData.fields ?? "[]"); } catch {}
  }

  function validate() {
    const errs: Record<string, string> = {};
    if (!respondentName.trim()) errs["_name"] = "Your name is required.";
    for (const field of parsedFields) {
      if (field.required && !answers[field.id]?.trim()) {
        errs[field.id] = `${field.label} is required.`;
      }
      if (field.type === "email" && answers[field.id] && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(answers[field.id])) {
        errs[field.id] = "Please enter a valid email address.";
      }
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    submitMutation.mutate({
      slug: slug ?? "",
      respondentName: respondentName.trim(),
      respondentEmail: respondentEmail.trim() || undefined,
      answers,
    });
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#F2F0EC] flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-[#1A1A1A] mb-2">Thank you!</h1>
          <p className="text-sm text-[rgba(26,26,26,0.55)]">Your response has been submitted. We'll be in touch soon.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F2F0EC] flex items-center justify-center p-4">
        <div className="max-w-lg w-full space-y-4">
          <Skeleton className="h-8 w-48 mx-auto" />
          <Skeleton className="h-4 w-64 mx-auto" />
          {[0, 1, 2].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (isError || !formData) {
    return (
      <div className="min-h-screen bg-[#F2F0EC] flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <ClipboardList className="w-12 h-12 text-[rgba(26,26,26,0.2)] mx-auto mb-4" />
          <h1 className="text-xl font-bold text-[#1A1A1A] mb-2">Form Not Available</h1>
          <p className="text-sm text-[rgba(26,26,26,0.5)]">This form is no longer active or does not exist.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F2F0EC] flex items-center justify-center p-4">
      <div className="max-w-lg w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-[#D4922A]/15 flex items-center justify-center mx-auto mb-4">
            <ClipboardList className="w-6 h-6 text-[#D4922A]" />
          </div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">{formData.name}</h1>
          {formData.description && (
            <p className="text-sm text-[rgba(26,26,26,0.55)] mt-2">{formData.description}</p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-[#DDDBD7] p-6 space-y-5">
          {fieldErrors._form && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-sm text-red-400">{fieldErrors._form}</div>
          )}

          {/* Respondent info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[rgba(26,26,26,0.6)] mb-1.5">Your Name *</label>
              <input
                value={respondentName}
                onChange={e => setRespondentName(e.target.value)}
                placeholder="Full name"
                className="form-input-light w-full"
              />
              {fieldErrors._name && <p className="text-[10px] text-red-400 mt-1">{fieldErrors._name}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-[rgba(26,26,26,0.6)] mb-1.5">Email (optional)</label>
              <input
                type="email"
                value={respondentEmail}
                onChange={e => setRespondentEmail(e.target.value)}
                placeholder="your@email.com"
                className="form-input-light w-full"
              />
            </div>
          </div>

          {/* Dynamic fields */}
          {parsedFields.map(field => (
            <div key={field.id}>
              <label className="block text-xs font-semibold text-[rgba(26,26,26,0.6)] mb-1.5">
                {field.label}{field.required && <span className="text-red-400 ml-0.5">*</span>}
              </label>
              {field.type === "textarea" ? (
                <textarea
              maxLength={5000}
                  value={answers[field.id] ?? ""}
                  onChange={e => setAnswers(prev => ({ ...prev, [field.id]: e.target.value }))}
                  placeholder={field.placeholder}
                  rows={4}
                  className="form-input-light w-full"
                />
              ) : field.type === "select" ? (
                <select
                  value={answers[field.id] ?? ""}
                  onChange={e => setAnswers(prev => ({ ...prev, [field.id]: e.target.value }))}
                  className="form-input-light w-full"
                >
                  <option value="">Select an option…</option>
                  {(field.options ?? []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              ) : field.type === "checkbox" ? (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={answers[field.id] === "true"}
                    onChange={e => setAnswers(prev => ({ ...prev, [field.id]: e.target.checked ? "true" : "false" }))}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-sm text-[rgba(26,26,26,0.7)]">{field.placeholder || field.label}</span>
                </label>
              ) : (
                <input
                  type={field.type}
                  value={answers[field.id] ?? ""}
                  onChange={e => setAnswers(prev => ({ ...prev, [field.id]: e.target.value }))}
                  placeholder={field.placeholder}
                  className="form-input-light w-full"
                />
              )}
              {fieldErrors[field.id] && <p className="text-[10px] text-red-400 mt-1">{fieldErrors[field.id]}</p>}
            </div>
          ))}

          <Button
            type="submit"
            className="w-full gradient-amber text-white border-0 hover:opacity-90"
            disabled={submitMutation.isPending}
          >
            {submitMutation.isPending ? "Submitting…" : "Submit"}
          </Button>
        </form>

        <p className="text-center text-xs text-[rgba(26,26,26,0.25)] mt-4">
          Powered by SkillBridge AI
        </p>
      </div>
    </div>
  );
}
