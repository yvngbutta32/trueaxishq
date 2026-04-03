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

const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE_BYTES },
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
      const msg = err instanceof Error ? err.message : "Upload failed.";
      console.error("[DocumentUpload] POST:", msg);
      res.status(500).json({ error: msg });
    }
  }
);
