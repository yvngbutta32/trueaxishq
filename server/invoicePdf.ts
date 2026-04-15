import { Router } from "express";
import PDFDocument from "pdfkit";
import { getDb } from "./db";
import { invoices, users } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { authenticateRequest } from "./auth";

export const invoicePdfRouter = Router();

invoicePdfRouter.get("/api/invoices/:id/pdf", async (req, res) => {
  try {
    // Auth check
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

    // Build PDF
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => {
      const pdf = Buffer.concat(chunks);
      const filename = `invoice-${inv.invoiceNumber || inv.id}.pdf`;
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Length", pdf.length);
      res.end(pdf);
    });

    const brandColor = "#E8A020";
    const darkColor = "#1C1C1E";
    const grayColor = "#6B7280";

    // Header bar
    doc.rect(0, 0, doc.page.width, 8).fill(brandColor);

    // Business name / logo text
    doc.moveDown(1);
    const bizName = user?.businessName || user?.name || "Business";
    doc.fontSize(24).font("Helvetica-Bold").fillColor(darkColor).text(bizName, 50, 30);

    // INVOICE label
    doc.fontSize(28).font("Helvetica-Bold").fillColor(brandColor)
      .text("INVOICE", 0, 30, { align: "right" });

    doc.moveDown(0.5);
    doc.fontSize(10).font("Helvetica").fillColor(grayColor);
    if (user?.email) doc.text(user.email, 50);
    if (user?.businessPhone) doc.text(user.businessPhone, 50);
    if (user?.businessAddress) doc.text(user.businessAddress, 50);
    if (user?.businessWebsite) doc.text(user.businessWebsite, 50);

    // Invoice meta (right side)
    const metaY = 60;
    doc.fontSize(9).font("Helvetica").fillColor(grayColor);
    doc.text(`Invoice #: ${inv.invoiceNumber || String(inv.id)}`, 0, metaY, { align: "right" });
    doc.text(`Date: ${new Date(inv.createdAt).toLocaleDateString()}`, 0, metaY + 14, { align: "right" });
    if (inv.dueDate) {
      doc.text(`Due: ${new Date(inv.dueDate).toLocaleDateString()}`, 0, metaY + 28, { align: "right" });
    }
    const statusLabel = inv.status.toUpperCase();
    const statusColor = inv.status === "paid" ? "#22C55E" : inv.status === "overdue" ? "#EF4444" : brandColor;
    doc.fontSize(10).font("Helvetica-Bold").fillColor(statusColor)
      .text(statusLabel, 0, metaY + 46, { align: "right" });

    // Divider
    const divY = doc.y + 20;
    doc.moveTo(50, divY).lineTo(doc.page.width - 50, divY).strokeColor("#E5E7EB").lineWidth(1).stroke();
    doc.moveDown(1.5);

    // Bill To
    doc.fontSize(9).font("Helvetica-Bold").fillColor(grayColor).text("BILL TO", 50);
    doc.fontSize(12).font("Helvetica-Bold").fillColor(darkColor).text(inv.clientName, 50);
    if (inv.clientEmail) {
      doc.fontSize(10).font("Helvetica").fillColor(grayColor).text(inv.clientEmail, 50);
    }

    doc.moveDown(1.5);

    // Line items table header
    const tableTop = doc.y;
    const col1 = 50, col2 = 300, col3 = 400, col4 = doc.page.width - 50;
    doc.rect(col1, tableTop, col4 - col1, 24).fill("#F9FAFB");
    doc.fontSize(9).font("Helvetica-Bold").fillColor(grayColor);
    doc.text("DESCRIPTION", col1 + 8, tableTop + 7);
    doc.text("SERVICE", col2, tableTop + 7);
    doc.text("QTY", col3, tableTop + 7, { width: 50, align: "center" });
    doc.text("AMOUNT", col4 - 80, tableTop + 7, { width: 80, align: "right" });

    // Line item row
    const rowY = tableTop + 30;
    doc.fontSize(11).font("Helvetica").fillColor(darkColor);
    doc.text(inv.clientName, col1 + 8, rowY);
    doc.text(inv.service || "Professional Services", col2, rowY, { width: 90 });
    doc.text("1", col3, rowY, { width: 50, align: "center" });
    doc.fontSize(11).font("Helvetica-Bold").fillColor(darkColor)
      .text(`$${Number(inv.amount).toFixed(2)}`, col4 - 80, rowY, { width: 80, align: "right" });

    // Divider
    const totalDivY = rowY + 30;
    doc.moveTo(col1, totalDivY).lineTo(col4, totalDivY).strokeColor("#E5E7EB").lineWidth(1).stroke();

    // Total
    doc.fontSize(12).font("Helvetica-Bold").fillColor(grayColor)
      .text("TOTAL", col3 - 60, totalDivY + 10, { width: 100, align: "right" });
    doc.fontSize(18).font("Helvetica-Bold").fillColor(brandColor)
      .text(`$${Number(inv.amount).toFixed(2)}`, col4 - 100, totalDivY + 6, { width: 100, align: "right" });

    // Notes
    if (inv.notes) {
      doc.moveDown(3);
      doc.fontSize(9).font("Helvetica-Bold").fillColor(grayColor).text("NOTES");
      doc.fontSize(10).font("Helvetica").fillColor(darkColor).text(inv.notes, { width: doc.page.width - 100 });
    }

    // Footer
    doc.fontSize(8).font("Helvetica").fillColor(grayColor)
      .text("Thank you for your business!", 50, doc.page.height - 60, { align: "center", width: doc.page.width - 100 });

    // Bottom bar
    doc.rect(0, doc.page.height - 8, doc.page.width, 8).fill(brandColor);

    doc.end();
  } catch (err) {
    console.error("[InvoicePDF] Error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to generate PDF" });
    }
  }
});
