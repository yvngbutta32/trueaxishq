/**
 * JobPhotosPanel — Full-featured photo management for TrueAxis HQ
 *
 * Tabs:
 *  • Estimate Photos   — uploaded by clients before a job starts
 *  • Work in Progress  — owner uploads during the job
 *  • Finished Work     — owner uploads when job is complete
 *  • Receipt Calculator — AI-powered receipt OCR + markup + invoice
 */
import { useState, useRef, useCallback, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Camera, Upload, Trash2, Edit3, X, ZoomIn,
  Receipt, Loader2, CheckCircle, DollarSign,
  ClipboardList, Hammer, Sparkles, Scan, Plus, Minus,
  FileText, ArrowRight, AlertCircle, Download, Link2
} from "lucide-react";

type PhotoType = "estimate" | "wip" | "finished" | "receipt";

interface UploadedPhoto {
  id: number;
  photoUrl: string;
  photoKey: string;
  photoType: PhotoType;
  uploadedBy: "client" | "owner";
  caption: string | null;
  lineItemLabel: string | null;
  lineItemAmount: string | null;
  sortOrder: number | null;
  createdAt: Date;
}

interface OcrLineItem {
  description: string;
  qty: number;
  unitPrice: number;
}

// ─── Drag-and-drop upload zone ────────────────────────────────────────────────
function DropZone({
  onFiles,
  uploading,
  accept = "image/*",
  capture,
}: {
  onFiles: (files: File[]) => void;
  uploading: boolean;
  accept?: string;
  capture?: "environment" | "user";
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const files = Array.from(e.dataTransfer.files).filter((f) =>
        f.type.startsWith("image/")
      );
      if (files.length) onFiles(files);
    },
    [onFiles]
  );

  return (
    <div
      className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
        dragging
          ? "border-[#D4922A] bg-[#D4922A]/10"
          : "border-[#243A5E] hover:border-[#D4922A]/60 hover:bg-[#D4922A]/5"
      }`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => !uploading && inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
      aria-label="Upload photos — click or drag and drop"
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple
        capture={capture}
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          if (files.length) onFiles(files);
          e.target.value = "";
        }}
      />
      {uploading ? (
        <div className="flex flex-col items-center gap-2 text-[#D4922A]">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p className="text-sm font-medium">Uploading…</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 text-gray-400">
          <Upload className="w-8 h-8" />
          <p className="text-sm font-medium text-gray-300">
            Drag photos here or <span className="text-[#D4922A] underline">click to browse</span>
          </p>
          <p className="text-xs text-gray-500">JPEG, PNG, WebP, HEIC — up to 16 MB each</p>
        </div>
      )}
    </div>
  );
}

// ─── Photo grid card ──────────────────────────────────────────────────────────
function PhotoCard({
  photo,
  onDelete,
  onEdit,
  onZoom,
}: {
  photo: UploadedPhoto;
  onDelete: (id: number) => void;
  onEdit: (photo: UploadedPhoto) => void;
  onZoom: (url: string) => void;
}) {
  return (
    <div className="group relative rounded-xl overflow-hidden bg-[#1B2D4F] border border-[#243A5E] hover:border-[#D4922A]/60 transition-all">
      <div
        className="aspect-square cursor-zoom-in overflow-hidden"
        onClick={() => onZoom(photo.photoUrl)}
      >
        <img
          src={photo.photoUrl}
          alt={photo.caption || "Job photo"}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
      </div>
      {/* Overlay actions */}
      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onZoom(photo.photoUrl)}
          className="w-7 h-7 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80"
          title="View full size"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onEdit(photo)}
          className="w-7 h-7 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80"
          title="Edit caption"
        >
          <Edit3 className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onDelete(photo.id)}
          className="w-7 h-7 rounded-full bg-red-600/80 flex items-center justify-center text-white hover:bg-red-600"
          title="Delete photo"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      {/* Caption */}
      {photo.caption && (
        <div className="px-2 py-1.5 bg-[#0F1E35]/90">
          <p className="text-xs text-gray-300 truncate">{photo.caption}</p>
        </div>
      )}
      {/* Receipt line item */}
      {photo.photoType === "receipt" && photo.lineItemLabel && (
        <div className="px-2 py-1.5 bg-[#0F1E35]/90 border-t border-[#243A5E]">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-300 truncate flex-1">{photo.lineItemLabel}</p>
            {photo.lineItemAmount && (
              <span className="text-xs font-semibold text-[#D4922A] ml-2">
                ${parseFloat(photo.lineItemAmount).toFixed(2)}
              </span>
            )}
          </div>
        </div>
      )}
      {/* Uploaded-by badge */}
      {photo.uploadedBy === "client" && (
        <div className="absolute top-2 left-2">
          <Badge className="text-[10px] bg-blue-600/80 text-white border-0 px-1.5 py-0.5">Client</Badge>
        </div>
      )}
    </div>
  );
}

// ─── Photo gallery tab ────────────────────────────────────────────────────────
function PhotoGalleryTab({
  photoType,
  icon: Icon,
  emptyMessage,
}: {
  photoType: PhotoType;
  icon: React.ElementType;
  emptyMessage: string;
}) {
  const utils = trpc.useUtils();
  const [uploading, setUploading] = useState(false);
  const [zoomUrl, setZoomUrl] = useState<string | null>(null);
  const [editPhoto, setEditPhoto] = useState<UploadedPhoto | null>(null);
  const [editCaption, setEditCaption] = useState("");

  const { data: photos = [], isLoading } = trpc.photos.list.useQuery({ photoType });

  const confirmUpload = trpc.photos.confirmUpload.useMutation({
    onSuccess: () => utils.photos.list.invalidate(),
  });

  const deleteMutation = trpc.photos.delete.useMutation({
    onSuccess: () => { utils.photos.list.invalidate(); toast.success("Photo deleted."); },
    onError: () => toast.error("Failed to delete photo."),
  });

  const updateMutation = trpc.photos.update.useMutation({
    onSuccess: () => {
      utils.photos.list.invalidate();
      setEditPhoto(null);
      toast.success("Caption updated.");
    },
    onError: () => toast.error("Failed to update caption."),
  });

  const handleFiles = async (files: File[]) => {
    setUploading(true);
    let successCount = 0;
    for (const file of files) {
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("photoType", photoType);
        const res = await fetch("/api/photos/upload", {
          method: "POST",
          body: formData,
          credentials: "include",
        });
        if (!res.ok) {
          const errText = await res.text();
          throw new Error(errText || "Upload failed");
        }
        const { photoKey, photoUrl } = await res.json() as { photoKey: string; photoUrl: string };
        await confirmUpload.mutateAsync({ photoUrl, photoKey, photoType });
        successCount++;
      } catch (err) {
        console.error("[PhotoUpload]", err);
        toast.error(`Failed to upload ${file.name}`);
      }
    }
    setUploading(false);
    if (successCount > 0) {
      toast.success(`${successCount} photo${successCount > 1 ? "s" : ""} uploaded.`);
    }
  };

  return (
    <div className="space-y-4">
      <DropZone onFiles={handleFiles} uploading={uploading} />

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-[#D4922A]" />
        </div>
      ) : photos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Icon className="w-12 h-12 text-gray-600 mb-3" />
          <p className="text-gray-400 font-medium">{emptyMessage}</p>
          <p className="text-gray-500 text-sm mt-1">Upload photos using the zone above.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {(photos as UploadedPhoto[]).map((photo) => (
            <PhotoCard
              key={photo.id}
              photo={photo}
              onDelete={(id) => deleteMutation.mutate({ id })}
              onEdit={(p) => { setEditPhoto(p); setEditCaption(p.caption || ""); }}
              onZoom={setZoomUrl}
            />
          ))}
        </div>
      )}

      {/* Lightbox */}
      <Dialog open={!!zoomUrl} onOpenChange={() => setZoomUrl(null)}>
        <DialogContent className="max-w-4xl bg-[#0F1E35] border-[#243A5E] p-2">
          <button
            onClick={() => setZoomUrl(null)}
            className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80"
          >
            <X className="w-4 h-4" />
          </button>
          {zoomUrl && (
            <img
              src={zoomUrl}
              alt="Full size photo"
              className="w-full h-auto max-h-[80vh] object-contain rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Edit caption dialog */}
      <Dialog open={!!editPhoto} onOpenChange={() => setEditPhoto(null)}>
        <DialogContent className="bg-[#1B2D4F] border-[#243A5E]">
          <DialogHeader>
            <DialogTitle className="text-white">Edit Caption</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {editPhoto && (
              <img
                src={editPhoto.photoUrl}
                alt="Photo"
                className="w-full h-40 object-cover rounded-lg"
              />
            )}
            <Input
              value={editCaption}
              onChange={(e) => setEditCaption(e.target.value)}
              placeholder="Add a caption…"
              className="bg-[#0F1E35] border-[#243A5E] text-white"
              maxLength={512}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setEditPhoto(null)} className="border-[#243A5E] text-gray-300">
                Cancel
              </Button>
              <Button
                onClick={() => editPhoto && updateMutation.mutate({ id: editPhoto.id, caption: editCaption })}
                disabled={updateMutation.isPending}
                className="bg-[#D4922A] hover:bg-[#C07820] text-white"
              >
                {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Receipt Calculator Tab ───────────────────────────────────────────────────
function ReceiptCalculatorTab() {
  const utils = trpc.useUtils();

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [scanningPhotoId, setScanningPhotoId] = useState<number | null>(null);

  // OCR result state
  const [ocrItems, setOcrItems] = useState<OcrLineItem[]>([]);
  const [ocrNote, setOcrNote] = useState("");
  const [ocrTax, setOcrTax] = useState(0);
  const [scannedPhotoUrl, setScannedPhotoUrl] = useState<string | null>(null);

  // Markup state
  const [markupPercent, setMarkupPercent] = useState(0);

  // Invoice state
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);
  const [invoiceMode, setInvoiceMode] = useState<"new" | "existing">("new");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [invoiceNotes, setInvoiceNotes] = useState("");

  // Zoom state
  const [zoomUrl, setZoomUrl] = useState<string | null>(null);

  const { data: photos = [], isLoading } = trpc.photos.list.useQuery({ photoType: "receipt" });
  const { data: invoiceList = [] } = trpc.invoices.list.useQuery({ status: "all" });

  const confirmUpload = trpc.photos.confirmUpload.useMutation({
    onSuccess: () => utils.photos.list.invalidate(),
  });
  const deleteMutation = trpc.photos.delete.useMutation({
    onSuccess: () => { utils.photos.list.invalidate(); toast.success("Receipt photo deleted."); },
    onError: () => toast.error("Failed to delete receipt photo."),
  });
  const extractOcrMutation = trpc.photos.extractReceiptTotal.useMutation({
    onError: () => toast.error("AI scan failed. Please try again."),
  });
  const addToInvoiceMutation = trpc.photos.addToInvoice.useMutation({
    onSuccess: (data) => {
      setShowInvoiceDialog(false);
      utils.invoices.list.invalidate();
      if (data.created) {
        toast.success("New draft invoice created from receipt!");
      } else {
        toast.success("Line items added to existing invoice!");
      }
    },
    onError: (e) => toast.error(e.message || "Failed to add to invoice."),
  });

  const handleFiles = async (files: File[]) => {
    setUploading(true);
    let lastUrl: string | null = null;
    for (const file of files) {
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("photoType", "receipt");
        const res = await fetch("/api/photos/upload", {
          method: "POST",
          body: formData,
          credentials: "include",
        });
        if (!res.ok) throw new Error(await res.text() || "Upload failed");
        const { photoKey, photoUrl } = await res.json() as { photoKey: string; photoUrl: string };
        await confirmUpload.mutateAsync({ photoUrl, photoKey, photoType: "receipt" });
        lastUrl = photoUrl;
      } catch (err) {
        console.error("[ReceiptUpload]", err);
        toast.error(`Failed to upload ${file.name}`);
      }
    }
    setUploading(false);
    if (lastUrl) {
      toast.success(`Receipt uploaded. Click "AI Scan" to extract totals.`);
    }
  };

  const handleAiScan = async (photo: UploadedPhoto) => {
    setScanningPhotoId(photo.id);
    setOcrItems([]);
    setOcrNote("");
    setOcrTax(0);
    setScannedPhotoUrl(photo.photoUrl);
    try {
      const result = await extractOcrMutation.mutateAsync({ photoId: photo.id });
      if (result.items.length === 0 && result.total === 0) {
        toast.warning("AI could not detect line items. Try a clearer photo.");
        setOcrNote(result.note || "No items detected.");
      } else {
        setOcrItems(result.items.length > 0 ? result.items : [{ description: "Receipt total", qty: 1, unitPrice: result.total }]);
        setOcrTax(result.tax);
        if (result.note) setOcrNote(result.note);
        toast.success(`Extracted ${result.items.length || 1} line item${result.items.length !== 1 ? "s" : ""} from receipt.`);
      }
    } finally {
      setScanningPhotoId(null);
    }
  };

  // Computed totals
  const receiptPhotos = photos as UploadedPhoto[];
  const subtotal = ocrItems.reduce((sum, i) => sum + i.qty * i.unitPrice, 0);
  const markupAmount = subtotal * (markupPercent / 100);
  const totalWithMarkup = subtotal + markupAmount + ocrTax;

  // Final line items to send to invoice (with markup as a separate line if > 0)
  const finalLineItems: OcrLineItem[] = [
    ...ocrItems,
    ...(markupPercent > 0 ? [{ description: `Contractor markup (${markupPercent}%)`, qty: 1, unitPrice: markupAmount }] : []),
    ...(ocrTax > 0 ? [{ description: "Tax", qty: 1, unitPrice: ocrTax }] : []),
  ];

  const handleAddToInvoice = () => {
    if (finalLineItems.length === 0) {
      toast.error("Scan a receipt first to generate line items.");
      return;
    }
    setShowInvoiceDialog(true);
  };

  const handleConfirmInvoice = () => {
    if (invoiceMode === "existing" && !selectedInvoiceId) {
      toast.error("Please select an invoice.");
      return;
    }
    if (invoiceMode === "new" && !clientName.trim()) {
      toast.error("Please enter a client name.");
      return;
    }
    addToInvoiceMutation.mutate({
      invoiceId: invoiceMode === "existing" ? parseInt(selectedInvoiceId, 10) : undefined,
      clientName: invoiceMode === "new" ? clientName.trim() : undefined,
      clientEmail: invoiceMode === "new" && clientEmail.trim() ? clientEmail.trim() : undefined,
      lineItems: finalLineItems,
      notes: invoiceNotes.trim() || undefined,
    });
  };

  // Update a scanned line item
  const updateItem = (idx: number, field: keyof OcrLineItem, value: string) => {
    setOcrItems(prev => prev.map((item, i) =>
      i === idx ? { ...item, [field]: field === "description" ? value : parseFloat(value) || 0 } : item
    ));
  };
  const removeItem = (idx: number) => setOcrItems(prev => prev.filter((_, i) => i !== idx));
  const addItem = () => setOcrItems(prev => [...prev, { description: "", qty: 1, unitPrice: 0 }]);

  // PDF export — builds a printable HTML page and triggers browser print-to-PDF
  const handleDownloadPdf = () => {
    if (finalLineItems.length === 0) { toast.error("Scan a receipt first."); return; }
    const rows = finalLineItems.map(i =>
      `<tr><td>${i.description}</td><td style="text-align:center">${i.qty}</td><td style="text-align:right">$${i.unitPrice.toFixed(2)}</td><td style="text-align:right">$${(i.qty * i.unitPrice).toFixed(2)}</td></tr>`
    ).join("");
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Receipt Summary — TrueAxis HQ</title>
<style>body{font-family:sans-serif;padding:40px;max-width:600px;margin:0 auto}h1{font-size:22px;margin-bottom:4px}p.sub{color:#666;font-size:13px;margin-bottom:24px}table{width:100%;border-collapse:collapse}th{background:#f5f5f5;padding:8px 12px;text-align:left;font-size:13px}td{padding:8px 12px;border-bottom:1px solid #eee;font-size:13px}.total-row td{font-weight:bold;font-size:15px;border-top:2px solid #333;border-bottom:none}.markup{color:#D4922A}@media print{body{padding:20px}}</style></head>
<body><h1>Receipt Summary</h1><p class="sub">Generated by TrueAxis HQ &mdash; ${new Date().toLocaleDateString()}</p>
<table><thead><tr><th>Description</th><th style="text-align:center">Qty</th><th style="text-align:right">Unit Price</th><th style="text-align:right">Amount</th></tr></thead><tbody>${rows}</tbody>
<tfoot><tr class="total-row"><td colspan="3">Total</td><td style="text-align:right" class="markup">$${totalWithMarkup.toFixed(2)}</td></tr></tfoot></table>
${scannedPhotoUrl ? `<br/><img src="${scannedPhotoUrl}" style="max-width:100%;border-radius:8px;margin-top:16px" alt="Receipt photo"/>` : ""}
</body></html>`;
    const win = window.open("", "_blank");
    if (!win) { toast.error("Pop-up blocked. Please allow pop-ups and try again."); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  };

  // Copy shareable text summary to clipboard
  const handleCopyShareLink = () => {
    if (finalLineItems.length === 0) { toast.error("Scan a receipt first."); return; }
    const lines = finalLineItems.map(i => `• ${i.description} (×${i.qty}) — $${(i.qty * i.unitPrice).toFixed(2)}`).join("\n");
    const text = `Receipt Summary — TrueAxis HQ\n${new Date().toLocaleDateString()}\n\n${lines}\n\nTotal: $${totalWithMarkup.toFixed(2)}`;
    navigator.clipboard.writeText(text).then(() => toast.success("Summary copied to clipboard!")).catch(() => toast.error("Copy failed."));
  };

  // Reset OCR state when changing photo
  useEffect(() => {
    if (!scannedPhotoUrl) {
      setOcrItems([]);
      setOcrNote("");
      setOcrTax(0);
    }
  }, [scannedPhotoUrl]);

  return (
    <div className="space-y-6">
      {/* Step 1: Upload */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Step 1 — Upload Receipt Photo</p>
        <DropZone onFiles={handleFiles} uploading={uploading} capture="environment" />
      </div>

      {/* Receipt photo grid with AI Scan buttons */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-[#D4922A]" />
        </div>
      ) : receiptPhotos.length > 0 ? (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Step 2 — Scan a Receipt</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {receiptPhotos.map((photo) => (
              <div
                key={photo.id}
                className={`group relative rounded-xl overflow-hidden border transition-all ${
                  scannedPhotoUrl === photo.photoUrl
                    ? "border-[#D4922A] ring-2 ring-[#D4922A]/40"
                    : "border-[#243A5E] hover:border-[#D4922A]/60"
                } bg-[#1B2D4F]`}
              >
                <div className="aspect-square cursor-zoom-in overflow-hidden" onClick={() => setZoomUrl(photo.photoUrl)}>
                  <img src={photo.photoUrl} alt="Receipt" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                </div>
                <div className="p-2 flex gap-1">
                  <Button
                    size="sm"
                    className="flex-1 h-7 text-xs bg-[#D4922A] hover:bg-[#C07820] text-white"
                    onClick={() => handleAiScan(photo)}
                    disabled={scanningPhotoId === photo.id || extractOcrMutation.isPending}
                  >
                    {scanningPhotoId === photo.id ? (
                      <><Loader2 className="w-3 h-3 animate-spin mr-1" />Scanning…</>
                    ) : (
                      <><Scan className="w-3 h-3 mr-1" />AI Scan</>
                    )}
                  </Button>
                  <button
                    onClick={() => {
                      deleteMutation.mutate({ id: photo.id });
                      if (scannedPhotoUrl === photo.photoUrl) {
                        setScannedPhotoUrl(null);
                        setOcrItems([]);
                      }
                    }}
                    className="w-7 h-7 rounded-lg bg-red-600/20 flex items-center justify-center text-red-400 hover:bg-red-600/40"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                {scannedPhotoUrl === photo.photoUrl && (
                  <div className="absolute top-2 left-2">
                    <Badge className="text-[10px] bg-[#D4922A] text-white border-0 px-1.5 py-0.5">Scanned</Badge>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Step 3: OCR Results + Markup */}
      {ocrItems.length > 0 && (
        <div className="space-y-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Step 3 — Review & Adjust Line Items</p>

          {ocrNote && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-900/20 border border-amber-700/30">
              <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-300">{ocrNote}</p>
            </div>
          )}

          {/* Scanned receipt preview */}
          {scannedPhotoUrl && (
            <div className="flex gap-3 items-start">
              <img
                src={scannedPhotoUrl}
                alt="Scanned receipt"
                className="w-20 h-20 object-cover rounded-lg border border-[#243A5E] cursor-zoom-in flex-shrink-0"
                onClick={() => setZoomUrl(scannedPhotoUrl)}
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-400 mb-1">AI extracted {ocrItems.length} line item{ocrItems.length !== 1 ? "s" : ""}. Edit below if needed.</p>
              </div>
            </div>
          )}

          {/* Line items editor */}
          <div className="space-y-2">
            {ocrItems.map((item, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <Input
                  value={item.description}
                  onChange={(e) => updateItem(idx, "description", e.target.value)}
                  placeholder="Description"
                  className="bg-[#0F1E35] border-[#243A5E] text-white text-sm flex-1 min-w-0"
                />
                <Input
                  type="number"
                  value={item.qty}
                  onChange={(e) => updateItem(idx, "qty", e.target.value)}
                  placeholder="Qty"
                  className="bg-[#0F1E35] border-[#243A5E] text-white text-sm w-16"
                  min="0.01"
                  step="0.01"
                />
                <Input
                  type="number"
                  value={item.unitPrice}
                  onChange={(e) => updateItem(idx, "unitPrice", e.target.value)}
                  placeholder="Unit $"
                  className="bg-[#0F1E35] border-[#243A5E] text-white text-sm w-24"
                  min="0"
                  step="0.01"
                />
                <span className="text-sm font-medium text-[#D4922A] w-16 text-right flex-shrink-0">
                  ${(item.qty * item.unitPrice).toFixed(2)}
                </span>
                <button
                  onClick={() => removeItem(idx)}
                  className="w-7 h-7 rounded-lg bg-red-600/20 flex items-center justify-center text-red-400 hover:bg-red-600/40 flex-shrink-0"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={addItem}
              className="border-[#243A5E] text-gray-400 hover:text-white w-full mt-1"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add line item
            </Button>
          </div>

          {/* Markup slider */}
          <Card className="bg-[#1B2D4F] border-[#243A5E]">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-white text-sm flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-[#D4922A]" />
                Contractor Markup
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min={0}
                  max={200}
                  step={1}
                  value={markupPercent}
                  onChange={(e) => setMarkupPercent(parseInt(e.target.value, 10))}
                  className="flex-1 accent-[#D4922A]"
                />
                <div className="flex items-center gap-1 w-24 flex-shrink-0">
                  <Input
                    type="number"
                    min={0}
                    max={1000}
                    value={markupPercent}
                    onChange={(e) => setMarkupPercent(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="bg-[#0F1E35] border-[#243A5E] text-white text-sm w-16 text-center"
                  />
                  <span className="text-gray-400 text-sm">%</span>
                </div>
              </div>
              {markupPercent > 0 && (
                <p className="text-xs text-gray-400 mt-1">
                  Markup: <span className="text-[#D4922A] font-medium">+${markupAmount.toFixed(2)}</span>
                </p>
              )}
            </CardContent>
          </Card>

          {/* Running total */}
          <Card className="bg-[#0F1E35] border-[#D4922A]/30">
            <CardContent className="py-4">
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between text-gray-300">
                  <span>Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                {markupPercent > 0 && (
                  <div className="flex justify-between text-[#D4922A]">
                    <span>Markup ({markupPercent}%)</span>
                    <span>+${markupAmount.toFixed(2)}</span>
                  </div>
                )}
                {ocrTax > 0 && (
                  <div className="flex justify-between text-gray-300">
                    <span>Tax</span>
                    <span>${ocrTax.toFixed(2)}</span>
                  </div>
                )}
                <div className="border-t border-[#243A5E] pt-2 flex justify-between font-bold text-base">
                  <span className="text-white">Total</span>
                  <span className="text-[#D4922A] text-xl">${totalWithMarkup.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button
              className="flex-1 bg-[#D4922A] hover:bg-[#C07820] text-white font-semibold h-11"
              onClick={handleAddToInvoice}
              disabled={addToInvoiceMutation.isPending}
            >
              <FileText className="w-4 h-4 mr-2" />
              Add to Invoice
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button
              variant="outline"
              className="h-11 px-4 border-[#243A5E] text-gray-300 hover:text-white hover:border-[#D4922A] bg-transparent"
              onClick={handleDownloadPdf}
              title="Download receipt summary as PDF"
            >
              <Download className="w-4 h-4 mr-1.5" />
              PDF
            </Button>
            <Button
              variant="outline"
              className="h-11 px-4 border-[#243A5E] text-gray-300 hover:text-white hover:border-[#D4922A] bg-transparent"
              onClick={handleCopyShareLink}
              title="Copy receipt summary to clipboard"
            >
              <Link2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && receiptPhotos.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Receipt className="w-12 h-12 text-gray-600 mb-3" />
          <p className="text-gray-400 font-medium">No receipt photos yet</p>
          <p className="text-gray-500 text-sm mt-1">Upload a receipt photo above, then click "AI Scan" to extract totals automatically.</p>
        </div>
      )}

      {/* Lightbox */}
      <Dialog open={!!zoomUrl} onOpenChange={() => setZoomUrl(null)}>
        <DialogContent className="max-w-4xl bg-[#0F1E35] border-[#243A5E] p-2">
          <button onClick={() => setZoomUrl(null)} className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80">
            <X className="w-4 h-4" />
          </button>
          {zoomUrl && <img src={zoomUrl} alt="Full size receipt" className="w-full h-auto max-h-[80vh] object-contain rounded-lg" />}
        </DialogContent>
      </Dialog>

      {/* Add to Invoice dialog */}
      <Dialog open={showInvoiceDialog} onOpenChange={setShowInvoiceDialog}>
        <DialogContent className="bg-[#1B2D4F] border-[#243A5E] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#D4922A]" />
              Add to Invoice
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Summary */}
            <div className="p-3 rounded-lg bg-[#0F1E35] border border-[#243A5E]">
              <p className="text-xs text-gray-400 mb-1">{finalLineItems.length} line item{finalLineItems.length !== 1 ? "s" : ""} — Total</p>
              <p className="text-2xl font-bold text-[#D4922A]">${totalWithMarkup.toFixed(2)}</p>
            </div>

            {/* Mode toggle */}
            <div className="flex rounded-lg overflow-hidden border border-[#243A5E]">
              <button
                className={`flex-1 py-2 text-sm font-medium transition-colors ${invoiceMode === "new" ? "bg-[#D4922A] text-white" : "bg-[#0F1E35] text-gray-400 hover:text-white"}`}
                onClick={() => setInvoiceMode("new")}
              >
                Create New Invoice
              </button>
              <button
                className={`flex-1 py-2 text-sm font-medium transition-colors ${invoiceMode === "existing" ? "bg-[#D4922A] text-white" : "bg-[#0F1E35] text-gray-400 hover:text-white"}`}
                onClick={() => setInvoiceMode("existing")}
              >
                Add to Existing
              </button>
            </div>

            {invoiceMode === "new" ? (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Client Name *</label>
                  <Input
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="e.g. John Smith"
                    className="bg-[#0F1E35] border-[#243A5E] text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Client Email (optional)</label>
                  <Input
                    type="email"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    placeholder="client@example.com"
                    className="bg-[#0F1E35] border-[#243A5E] text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Notes (optional)</label>
                  <Input
                    value={invoiceNotes}
                    onChange={(e) => setInvoiceNotes(e.target.value)}
                    placeholder="e.g. Materials from job on 7/27"
                    className="bg-[#0F1E35] border-[#243A5E] text-white"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Select Invoice</label>
                  <Select value={selectedInvoiceId} onValueChange={setSelectedInvoiceId}>
                    <SelectTrigger className="bg-[#0F1E35] border-[#243A5E] text-white">
                      <SelectValue placeholder="Choose an invoice…" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1B2D4F] border-[#243A5E]">
                      {(invoiceList as any[]).filter((inv: any) => inv.status !== "paid").map((inv: any) => (
                        <SelectItem key={inv.id} value={String(inv.id)} className="text-white focus:bg-[#243A5E]">
                          {inv.invoiceNumber} — {inv.clientName} (${parseFloat(inv.amount).toFixed(2)})
                        </SelectItem>
                      ))}
                      {(invoiceList as any[]).filter((inv: any) => inv.status !== "paid").length === 0 && (
                        <SelectItem value="__none__" disabled className="text-gray-500">No open invoices found</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Notes (optional)</label>
                  <Input
                    value={invoiceNotes}
                    onChange={(e) => setInvoiceNotes(e.target.value)}
                    placeholder="e.g. Receipt from 7/27 job"
                    className="bg-[#0F1E35] border-[#243A5E] text-white"
                  />
                </div>
              </div>
            )}

            <div className="flex gap-2 justify-end pt-1">
              <Button variant="outline" onClick={() => setShowInvoiceDialog(false)} className="border-[#243A5E] text-gray-300">
                Cancel
              </Button>
              <Button
                onClick={handleConfirmInvoice}
                disabled={addToInvoiceMutation.isPending}
                className="bg-[#D4922A] hover:bg-[#C07820] text-white"
              >
                {addToInvoiceMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-1" />Saving…</>
                ) : invoiceMode === "new" ? (
                  <><FileText className="w-4 h-4 mr-1" />Create Invoice</>
                ) : (
                  <><Plus className="w-4 h-4 mr-1" />Add to Invoice</>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────
export default function JobPhotosPanel() {
  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#D4922A]/20 flex items-center justify-center">
          <Camera className="w-5 h-5 text-[#D4922A]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Job Photos</h1>
          <p className="text-sm text-gray-400">Manage estimate, progress, and finished photos — plus AI receipt scanning</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="estimate" className="w-full">
        <TabsList className="bg-[#1B2D4F] border border-[#243A5E] p-1 h-auto flex-wrap gap-1">
          <TabsTrigger
            value="estimate"
            className="data-[state=active]:bg-[#D4922A] data-[state=active]:text-white text-gray-400 flex items-center gap-1.5 text-xs sm:text-sm"
          >
            <ClipboardList className="w-3.5 h-3.5" />
            Estimates
          </TabsTrigger>
          <TabsTrigger
            value="wip"
            className="data-[state=active]:bg-[#D4922A] data-[state=active]:text-white text-gray-400 flex items-center gap-1.5 text-xs sm:text-sm"
          >
            <Hammer className="w-3.5 h-3.5" />
            In Progress
          </TabsTrigger>
          <TabsTrigger
            value="finished"
            className="data-[state=active]:bg-[#D4922A] data-[state=active]:text-white text-gray-400 flex items-center gap-1.5 text-xs sm:text-sm"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            Finished
          </TabsTrigger>
          <TabsTrigger
            value="receipt"
            className="data-[state=active]:bg-[#D4922A] data-[state=active]:text-white text-gray-400 flex items-center gap-1.5 text-xs sm:text-sm"
          >
            <Receipt className="w-3.5 h-3.5" />
            Receipt Calc
          </TabsTrigger>
        </TabsList>

        <TabsContent value="estimate" className="mt-4">
          <div className="mb-3 p-3 rounded-lg bg-blue-900/20 border border-blue-700/30">
            <p className="text-xs text-blue-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 flex-shrink-0" />
              Clients can upload estimate photos from their booking page before the job starts. They appear here automatically.
            </p>
          </div>
          <PhotoGalleryTab
            photoType="estimate"
            icon={ClipboardList}
            emptyMessage="No estimate photos yet"
          />
        </TabsContent>

        <TabsContent value="wip" className="mt-4">
          <PhotoGalleryTab
            photoType="wip"
            icon={Hammer}
            emptyMessage="No in-progress photos yet"
          />
        </TabsContent>

        <TabsContent value="finished" className="mt-4">
          <PhotoGalleryTab
            photoType="finished"
            icon={CheckCircle}
            emptyMessage="No finished photos yet"
          />
        </TabsContent>

        <TabsContent value="receipt" className="mt-4">
          <div className="mb-3 p-3 rounded-lg bg-[#D4922A]/10 border border-[#D4922A]/30">
            <p className="text-xs text-[#D4922A] flex items-center gap-1.5">
              <Receipt className="w-3.5 h-3.5 flex-shrink-0" />
              Upload a receipt photo → click "AI Scan" to extract line items → add your markup % → send straight to an invoice.
            </p>
          </div>
          <ReceiptCalculatorTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
