/* TrueAxis HQ — Inventory Panel
 * Truck-level stock tracking, purchase orders, and a full movement ledger.
 * Stock is derived from movements (receive/consume/adjust) so every quantity
 * change is auditable and never silently overwritten.
 */
import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PanelTabs } from "@/components/PanelTabs";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  Package, Plus, TrendingUp, TrendingDown, Warehouse, Truck, AlertTriangle, ClipboardList, RefreshCw,
} from "lucide-react";
import { Field, Modal, formatCurrency, Skeleton } from "./shared";

interface ItemRow {
  id: number; name: string; sku: string | null; unit: string;
  unitCost: string; unitPrice: string; reorderPoint: string;
  active: boolean; totalOnHand: number; lowStock: boolean;
}
interface LocationRow { id: number; name: string; type: "warehouse" | "truck"; active: boolean }
interface MovementRow { id: number; type: "receive" | "consume" | "adjust"; quantity: string; note: string | null; createdAt: string; itemName: string; locationName: string; locationType: string }
interface POLine { id: number; description: string; quantity: string; unitCost: string; receivedQuantity: string; inventoryItemId: number | null }
interface PORow { id: number; poNumber: string; supplierName: string; status: "draft" | "ordered" | "received" | "cancelled"; expectedDate: string | null; notes: string | null; totalAmount: string; locationId: number; locationName: string; items: POLine[] }

const num = (value: string | number) => Number(value) || 0;
const qtyLabel = (value: number, unit: string) => `${Number.isInteger(value) ? value : value.toFixed(2)} ${unit}`;

