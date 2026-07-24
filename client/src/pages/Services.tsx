import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Package, Plus, Pencil, Trash2, DollarSign, Clock, Tag, ToggleLeft, ToggleRight,
} from "lucide-react";

type ServiceForm = {
  name: string;
  description: string;
  price: string;
  durationMinutes: string;
  category: string;
};

const EMPTY_FORM: ServiceForm = { name: "", description: "", price: "", durationMinutes: "60", category: "service" };

const CATEGORIES = ["service", "package", "retainer", "consultation", "workshop", "other"];

export default function Services() {
  const utils = trpc.useUtils();
  const { data: services = [], isLoading } = trpc.services.list.useQuery();
  const createMut = trpc.services.create.useMutation({
    onSuccess: () => { utils.services.list.invalidate(); toast.success("Service created"); setOpen(false); setForm(EMPTY_FORM); },
    onError: (e) => toast.error(e.message),
  });
  const updateMut = trpc.services.update.useMutation({
    onSuccess: () => { utils.services.list.invalidate(); toast.success("Service updated"); setOpen(false); setEditing(null); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMut = trpc.services.delete.useMutation({
    onSuccess: () => { utils.services.list.invalidate(); toast.success("Service deleted"); },
    onError: (e) => toast.error(e.message),
  });
  const toggleMut = trpc.services.update.useMutation({
    onSuccess: () => utils.services.list.invalidate(),
    onError: (e) => toast.error(e.message),
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [form, setForm] = useState<ServiceForm>(EMPTY_FORM);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  function openCreate() { setEditing(null); setForm(EMPTY_FORM); setOpen(true); }
  function openEdit(s: typeof services[0]) {
    setEditing(s.id);
    setForm({ name: s.name, description: s.description ?? "", price: String(parseFloat(String(s.price))), durationMinutes: String(s.durationMinutes ?? 60), category: s.category ?? "service" });
    setOpen(true);
  }

  function handleSubmit() {
    const price = parseFloat(form.price);
    const dur = parseInt(form.durationMinutes);
    if (!form.name.trim()) return toast.error("Service name is required");
    if (isNaN(price) || price < 0) return toast.error("Enter a valid price");
    if (editing !== null) {
      updateMut.mutate({ id: editing, name: form.name, description: form.description || undefined, price, durationMinutes: dur, category: form.category });
    } else {
      createMut.mutate({ name: form.name, description: form.description || undefined, price, durationMinutes: dur, category: form.category });
    }
  }

  const activeServices = services.filter(s => s.active);
  const inactiveServices = services.filter(s => !s.active);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[rgba(26,26,26,0.95)]">Service Catalog</h1>
          <p className="text-sm text-[rgba(26,26,26,0.55)] mt-0.5">Define your services and packages — select them instantly when creating invoices or proposals</p>
        </div>
        <Button onClick={openCreate} className="bg-[#00C9A7] hover:bg-[#00b396] text-[#1C1C1E] font-semibold gap-2">
          <Plus className="w-4 h-4" /> New Service
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Services", value: services.length, icon: Package, color: "#00C9A7" },
          { label: "Active", value: activeServices.length, icon: ToggleRight, color: "#34D399" },
          { label: "Avg Price", value: services.length ? `$${(services.reduce((s, sv) => s + parseFloat(String(sv.price)), 0) / services.length).toFixed(0)}` : "$0", icon: DollarSign, color: "#F59E0B" },
        ].map(stat => (
          <div key={stat.label} className="bg-white border border-[rgba(26,26,26,0.08)] rounded-xl p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `${stat.color}20` }}>
              <stat.icon className="w-5 h-5" style={{ color: stat.color }} />
            </div>
            <div>
              <p className="text-xl font-bold text-[rgba(26,26,26,0.95)]">{stat.value}</p>
              <p className="text-xs text-[rgba(26,26,26,0.5)]">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Services Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-40 rounded-xl bg-white animate-pulse" />)}
        </div>
      ) : services.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[rgba(0,201,167,0.12)] flex items-center justify-center mb-4">
            <Package className="w-8 h-8 text-[#00C9A7]" />
          </div>
          <h3 className="text-lg font-semibold text-[rgba(26,26,26,0.85)] mb-2">No services yet</h3>
          <p className="text-sm text-[rgba(26,26,26,0.45)] mb-6 max-w-sm">Create your service catalog to quickly add line items to invoices and proposals in seconds.</p>
          <Button onClick={openCreate} className="bg-[#00C9A7] hover:bg-[#00b396] text-[#1C1C1E] font-semibold gap-2">
            <Plus className="w-4 h-4" /> Create First Service
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {activeServices.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-[rgba(26,26,26,0.5)] uppercase tracking-wider mb-3">Active ({activeServices.length})</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeServices.map(s => <ServiceCard key={s.id} service={s} onEdit={openEdit} onDelete={setDeleteConfirm} onToggle={id => toggleMut.mutate({ id, active: false })} />)}
              </div>
            </div>
          )}
          {inactiveServices.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-[rgba(26,26,26,0.35)] uppercase tracking-wider mb-3">Inactive ({inactiveServices.length})</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 opacity-60">
                {inactiveServices.map(s => <ServiceCard key={s.id} service={s} onEdit={openEdit} onDelete={setDeleteConfirm} onToggle={id => toggleMut.mutate({ id, active: true })} inactive />)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) { setEditing(null); setForm(EMPTY_FORM); } }}>
        <DialogContent className="bg-white border-[rgba(26,26,26,0.1)] text-[rgba(26,26,26,0.95)] max-w-md">
          <DialogHeader>
            <DialogTitle>{editing !== null ? "Edit Service" : "New Service"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-semibold text-[rgba(26,26,26,0.6)] mb-1.5 block">Service Name *</label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. 1-Hour Coaching Session" className="bg-[rgba(255,255,255,0.05)] border-[rgba(26,26,26,0.12)] text-[rgba(26,26,26,0.9)]" />
            </div>
            <div>
              <label className="text-xs font-semibold text-[rgba(26,26,26,0.6)] mb-1.5 block">Description</label>
              <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="What's included in this service..." rows={3} className="bg-[rgba(255,255,255,0.05)] border-[rgba(26,26,26,0.12)] text-[rgba(26,26,26,0.9)] resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-[rgba(26,26,26,0.6)] mb-1.5 block">Price (USD) *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgba(26,26,26,0.4)] text-sm">$</span>
                  <Input value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))} placeholder="0.00" className="pl-7 bg-[rgba(255,255,255,0.05)] border-[rgba(26,26,26,0.12)] text-[rgba(26,26,26,0.9)]" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-[rgba(26,26,26,0.6)] mb-1.5 block">Duration (min)</label>
                <Input value={form.durationMinutes} onChange={e => setForm(p => ({ ...p, durationMinutes: e.target.value }))} placeholder="60" type="number" min="0" className="bg-[rgba(255,255,255,0.05)] border-[rgba(26,26,26,0.12)] text-[rgba(26,26,26,0.9)]" />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-[rgba(26,26,26,0.6)] mb-1.5 block">Category</label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map(cat => (
                  <button key={cat} onClick={() => setForm(p => ({ ...p, category: cat }))}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-all capitalize ${form.category === cat ? "bg-[#00C9A7] border-[#00C9A7] text-[#1C1C1E]" : "border-[rgba(26,26,26,0.15)] text-[rgba(26,26,26,0.6)] hover:border-[rgba(26,26,26,0.3)]"}`}>
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} className="text-[rgba(26,26,26,0.6)]">Cancel</Button>
            <Button onClick={handleSubmit} disabled={createMut.isPending || updateMut.isPending} className="bg-[#00C9A7] hover:bg-[#00b396] text-[#1C1C1E] font-semibold">
              {editing !== null ? "Save Changes" : "Create Service"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={deleteConfirm !== null} onOpenChange={v => !v && setDeleteConfirm(null)}>
        <DialogContent className="bg-white border-[rgba(26,26,26,0.1)] text-[rgba(26,26,26,0.95)] max-w-sm">
          <DialogHeader><DialogTitle>Delete Service?</DialogTitle></DialogHeader>
          <p className="text-sm text-[rgba(26,26,26,0.6)]">This will permanently remove the service from your catalog. Existing invoices won't be affected.</p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteConfirm(null)} className="text-[rgba(26,26,26,0.6)]">Cancel</Button>
            <Button variant="destructive" onClick={() => { if (deleteConfirm !== null) { deleteMut.mutate({ id: deleteConfirm }); setDeleteConfirm(null); } }}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ServiceCard({ service, onEdit, onDelete, onToggle, inactive }: {
  service: any; onEdit: (s: any) => void; onDelete: (id: number) => void; onToggle: (id: number) => void; inactive?: boolean;
}) {
  const price = parseFloat(String(service.price));
  const dur = service.durationMinutes ?? 60;
  return (
    <div className="group bg-white border border-[rgba(26,26,26,0.08)] rounded-xl p-5 hover:border-[rgba(0,201,167,0.3)] hover:bg-[rgba(0,201,167,0.04)] transition-all">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-[rgba(26,26,26,0.95)] truncate">{service.name}</h3>
          <Badge variant="outline" className="mt-1 text-xs border-[rgba(26,26,26,0.15)] text-[rgba(26,26,26,0.5)] capitalize">{service.category}</Badge>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
          <button onClick={() => onEdit(service)} className="p-1.5 rounded-lg hover:bg-white text-[rgba(26,26,26,0.5)] hover:text-[rgba(26,26,26,0.9)] transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
          <button onClick={() => onDelete(service.id)} className="p-1.5 rounded-lg hover:bg-[rgba(255,80,80,0.12)] text-[rgba(26,26,26,0.5)] hover:text-red-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>
      {service.description && <p className="text-xs text-[rgba(26,26,26,0.45)] mb-3 line-clamp-2">{service.description}</p>}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-[#00C9A7] font-bold text-lg"><DollarSign className="w-4 h-4" />{price.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
          {dur > 0 && <span className="flex items-center gap-1 text-xs text-[rgba(26,26,26,0.4)]"><Clock className="w-3 h-3" />{dur >= 60 ? `${dur / 60}h` : `${dur}m`}</span>}
        </div>
        <button onClick={() => onToggle(service.id)} className="text-xs flex items-center gap-1 text-[rgba(26,26,26,0.4)] hover:text-[rgba(26,26,26,0.7)] transition-colors">
          {inactive ? <ToggleLeft className="w-4 h-4" /> : <ToggleRight className="w-4 h-4 text-[#34D399]" />}
          {inactive ? "Activate" : "Active"}
        </button>
      </div>
    </div>
  );
}
