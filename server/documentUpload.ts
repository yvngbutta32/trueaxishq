/**
 * Document Upload Route
 * POST /api/upload/document  — multipart/form-data, field "file" (any, max 20 MB)
 * Saves file to S3 and returns { fileKey, fileUrl, fileName, mimeType, sizeBytes }
 */
import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import crypto from "crypto";
import { storagePut } from "./storage";
import { authenticateRequest } from "./auth";
import { safeErrorMessage } from "./utils";

const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

// Allowlist of safe document MIME types — prevents arbitrary file uploads
const ALLOWED_DOC_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_DOC_MIME.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("File type not allowed. Accepted: PDF, Word, Excel, PowerPoint, CSV, plain text, and images."));
    }
  },
});

export const documentUploadRouter = Router();

// ── POST /api/upload/document ───────────────────────────────────────────────
documentUploadRouter.post(
  "/api/upload/document",
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      let user: Awaited<ReturnType<typeof authenticateRequest>>;
      try {
        user = await authenticateRequest(req);
      } catch {
        res.status(401).json({ error: "Not authenticated." });
        return;
      }

      if (!req.file) {
        res.status(400).json({ error: "No file uploaded." });
        return;
      }

      const originalName = req.file.originalname || "file";
      const ext = path.extname(originalName).toLowerCase();
      const suffix = crypto.randomBytes(10).toString("hex");
      const key = `documents/${user.id}/${suffix}${ext}`;

      const { url } = await storagePut(key, req.file.buffer, req.file.mimetype);

      res.json({
        success: true,
        fileKey: key,
        fileUrl: url,
        fileName: originalName,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
      });
    } catch (err: unknown) {
      const msg = safeErrorMessage(err, "Upload failed.");
      console.error("[DocumentUpload] POST:", err);
      res.status(500).json({ error: msg });
    }
  }
);
