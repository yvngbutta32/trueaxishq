import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Download, Printer, X } from "lucide-react";

export interface InvoiceData {
  id: string;
  clientName: string;
  clientEmail: string;
  service: string;
  amount: number;
  status: "paid" | "pending" | "overdue";
  date: string;
  dueDate?: string;
  notes?: string;
  businessName?: string;
  businessEmail?: string;
}

interface InvoicePrintProps {
  invoice: InvoiceData;
  onClose: () => void;
}

export default function InvoicePrint({ invoice, onClose }: InvoicePrintProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const content = printRef.current?.innerHTML;
    if (!content) return;
    const win = window.open("", "_blank", "width=800,height=600");
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Invoice ${invoice.id} — TrueAxis HQ</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1C1C1E; background: white; padding: 48px; }
          .invoice-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
          .brand { display: flex; align-items: center; gap: 12px; }
          .brand-icon { width: 40px; height: 40px; background: linear-gradient(135deg, #00C9A7, #007A65); border-radius: 10px; display: flex; align-items: center; justify-content: center; }
          .brand-icon svg { width: 20px; height: 20px; fill: white; }
          .brand-name { font-size: 20px; font-weight: 800; color: #1C1C1E; }
          .invoice-title { font-size: 32px; font-weight: 800; color: #1C1C1E; }
          .invoice-id { font-size: 14px; color: #6B7280; margin-top: 4px; }
          .status-badge { display: inline-block; padding: 4px 12px; border-radius: 100px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 8px; }
          .status-paid { background: #D1FAE5; color: #065F46; }
          .status-pending { background: #FEF3C7; color: #92400E; }
          .status-overdue { background: #FEE2E2; color: #991B1B; }
          .divider { border: none; border-top: 1px solid #E5E7EB; margin: 24px 0; }
          .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 32px; }
          .party-label { font-size: 11px; font-weight: 600; color: #9CA3AF; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 8px; }
          .party-name { font-size: 16px; font-weight: 700; color: #1C1C1E; }
          .party-email { font-size: 13px; color: #6B7280; margin-top: 2px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
          th { text-align: left; padding: 10px 12px; font-size: 11px; font-weight: 600; color: #9CA3AF; text-transform: uppercase; letter-spacing: 0.08em; background: #F9FAFB; border-bottom: 1px solid #E5E7EB; }
          td { padding: 14px 12px; font-size: 14px; color: #374151; border-bottom: 1px solid #F3F4F6; }
          .amount-row { font-weight: 700; font-size: 16px; color: #1C1C1E; }
          .total-section { display: flex; justify-content: flex-end; }
          .total-box { background: #F9FAFB; border-radius: 12px; padding: 16px 24px; min-width: 200px; }
          .total-label { font-size: 12px; color: #6B7280; }
          .total-amount { font-size: 28px; font-weight: 800; color: #00C9A7; margin-top: 4px; }
          .notes { background: #F9FAFB; border-radius: 12px; padding: 16px; margin-top: 24px; }
          .notes-label { font-size: 11px; font-weight: 600; color: #9CA3AF; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 6px; }
          .notes-text { font-size: 13px; color: #6B7280; line-height: 1.6; }
          .footer { margin-top: 48px; text-align: center; font-size: 12px; color: #9CA3AF; }
          @media print { body { padding: 24px; } }
        </style>
      </head>
      <body>
        <div class="invoice-header">
          <div class="brand">
            <div class="brand-icon">
              <svg viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
            </div>
            <div>
              <div class="brand-name">${invoice.businessName ?? "TrueAxis HQ"}</div>
              <div style="font-size:12px;color:#6B7280">${invoice.businessEmail ?? ""}</div>
            </div>
          </div>
          <div style="text-align:right">
            <div class="invoice-title">INVOICE</div>
            <div class="invoice-id">#${invoice.id}</div>
            <div class="status-badge status-${invoice.status}">${invoice.status}</div>
          </div>
        </div>
        <hr class="divider" />
        <div class="parties">
          <div>
            <div class="party-label">Bill To</div>
            <div class="party-name">${invoice.clientName}</div>
            <div class="party-email">${invoice.clientEmail}</div>
          </div>
          <div>
            <div class="party-label">Invoice Details</div>
            <div style="font-size:13px;color:#374151;margin-top:4px"><strong>Date:</strong> ${invoice.date}</div>
            ${invoice.dueDate ? `<div style="font-size:13px;color:#374151;margin-top:2px"><strong>Due:</strong> ${invoice.dueDate}</div>` : ""}
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th style="text-align:right">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${invoice.service}</td>
              <td style="text-align:right" class="amount-row">$${invoice.amount.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
        <div class="total-section">
          <div class="total-box">
            <div class="total-label">Total Due</div>
            <div class="total-amount">$${invoice.amount.toLocaleString()}</div>
          </div>
        </div>
        ${invoice.notes ? `<div class="notes"><div class="notes-label">Notes</div><div class="notes-text">${invoice.notes}</div></div>` : ""}
        <div class="footer">
          Generated by TrueAxis HQ · Thank you for your business!
        </div>
      </body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 500);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Invoice ${invoice.id} preview`}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">Invoice Preview</h2>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="gap-2"
              aria-label="Print or save as PDF"
            >
              <Printer className="w-4 h-4" aria-hidden="true" />
              Print / PDF
            </Button>
            <button
              onClick={onClose}
              aria-label="Close invoice preview"
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
            >
              <X className="w-4 h-4 text-gray-500" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Preview */}
        <div className="overflow-y-auto flex-1 p-6" ref={printRef}>
          {/* Invoice preview card */}
          <div className="bg-white border border-gray-100 rounded-xl p-6">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl gradient-teal flex items-center justify-center" aria-hidden="true">
                  <Download className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-bold text-gray-900">{invoice.businessName ?? "TrueAxis HQ"}</p>
                  <p className="text-xs text-gray-400">{invoice.businessEmail ?? ""}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xl font-extrabold text-gray-900">INVOICE</p>
                <p className="text-xs text-gray-400">#{invoice.id}</p>
                <span className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
                  invoice.status === "paid" ? "bg-green-100 text-green-800" :
                  invoice.status === "overdue" ? "bg-red-100 text-red-800" :
                  "bg-yellow-100 text-yellow-800"
                }`}>
                  {invoice.status}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Bill To</p>
                <p className="font-semibold text-gray-900">{invoice.clientName}</p>
                <p className="text-xs text-gray-500">{invoice.clientEmail}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Details</p>
                <p className="text-xs text-gray-700"><strong>Date:</strong> {invoice.date}</p>
                {invoice.dueDate && <p className="text-xs text-gray-700"><strong>Due:</strong> {invoice.dueDate}</p>}
              </div>
            </div>

            <table className="w-full text-sm mb-4" aria-label="Invoice line items">
              <thead>
                <tr className="border-b border-gray-200">
                  <th scope="col" className="text-left py-2 text-xs text-gray-400 uppercase tracking-wider">Description</th>
                  <th scope="col" className="text-right py-2 text-xs text-gray-400 uppercase tracking-wider">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="py-3 text-gray-700">{invoice.service}</td>
                  <td className="py-3 text-right font-bold text-gray-900">${invoice.amount.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>

            <div className="flex justify-end mb-4">
              <div className="bg-gray-50 rounded-xl p-4 text-right">
                <p className="text-xs text-gray-400">Total Due</p>
                <p className="text-2xl font-extrabold text-[#00C9A7]">${invoice.amount.toLocaleString()}</p>
              </div>
            </div>

            {invoice.notes && (
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Notes</p>
                <p className="text-sm text-gray-600">{invoice.notes}</p>
              </div>
            )}

            <p className="text-center text-xs text-gray-400 mt-6">
              Generated by TrueAxis HQ · Thank you for your business!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
