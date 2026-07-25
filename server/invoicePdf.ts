import { Router } from "express";
import PDFDocument from "pdfkit";
import { getDb } from "./db";
import { invoices, users } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { authenticateRequest } from "./auth";

export const invoicePdfRouter = Router();

invoicePdfRouter.get("/api/invoices/:id/pdf", async (req, res) => {
  try {
    // Auth
    let authUser: Awaited<ReturnType<typeof authenticateRequest>> | null = null;
    try { authUser = await authenticateRequest(req); } catch { /* not authed */ }
    if (!authUser) { res.status(401).json({ error: "Unauthorized" }); return; }

    const db = await getDb();
    if (!db) { res.status(503).json({ error: "Database unavailable" }); return; }

    const invoiceId = parseInt(req.params.id);
    if (isNaN(invoiceId)) { res.status(400).json({ error: "Invalid invoice ID" }); return; }

    const [inv] = await db.select().from(invoices)
      .where(and(eq(invoices.id, invoiceId), eq(invoices.userId, authUser.id)))
      .limit(1);
    if (!inv) { res.status(404).json({ error: "Invoice not found" }); return; }

    const [user] = await db.select({
      name: users.name,
      email: users.email,
      businessName: users.businessName,
      businessPhone: users.businessPhone,
      businessAddress: users.businessAddress,
      businessWebsite: users.businessWebsite,
    }).from(users).where(eq(users.id, authUser.id)).limit(1);

    // ── PDF Generation ──────────────────────────────────────────────────────
    const doc = new PDFDocument({ margin: 0, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => {
      const pdf = Buffer.concat(chunks);
      // Sanitize the filename to prevent Content-Disposition header injection.
      // Strip any character that is not alphanumeric, hyphen, or underscore.
      const rawName = String(inv.invoiceNumber || inv.id).replace(/[^a-zA-Z0-9\-_]/g, "_");
      const filename = `invoice-${rawName}.pdf`;
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Length", pdf.length);
      res.end(pdf);
    });

    const W = doc.page.width;   // 595.28
    const H = doc.page.height;  // 841.89
    const MARGIN = 48;
    const CONTENT_W = W - MARGIN * 2;

    const AMBER = "#E8A020";
    const DARK  = "#18181B";
    const GRAY  = "#71717A";
    const LIGHT = "#F4F4F5";
    const BORDER = "#E4E4E7";
    const WHITE  = "#FFFFFF";

    // ── Background ──────────────────────────────────────────────────────────
    doc.rect(0, 0, W, H).fill(WHITE);

    // ── Top accent bar ──────────────────────────────────────────────────────
    doc.rect(0, 0, W, 5).fill(AMBER);

    // ── Header section ──────────────────────────────────────────────────────
    const headerY = 28;

    // Logo square
    doc.roundedRect(MARGIN, headerY, 36, 36, 6).fill(AMBER);
    doc.fontSize(18).font("Helvetica-Bold").fillColor(WHITE)
      .text("T", MARGIN, headerY + 9, { width: 36, align: "center" });

    // Business name
    const bizName = user?.businessName || user?.name || "Business";
    doc.fontSize(16).font("Helvetica-Bold").fillColor(DARK)
      .text(bizName, MARGIN + 46, headerY + 2, { width: 200 });

    // Business contact info
    let contactY = headerY + 22;
    if (user?.email) {
      doc.fontSize(9).font("Helvetica").fillColor(GRAY)
        .text(user.email, MARGIN + 46, contactY);
      contactY += 12;
    }
    if (user?.businessPhone) {
      doc.fontSize(9).font("Helvetica").fillColor(GRAY)
        .text(user.businessPhone, MARGIN + 46, contactY);
      contactY += 12;
    }
    if (user?.businessWebsite) {
      doc.fontSize(9).font("Helvetica").fillColor(GRAY)
        .text(user.businessWebsite, MARGIN + 46, contactY);
    }

    // "INVOICE" label (right side)
    doc.fontSize(28).font("Helvetica-Bold").fillColor(AMBER)
      .text("INVOICE", MARGIN, headerY + 2, { width: CONTENT_W, align: "right" });

    // Invoice meta (right side)
    const metaStartY = headerY + 38;
    const metaRightX = W - MARGIN - 160;
    const metaW = 160;

    const metaItems: { label: string; value: string; highlight?: boolean }[] = [
      { label: "Invoice #", value: inv.invoiceNumber || String(inv.id) },
      { label: "Date", value: new Date(inv.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) },
    ];
    if (inv.dueDate) {
      metaItems.push({ label: "Due Date", value: new Date(inv.dueDate).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) });
    }
    const statusLabel = inv.status.charAt(0).toUpperCase() + inv.status.slice(1);
    const statusColor = inv.status === "paid" ? "#059669" : inv.status === "overdue" ? "#DC2626" : AMBER;
    metaItems.push({ label: "Status", value: statusLabel, highlight: true });

    let mY = metaStartY;
    for (const item of metaItems) {
      doc.fontSize(8).font("Helvetica").fillColor(GRAY)
        .text(item.label, metaRightX, mY, { width: 60 });
      if (item.highlight) {
        doc.fontSize(9).font("Helvetica-Bold").fillColor(statusColor)
          .text(item.value, metaRightX + 65, mY, { width: 95, align: "right" });
      } else {
        doc.fontSize(9).font("Helvetica-Bold").fillColor(DARK)
          .text(item.value, metaRightX + 65, mY, { width: 95, align: "right" });
      }
      mY += 16;
    }

    // ── Divider ──────────────────────────────────────────────────────────────
    const divY = Math.max(headerY + 72, mY + 8);
    doc.moveTo(MARGIN, divY).lineTo(W - MARGIN, divY)
      .strokeColor(BORDER).lineWidth(1).stroke();

    // ── Bill To section ──────────────────────────────────────────────────────
    const billY = divY + 20;
    doc.fontSize(8).font("Helvetica-Bold").fillColor(GRAY)
      .text("BILL TO", MARGIN, billY, { characterSpacing: 1 });
    doc.fontSize(13).font("Helvetica-Bold").fillColor(DARK)
      .text(inv.clientName, MARGIN, billY + 14);
    if (inv.clientEmail) {
      doc.fontSize(10).font("Helvetica").fillColor(GRAY)
        .text(inv.clientEmail, MARGIN, billY + 30);
    }

    // ── Line Items Table ──────────────────────────────────────────────────────
    const tableY = billY + 60;
    const colDesc = MARGIN;
    const colService = MARGIN + 220;
    const colQty = MARGIN + 380;
    const colAmt = W - MARGIN - 80;
    const colAmtW = 80;

    // Table header background
    doc.rect(MARGIN, tableY, CONTENT_W, 26).fill(LIGHT);

    // Table header text
    doc.fontSize(8).font("Helvetica-Bold").fillColor(GRAY);
    doc.text("DESCRIPTION", colDesc + 10, tableY + 9);
    doc.text("SERVICE", colService, tableY + 9);
    doc.text("QTY", colQty, tableY + 9, { width: 40, align: "center" });
    doc.text("AMOUNT", colAmt, tableY + 9, { width: colAmtW, align: "right" });

    // Table header bottom border
    doc.moveTo(MARGIN, tableY + 26).lineTo(W - MARGIN, tableY + 26)
      .strokeColor(BORDER).lineWidth(0.5).stroke();

    // Row
    const rowY = tableY + 38;
    doc.fontSize(11).font("Helvetica").fillColor(DARK)
      .text(inv.clientName, colDesc + 10, rowY, { width: 200 });
    doc.fontSize(10).font("Helvetica").fillColor(GRAY)
      .text(inv.service || "Professional Services", colService, rowY, { width: 150 });
    doc.fontSize(11).font("Helvetica").fillColor(DARK)
      .text("1", colQty, rowY, { width: 40, align: "center" });
    doc.fontSize(11).font("Helvetica-Bold").fillColor(DARK)
      .text(`$${Number(inv.amount).toFixed(2)}`, colAmt, rowY, { width: colAmtW, align: "right" });

    // Row bottom border
    const rowBottomY = rowY + 28;
    doc.moveTo(MARGIN, rowBottomY).lineTo(W - MARGIN, rowBottomY)
      .strokeColor(BORDER).lineWidth(0.5).stroke();

    // ── Total row ─────────────────────────────────────────────────────────────
    const totalY = rowBottomY + 14;
    doc.rect(W - MARGIN - 200, totalY - 8, 200, 40).fill(LIGHT);
    doc.fontSize(10).font("Helvetica-Bold").fillColor(GRAY)
      .text("TOTAL DUE", W - MARGIN - 190, totalY + 2, { width: 100 });
    doc.fontSize(18).font("Helvetica-Bold").fillColor(AMBER)
      .text(`$${Number(inv.amount).toFixed(2)}`, W - MARGIN - 90, totalY - 2, { width: 90, align: "right" });

    // ── Notes ─────────────────────────────────────────────────────────────────
    if (inv.notes) {
      const notesY = totalY + 56;
      doc.fontSize(8).font("Helvetica-Bold").fillColor(GRAY)
        .text("NOTES", MARGIN, notesY, { characterSpacing: 1 });
      doc.rect(MARGIN, notesY + 14, CONTENT_W, 1).fill(BORDER);
      doc.fontSize(10).font("Helvetica").fillColor(DARK)
        .text(inv.notes, MARGIN, notesY + 22, { width: CONTENT_W, lineGap: 3 });
    }

    // ── Footer ────────────────────────────────────────────────────────────────
    doc.rect(0, H - 44, W, 44).fill(LIGHT);
    doc.moveTo(0, H - 44).lineTo(W, H - 44).strokeColor(BORDER).lineWidth(0.5).stroke();
    doc.fontSize(9).font("Helvetica").fillColor(GRAY)
      .text("Thank you for your business!", MARGIN, H - 28, { width: CONTENT_W / 2 });
    if (user?.businessWebsite) {
      doc.fontSize(9).font("Helvetica").fillColor(GRAY)
        .text(user.businessWebsite, MARGIN, H - 28, { width: CONTENT_W, align: "right" });
    }
    // Bottom accent bar
    doc.rect(0, H - 5, W, 5).fill(AMBER);

    doc.end();
  } catch (err) {
    console.error("[InvoicePDF] Error:", err);
    if (!res.headersSent) res.status(500).json({ error: "Failed to generate PDF" });
  }
});