function ItemsTab() {
  const utils = trpc.useUtils();
  const items = trpc.inventory.listItems.useQuery();
  const locations = trpc.inventory.listLocations.useQuery();
  const jobs = trpc.jobs.list.useQuery(undefined, { select: data => data.filter(job => !["completed", "cancelled"].includes(job.status)) });
  const [itemModal, setItemModal] = useState(false);
  const [receiveFor, setReceiveFor] = useState<ItemRow | null>(null);
  const [adjustFor, setAdjustFor] = useState<ItemRow | null>(null);
  const [useFor, setUseFor] = useState<ItemRow | null>(null);
  const invalidate = () => { utils.inventory.listItems.invalidate(); utils.inventory.listMovements.invalidate(); };

  const [form, setForm] = useState({ name: "", sku: "", unit: "each", unitCost: "", unitPrice: "", reorderPoint: "" });
  const [receiveForm, setReceiveForm] = useState({ locationId: "", quantity: "", unitCost: "", note: "" });
  const [adjustForm, setAdjustForm] = useState({ locationId: "", quantity: "", note: "" });
  const [useForm, setUseForm] = useState({ locationId: "", jobId: "", quantity: "" });

  const createItem = trpc.inventory.createItem.useMutation({ onSuccess: () => { invalidate(); setItemModal(false); setForm({ name: "", sku: "", unit: "each", unitCost: "", unitPrice: "", reorderPoint: "" }); toast.success("Item created"); }, onError: e => toast.error(e.message) });
  const receiveStock = trpc.inventory.receiveStock.useMutation({ onSuccess: () => { invalidate(); setReceiveFor(null); toast.success("Stock received"); }, onError: e => toast.error(e.message) });
  const adjustStock = trpc.inventory.adjustStock.useMutation({ onSuccess: () => { invalidate(); setAdjustFor(null); toast.success("Stock adjusted"); }, onError: e => toast.error(e.message) });
  const consumeForJob = trpc.inventory.consumeForJob.useMutation({ onSuccess: () => { invalidate(); setUseFor(null); toast.success("Materials logged to the job"); }, onError: e => toast.error(e.message) });

  const activeLocations = locations.data?.filter(location => location.active) ?? [];
  const stockValue = (items.data ?? []).reduce((sum, item) => sum + item.totalOnHand * num(item.unitCost), 0);
  const lowCount = (items.data ?? []).filter(item => item.lowStock && item.active).length;

  const locationSelect = (value: string, onChange: (v: string) => void, label: string, excludeEmpty = false) => (
    <label className="block text-sm font-medium text-[#1A1A1A]">{label}
      <select value={value} onChange={event => onChange(event.target.value)} className="mt-1.5 w-full form-input-light">
        {!excludeEmpty && <option value="">Choose a location…</option>}
        {activeLocations.map(location => <option key={location.id} value={location.id}>{location.type === "truck" ? "🚚" : "🏬"} {location.name}</option>)}
      </select>
    </label>
  );

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-4 border border-[#DDDBD7]"><div className="w-9 h-9 rounded-xl bg-[#D4922A] flex items-center justify-center text-white mb-3"><Package className="w-4 h-4" /></div><p className="text-xl font-extrabold text-[#1A1A1A]">{items.data?.length ?? 0}</p><p className="text-xs text-[#6B6B6B] mt-0.5">Items tracked</p></div>
        <div className="bg-white rounded-xl p-4 border border-[#DDDBD7]"><div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white mb-3 ${lowCount > 0 ? "bg-amber-500" : "bg-emerald-500"}`}><AlertTriangle className="w-4 h-4" /></div><p className="text-xl font-extrabold text-[#1A1A1A]">{lowCount}</p><p className="text-xs text-[#6B6B6B] mt-0.5">Low or out of stock</p></div>
        <div className="bg-white rounded-xl p-4 border border-[#DDDBD7]"><div className="w-9 h-9 rounded-xl bg-[#1C2333] flex items-center justify-center text-white mb-3"><TrendingUp className="w-4 h-4" /></div><p className="text-xl font-extrabold text-[#1A1A1A]">{formatCurrency(stockValue)}</p><p className="text-xs text-[#6B6B6B] mt-0.5">Stock value at cost</p></div>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="font-bold text-[#1A1A1A]">Items</h3>
        <Button size="sm" onClick={() => setItemModal(true)} className="bg-[#D4922A] hover:bg-[#C07F1D] text-white"><Plus className="h-4 w-4 mr-1" /> Add item</Button>
      </div>

      {activeLocations.length === 0 && (items.data?.length ?? 0) > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Add a warehouse or truck under Locations first — stock movements need somewhere to live.</div>
      )}

      <div className="bg-white rounded-xl border border-[#DDDBD7] divide-y divide-[#EFEEE9]">
        {items.isLoading ? <div className="p-5"><Skeleton className="h-16" /></div>
          : items.data?.length === 0 ? <p className="p-6 text-sm text-[#6B6B6B] text-center">No items yet. Add the materials you keep on hand — filters, blades, fittings — to track what's on the truck.</p>
          : items.data!.map(item => (
            <div key={item.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1 basis-48">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-[#1A1A1A]">{item.name}</p>
                  {!item.active && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">Archived</span>}
                  {item.active && item.lowStock && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">Low</span>}
                </div>
                <p className="mt-0.5 text-xs text-[#6B6B6B]">{item.sku ? `SKU ${item.sku} · ` : ""}Cost {formatCurrency(num(item.unitCost))} · Sells at {formatCurrency(num(item.unitPrice))} · Reorder at {qtyLabel(num(item.reorderPoint), item.unit)}</p>
              </div>
              <p className={`text-sm font-bold ${item.totalOnHand <= 0 ? "text-[#6B6B6B]" : "text-[#1A1A1A]"}`}>{qtyLabel(item.totalOnHand, item.unit)} on hand</p>
              <div className="flex flex-wrap items-center gap-1.5">
                <Button size="sm" variant="outline" className="border-[#DDDBD7]" disabled={activeLocations.length === 0} onClick={() => { setReceiveForm({ locationId: String(activeLocations[0]?.id ?? ""), quantity: "", unitCost: "", note: "" }); setReceiveFor(item); }}><TrendingDown className="h-3.5 w-3.5 mr-1 rotate-180" /> Receive</Button>
                <Button size="sm" variant="outline" className="border-[#DDDBD7]" disabled={activeLocations.length === 0} onClick={() => { setAdjustForm({ locationId: String(activeLocations[0]?.id ?? ""), quantity: "", note: "" }); setAdjustFor(item); }}>Adjust</Button>
                <Button size="sm" variant="outline" className="border-[#DDDBD7]" disabled={activeLocations.length === 0} onClick={() => { setUseForm({ locationId: String(activeLocations[0]?.id ?? ""), jobId: "", quantity: "" }); setUseFor(item); }}>Use on job</Button>
              </div>
            </div>
          ))}
      </div>

      <Modal open={itemModal} onClose={() => setItemModal(false)} title="Add inventory item">
        <div className="space-y-3">
          <Field label="Name" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} placeholder="e.g. 20x25x1 MERV 11 filter" required maxLen={255} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="SKU (optional)" value={form.sku} onChange={v => setForm(f => ({ ...f, sku: v }))} placeholder="FLT-20251" maxLen={64} />
            <Field label="Unit" value={form.unit} onChange={v => setForm(f => ({ ...f, unit: v }))} placeholder="each / ft / box" maxLen={16} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Unit cost" value={form.unitCost} onChange={v => setForm(f => ({ ...f, unitCost: v }))} placeholder="0.00" type="text" />
            <Field label="Unit price" value={form.unitPrice} onChange={v => setForm(f => ({ ...f, unitPrice: v }))} placeholder="0.00" type="text" />
            <Field label="Reorder point" value={form.reorderPoint} onChange={v => setForm(f => ({ ...f, reorderPoint: v }))} placeholder="0" type="text" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setItemModal(false)}>Cancel</Button>
            <Button disabled={!form.name.trim() || createItem.isPending} onClick={() => createItem.mutate({
              name: form.name.trim(), sku: form.sku.trim() || undefined, unit: form.unit.trim() || "each",
              unitCost: num(form.unitCost), unitPrice: num(form.unitPrice), reorderPoint: num(form.reorderPoint),
            })} className="bg-[#D4922A] hover:bg-[#C07F1D] text-white">Add item</Button>
          </div>
        </div>
      </Modal>

      <Modal open={receiveFor !== null} onClose={() => setReceiveFor(null)} title={receiveFor ? `Receive ${receiveFor.name}` : ""}>
        <div className="space-y-3">
          {locationSelect(receiveForm.locationId, v => setReceiveForm(f => ({ ...f, locationId: v })), "Receive into")}
          <div className="grid grid-cols-2 gap-3">
            <Field label={`Quantity (${receiveFor?.unit ?? "each"})`} value={receiveForm.quantity} onChange={v => setReceiveForm(f => ({ ...f, quantity: v }))} placeholder="0" type="text" />
            <Field label="Update unit cost (optional)" value={receiveForm.unitCost} onChange={v => setReceiveForm(f => ({ ...f, unitCost: v }))} placeholder="0.00" type="text" />
          </div>
          <Field label="Note (optional)" value={receiveForm.note} onChange={v => setReceiveForm(f => ({ ...f, note: v }))} placeholder="e.g. Restock run" maxLen={255} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setReceiveFor(null)}>Cancel</Button>
            <Button disabled={!receiveFor || !receiveForm.locationId || num(receiveForm.quantity) <= 0 || receiveStock.isPending} onClick={() => receiveFor && receiveStock.mutate({
              itemId: receiveFor.id, locationId: Number(receiveForm.locationId), quantity: num(receiveForm.quantity),
              unitCost: receiveForm.unitCost ? num(receiveForm.unitCost) : undefined, note: receiveForm.note.trim() || undefined,
            })} className="bg-[#D4922A] hover:bg-[#C07F1D] text-white">Receive stock</Button>
          </div>
        </div>
      </Modal>

      <Modal open={adjustFor !== null} onClose={() => setAdjustFor(null)} title={adjustFor ? `Adjust ${adjustFor.name}` : ""}>
        <div className="space-y-3">
          {locationSelect(adjustForm.locationId, v => setAdjustForm(f => ({ ...f, locationId: v })), "Location")}
          <Field label="Change (negative for loss, positive for found)" value={adjustForm.quantity} onChange={v => setAdjustForm(f => ({ ...f, quantity: v }))} placeholder="-2 or 3" type="text" />
          <Field label="Reason" value={adjustForm.note} onChange={v => setAdjustForm(f => ({ ...f, note: v }))} placeholder="e.g. Damaged in transit, cycle count correction" required maxLen={255} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setAdjustFor(null)}>Cancel</Button>
            <Button disabled={!adjustFor || !adjustForm.locationId || num(adjustForm.quantity) === 0 || !adjustForm.note.trim() || adjustStock.isPending} onClick={() => adjustFor && adjustStock.mutate({
              itemId: adjustFor.id, locationId: Number(adjustForm.locationId), quantity: num(adjustForm.quantity), note: adjustForm.note.trim(),
            })} className="bg-[#D4922A] hover:bg-[#C07F1D] text-white">Save adjustment</Button>
          </div>
        </div>
      </Modal>

      <Modal open={useFor !== null} onClose={() => setUseFor(null)} title={useFor ? `Use ${useFor.name} on a job` : ""}>
        <div className="space-y-3">
          {locationSelect(useForm.locationId, v => setUseForm(f => ({ ...f, locationId: v })), "Take from")}
          <label className="block text-sm font-medium text-[#1A1A1A]">Job
            <select value={useForm.jobId} onChange={event => setUseForm(f => ({ ...f, jobId: event.target.value }))} className="mt-1.5 w-full form-input-light">
              <option value="">Choose a job…</option>
              {(jobs.data ?? []).map(job => <option key={job.id} value={job.id}>{job.jobNumber} · {job.title}</option>)}
            </select>
          </label>
          <Field label={`Quantity (${useFor?.unit ?? "each"})`} value={useForm.quantity} onChange={v => setUseForm(f => ({ ...f, quantity: v }))} placeholder="0" type="text" />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setUseFor(null)}>Cancel</Button>
            <Button disabled={!useFor || !useForm.locationId || !useForm.jobId || num(useForm.quantity) <= 0 || consumeForJob.isPending} onClick={() => useFor && consumeForJob.mutate({
              itemId: useFor.id, locationId: Number(useForm.locationId), jobId: Number(useForm.jobId), quantity: num(useForm.quantity),
            })} className="bg-[#D4922A] hover:bg-[#C07F1D] text-white">Log to job</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function PurchaseOrdersTab() {
  const utils = trpc.useUtils();
  const orders = trpc.inventory.listPurchaseOrders.useQuery();
  const items = trpc.inventory.listItems.useQuery(undefined, { select: data => data.filter(item => item.active) });
  const locations = trpc.inventory.listLocations.useQuery(undefined, { select: data => data.filter(location => location.active) });
  const [createOpen, setCreateOpen] = useState(false);
  const [pendingCancel, setPendingCancel] = useState<PORow | null>(null);
  const [form, setForm] = useState({ supplierName: "", locationId: "", expectedDate: "", notes: "" });
  const [lines, setLines] = useState([{ description: "", quantity: "1", unitCost: "0", inventoryItemId: "" as string }]);
  const invalidate = () => { utils.inventory.listPurchaseOrders.invalidate(); utils.inventory.listItems.invalidate(); utils.inventory.listMovements.invalidate(); };

  const createPO = trpc.inventory.createPurchaseOrder.useMutation({ onSuccess: result => { invalidate(); setCreateOpen(false); setForm({ supplierName: "", locationId: "", expectedDate: "", notes: "" }); setLines([{ description: "", quantity: "1", unitCost: "0", inventoryItemId: "" }]); toast.success(`${result.poNumber} created as a draft`); }, onError: e => toast.error(e.message) });
  const submitPO = trpc.inventory.submitPurchaseOrder.useMutation({ onSuccess: () => { invalidate(); toast.success("Purchase order submitted to the supplier"); }, onError: e => toast.error(e.message) });
  const receivePO = trpc.inventory.receivePurchaseOrder.useMutation({ onSuccess: () => { invalidate(); toast.success("Stock received into the chosen location"); }, onError: e => toast.error(e.message) });
  const cancelPO = trpc.inventory.cancelPurchaseOrder.useMutation({ onSuccess: () => { invalidate(); setPendingCancel(null); toast.success("Purchase order cancelled — nothing was received into stock"); }, onError: e => toast.error(e.message) });

  const statusBadge = (status: PORow["status"]) => {
    const map: Record<PORow["status"], string> = { draft: "bg-slate-100 text-slate-700", ordered: "bg-blue-100 text-blue-800", received: "bg-emerald-100 text-emerald-800", cancelled: "bg-rose-100 text-rose-800" };
    return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${map[status]}`}>{status}</span>;
  };
  const total = lines.reduce((sum, line) => sum + num(line.quantity) * num(line.unitCost), 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-[#1A1A1A]">Purchase orders</h3>
        <Button size="sm" onClick={() => { if (locations.data?.length === 0) { toast.error("Add a warehouse or truck under Locations first."); return; } setCreateOpen(true); }} className="bg-[#D4922A] hover:bg-[#C07F1D] text-white"><Plus className="h-4 w-4 mr-1" /> New purchase order</Button>
      </div>

      <div className="space-y-3">
        {orders.isLoading ? <div className="bg-white rounded-xl border border-[#DDDBD7] p-5"><Skeleton className="h-20" /></div>
          : orders.data?.length === 0 ? <div className="bg-white rounded-xl border border-[#DDDBD7] p-6 text-center"><ClipboardList className="mx-auto h-6 w-6 text-[#D4922A]" /><p className="mt-2 text-sm font-medium text-[#1A1A1A]">No purchase orders yet</p><p className="mt-1 text-xs text-[#6B6B6B]">Order stock from suppliers, then receive it into any warehouse or truck in one tap.</p></div>
          : orders.data!.map(order => (
            <div key={order.id} className="bg-white rounded-xl border border-[#DDDBD7] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2"><p className="font-bold text-[#1A1A1A]">{order.poNumber}</p>{statusBadge(order.status)}</div>
                  <p className="mt-0.5 text-xs text-[#6B6B6B]">{order.supplierName} · into {order.locationName}{order.expectedDate ? ` · expected ${order.expectedDate}` : ""}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-bold text-[#1A1A1A]">{formatCurrency(num(order.totalAmount))}</p>
                  {order.status === "draft" && <Button size="sm" variant="outline" className="border-blue-200 text-blue-800 hover:bg-blue-50" disabled={submitPO.isPending} onClick={() => submitPO.mutate({ id: order.id })}>Submit</Button>}
                  {order.status === "ordered" && <Button size="sm" variant="outline" className="border-emerald-200 text-emerald-800 hover:bg-emerald-50" disabled={receivePO.isPending} onClick={() => receivePO.mutate({ id: order.id })}><RefreshCw className="h-3.5 w-3.5 mr-1" /> Receive</Button>}
                  {(order.status === "draft" || order.status === "ordered") && <Button size="sm" variant="outline" className="border-rose-200 text-rose-700 hover:bg-rose-50" onClick={() => setPendingCancel(order)}>Cancel</Button>}
                </div>
              </div>
              {order.items.length > 0 && (
                <div className="mt-3 rounded-lg bg-[#F7F6F3] p-3 text-xs text-[#1A1A1A] space-y-1">
                  {order.items.map(line => <p key={line.id} className="flex justify-between gap-2"><span className="truncate">{line.description}</span><span className="shrink-0 text-[#6B6B6B]">{num(line.quantity)} × {formatCurrency(num(line.unitCost))}</span></p>)}
                </div>
              )}
              {order.status === "ordered" && <p className="mt-2 text-[11px] text-[#6B6B6B]">Receiving adds every catalog line into {order.locationName} and updates each item's unit cost.</p>}
            </div>
          ))}
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New purchase order" wide>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Supplier" value={form.supplierName} onChange={v => setForm(f => ({ ...f, supplierName: v }))} placeholder="e.g. Ferguson Plumbing" required maxLen={255} />
            <label className="block text-sm font-medium text-[#1A1A1A]">Receive into
              <select value={form.locationId} onChange={event => setForm(f => ({ ...f, locationId: event.target.value }))} className="mt-1.5 w-full form-input-light">
                <option value="">Choose a location…</option>
                {(locations.data ?? []).map(location => <option key={location.id} value={location.id}>{location.type === "truck" ? "🚚" : "🏬"} {location.name}</option>)}
              </select>
            </label>
          </div>
          <Field label="Expected date (optional)" value={form.expectedDate} onChange={v => setForm(f => ({ ...f, expectedDate: v }))} placeholder="2026-10-02" type="date" />
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-[#1A1A1A]">Lines</p>
            {lines.map((line, index) => (
              <div key={index} className="grid grid-cols-[1.4fr_60px_80px_1fr_28px] gap-1.5 items-center">
                <select value={line.inventoryItemId} onChange={event => { const itemId = event.target.value; setLines(prev => prev.map((l, i) => i === index ? { ...l, inventoryItemId: itemId, description: itemId ? (items.data?.find(item => item.id === Number(itemId))?.name ?? l.description) : l.description } : l)); }} className="form-input-light text-xs">
                  <option value="">Freeform…</option>
                  {(items.data ?? []).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
                <input value={line.description} onChange={event => setLines(prev => prev.map((l, i) => i === index ? { ...l, description: event.target.value } : l))} placeholder="Description" className="form-input-light text-xs" aria-label={`Line ${index + 1} description`} />
                <input value={line.quantity} onChange={event => setLines(prev => prev.map((l, i) => i === index ? { ...l, quantity: event.target.value } : l))} placeholder="Qty" inputMode="decimal" className="form-input-light text-xs text-center" aria-label={`Line ${index + 1} quantity`} />
                <input value={line.unitCost} onChange={event => setLines(prev => prev.map((l, i) => i === index ? { ...l, unitCost: event.target.value } : l))} placeholder="Cost" inputMode="decimal" className="form-input-light text-xs" aria-label={`Line ${index + 1} unit cost`} />
                <button type="button" onClick={() => setLines(prev => prev.filter((_, i) => i !== index))} className="text-red-400 hover:text-red-600 text-lg leading-none" aria-label={`Remove line ${index + 1}`}>&times;</button>
              </div>
            ))}
            <Button size="sm" variant="outline" className="border-[#DDDBD7]" onClick={() => setLines(prev => [...prev, { description: "", quantity: "1", unitCost: "0", inventoryItemId: "" }])}><Plus className="h-3.5 w-3.5 mr-1" /> Add line</Button>
          </div>
          <Field label="Notes (optional)" value={form.notes} onChange={v => setForm(f => ({ ...f, notes: v }))} textarea rows={2} maxLen={2000} />
          <div className="flex items-center justify-between pt-2">
            <p className="text-sm font-bold text-[#1A1A1A]">{formatCurrency(total)}</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button disabled={!form.supplierName.trim() || !form.locationId || lines.length === 0 || lines.some(line => !line.description.trim() || num(line.quantity) <= 0) || createPO.isPending} onClick={() => createPO.mutate({
                supplierName: form.supplierName.trim(), locationId: Number(form.locationId), expectedDate: form.expectedDate || undefined, notes: form.notes.trim() || undefined,
                items: lines.map(line => ({ inventoryItemId: line.inventoryItemId ? Number(line.inventoryItemId) : undefined, description: line.description.trim(), quantity: num(line.quantity), unitCost: num(line.unitCost) })),
              })} className="bg-[#D4922A] hover:bg-[#C07F1D] text-white">Create draft</Button>
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={pendingCancel !== null} title="Cancel purchase order?" description={`Cancel ${pendingCancel?.poNumber}? No stock will be received and the order stays on record as cancelled.`} confirmLabel="Cancel order" variant="destructive" onOpenChange={open => { if (!open) setPendingCancel(null); }} onConfirm={() => pendingCancel && cancelPO.mutate({ id: pendingCancel.id })} />
    </div>
  );
}

function LocationsTab() {
  const utils = trpc.useUtils();
  const locations = trpc.inventory.listLocations.useQuery();
  const [name, setName] = useState("");
  const [type, setType] = useState<"warehouse" | "truck">("warehouse");
  const invalidate = () => utils.inventory.listLocations.invalidate();

  const createLocation = trpc.inventory.createLocation.useMutation({ onSuccess: () => { invalidate(); setName(""); toast.success("Location added"); }, onError: e => toast.error(e.message) });
  const updateLocation = trpc.inventory.updateLocation.useMutation({ onSuccess: () => { invalidate(); toast.success("Location updated"); }, onError: e => toast.error(e.message) });

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl border border-[#DDDBD7] p-5">
        <h3 className="font-bold text-[#1A1A1A]">Stock locations</h3>
        <p className="mt-1 text-xs text-[#6B6B6B]">Track stock at the warehouse and on each truck. Movements move stock between your records; archive a location to retire a vehicle without losing history.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <input value={name} onChange={event => setName(event.target.value)} maxLength={100} placeholder="e.g. Main warehouse, Truck 2" className="min-w-0 flex-1 form-input-light" aria-label="Location name" />
          <select value={type} onChange={event => setType(event.target.value as "warehouse" | "truck")} className="form-input-light w-32" aria-label="Location type">
            <option value="warehouse">Warehouse</option>
            <option value="truck">Truck</option>
          </select>
          <Button onClick={() => name.trim() && createLocation.mutate({ name: name.trim(), type })} disabled={!name.trim() || createLocation.isPending} className="bg-[#D4922A] hover:bg-[#C07F1D] text-white"><Plus className="h-4 w-4 mr-1" /> Add</Button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#DDDBD7] divide-y divide-[#EFEEE9]">
        {locations.isLoading ? <div className="p-5"><Skeleton className="h-12" /></div>
          : locations.data?.length === 0 ? <p className="p-6 text-sm text-[#6B6B6B] text-center">No locations yet — add your warehouse and each truck to track stock where it actually lives.</p>
          : locations.data!.map(location => (
            <div key={location.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1C2333] text-white">{location.type === "truck" ? <Truck className="h-4 w-4" /> : <Warehouse className="h-4 w-4" />}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-[#1A1A1A]">{location.name}</p>
                  {!location.active && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">Archived</span>}
                </div>
                <p className="text-xs text-[#6B6B6B]">{location.type === "truck" ? "Truck stock" : "Warehouse stock"}</p>
              </div>
              <Button size="sm" variant="outline" className="border-[#DDDBD7]" disabled={updateLocation.isPending} onClick={() => updateLocation.mutate({ id: location.id, active: !location.active })}>{location.active ? "Archive" : "Restore"}</Button>
            </div>
          ))}
      </div>
    </div>
  );
}

function MovementsTab() {
  const movements = trpc.inventory.listMovements.useQuery();
  const typeBadge = (type: MovementRow["type"]) => {
    const map: Record<MovementRow["type"], string> = { receive: "bg-emerald-100 text-emerald-800", consume: "bg-amber-100 text-amber-800", adjust: "bg-slate-100 text-slate-700" };
    return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${map[type]}`}>{type}</span>;
  };
  return (
    <div className="space-y-5">
      <h3 className="font-bold text-[#1A1A1A]">Recent stock movements</h3>
      <div className="bg-white rounded-xl border border-[#DDDBD7] divide-y divide-[#EFEEE9]">
        {movements.isLoading ? <div className="p-5"><Skeleton className="h-12" /></div>
          : movements.data?.length === 0 ? <p className="p-6 text-sm text-[#6B6B6B] text-center">No movements yet — receives, adjustments, and job usage will appear here as a permanent audit trail.</p>
          : movements.data!.map(movement => (
            <div key={movement.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1 basis-48">
                <div className="flex items-center gap-2"><p className="font-semibold text-[#1A1A1A]">{movement.itemName}</p>{typeBadge(movement.type)}</div>
                <p className="mt-0.5 text-xs text-[#6B6B6B]">{movement.locationType === "truck" ? "🚚" : "🏬"} {movement.locationName}{movement.note ? ` · ${movement.note}` : ""} · {new Date(movement.createdAt).toLocaleDateString()}</p>
              </div>
              <p className={`text-sm font-bold ${Number(movement.quantity) < 0 ? "text-amber-700" : "text-emerald-700"}`}>{Number(movement.quantity) > 0 ? "+" : ""}{num(movement.quantity)}</p>
            </div>
          ))}
      </div>
    </div>
  );
}

export default function InventoryPanel() {
  const tabs = useMemo(() => [
    { id: "items", label: "Items", icon: Package, content: <ItemsTab /> },
    { id: "orders", label: "Purchase Orders", icon: ClipboardList, content: <PurchaseOrdersTab /> },
    { id: "locations", label: "Locations", icon: Truck, content: <LocationsTab /> },
    { id: "movements", label: "Movements", icon: RefreshCw, content: <MovementsTab /> },
  ], []);
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-extrabold text-[#1A1A1A]">Inventory</h2>
        <p className="text-sm text-[#6B6B6B]">Truck-level stock, purchase orders, and a full audit trail — know what's on every vehicle without counting by hand.</p>
      </div>
      <PanelTabs defaultTab="items" tabs={tabs} />
    </div>
  );
}
