/**
 * IntakeFormPage — Public form submission page
 * Route: /intake/:slug
 * Accessible without authentication.
 */
import { useState, useRef } from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { CheckCircle, ClipboardList, Camera, X, Upload, CalendarDays, ImageIcon } from "lucide-react";

interface UploadedPhoto {
  key: string;
  url: string;
  previewUrl: string;
  name: string;
}

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

  // Estimate photo upload state
  const [estimatePhotos, setEstimatePhotos] = useState<UploadedPhoto[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const confirmClientUpload = trpc.photos.confirmClientUpload.useMutation();

  async function handlePhotoFile(file: File) {
    if (estimatePhotos.length >= 5) { toast.error("Maximum 5 estimate photos allowed."); return; }
    if (file.size > 16 * 1024 * 1024) { toast.error("Photo must be under 16 MB."); return; }
    setUploadingPhoto(true);
    try {
      const formPayload = new FormData();
      formPayload.append("file", file);
      formPayload.append("photoType", "estimate");
      if (!formData?.hostBookingUsername) {
        throw new Error("The booking context for this form is unavailable.");
      }
      formPayload.append("hostUsername", formData.hostBookingUsername);
      const uploadRes = await fetch("/api/photos/upload", { method: "POST", body: formPayload });
      if (!uploadRes.ok) throw new Error("Upload failed");
      const { photoKey, photoUrl } = await uploadRes.json() as { photoKey: string; photoUrl: string };
      if (formData?.hostBookingUsername) {
        await confirmClientUpload.mutateAsync({ photoUrl, photoKey, hostUsername: formData.hostBookingUsername });
      }
      setEstimatePhotos(prev => [...prev, { key: photoKey, url: photoUrl, previewUrl: URL.createObjectURL(file), name: file.name }]);
      toast.success("Photo added!");
    } catch { toast.error("Photo upload failed. Please try again."); }
    finally { setUploadingPhoto(false); }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handlePhotoFile(file);
    e.target.value = "";
  }

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
      answers: {
        ...answers,
        ...(estimatePhotos.length > 0 ? { _estimatePhotos: JSON.stringify(estimatePhotos.map(p => p.url)) } : {}),
      },
    });
  }

  if (submitted) {
    const bookingUrl = formData?.hostBookingUsername
      ? `${window.location.origin}/book/${formData.hostBookingUsername}`
      : null;
    return (
      <div className="min-h-screen bg-[#F2F0EC] flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-[#1A1A1A] mb-2">Thank you!</h1>
          <p className="text-sm text-[rgba(26,26,26,0.55)] mb-6">
            Your response has been submitted.{respondentEmail ? " We've sent a confirmation to your email." : " We'll be in touch soon."}
          </p>
          {bookingUrl && (
            <div className="bg-white border border-[#DDDBD7] rounded-2xl p-5 text-left">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-[#D4922A]/15 flex items-center justify-center flex-shrink-0">
                  <CalendarDays className="w-4.5 h-4.5 text-[#D4922A]" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-[#1A1A1A]">Ready to book a session?</p>
                  <p className="text-xs text-[rgba(26,26,26,0.55)]">
                    {formData?.hostName ? `Schedule time with ${formData.hostName}` : "Choose a time that works for you"}
                  </p>
                </div>
              </div>
              <a
                href={bookingUrl}
                className="block w-full text-center py-2.5 px-4 rounded-xl bg-[#D4922A] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                Book a Session →
              </a>
            </div>
          )}
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

          {/* ─── Estimate Photo Upload ─────────────────────────────── */}
          <div className="border-t border-[#DDDBD7] pt-5">
            <label className="block text-xs font-semibold text-[rgba(26,26,26,0.6)] mb-2">
              Estimate Photos <span className="font-normal text-[rgba(26,26,26,0.4)]">(optional — up to 5)</span>
            </label>
            <p className="text-xs text-[rgba(26,26,26,0.45)] mb-3">
              Upload photos of the work area or materials to help with your estimate.
            </p>
            {estimatePhotos.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mb-3">
                {estimatePhotos.map(photo => (
                  <div key={photo.key} className="relative group aspect-square rounded-xl overflow-hidden border border-[#DDDBD7]">
                    <img src={photo.previewUrl} alt={photo.name} className="w-full h-full object-cover" />
                    <button type="button" onClick={() => setEstimatePhotos(prev => prev.filter(p => p.key !== photo.key))}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {estimatePhotos.length < 5 ? (
              <div className="flex gap-2">
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadingPhoto}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#DDDBD7] bg-[#F7F6F3] text-xs text-[rgba(26,26,26,0.6)] hover:bg-[#EEECEA] transition-colors disabled:opacity-50">
                  <Upload className="w-3.5 h-3.5" />{uploadingPhoto ? "Uploading…" : "Upload Photo"}
                </button>
                <button type="button" onClick={() => cameraInputRef.current?.click()} disabled={uploadingPhoto}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#DDDBD7] bg-[#F7F6F3] text-xs text-[rgba(26,26,26,0.6)] hover:bg-[#EEECEA] transition-colors disabled:opacity-50">
                  <Camera className="w-3.5 h-3.5" />Take Photo
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-[rgba(26,26,26,0.45)]">
                <ImageIcon className="w-3.5 h-3.5" />Maximum 5 photos reached
              </div>
            )}
          </div>

          <Button
            type="submit"
            className="w-full gradient-amber text-white border-0 hover:opacity-90"
            disabled={submitMutation.isPending || uploadingPhoto}
          >
            {submitMutation.isPending ? "Submitting…" : "Submit"}
          </Button>
        </form>

        <p className="text-center text-xs text-[rgba(26,26,26,0.25)] mt-4">
          Powered by TrueAxis HQ
        </p>
      </div>
    </div>
  );
}
