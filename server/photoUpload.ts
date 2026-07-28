/**
 * Photo Upload Route
 * POST /api/photos/upload  — multipart/form-data, field "file" (image, max 16 MB)
 * Supports both authenticated owner uploads and unauthenticated client estimate uploads.
 * Returns { photoKey, photoUrl, fileName, mimeType, sizeBytes }
 */
import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import crypto from "crypto";
import { storagePut } from "./storage";
import { safeErrorMessage } from "./utils";

const MAX_SIZE_BYTES = 16 * 1024 * 1024; // 16 MB

const ALLOWED_IMAGE_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/gif",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_IMAGE_MIME.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed (JPEG, PNG, WebP, HEIC, GIF)."));
    }
  },
});

export const photoUploadRouter = Router();

// ── POST /api/photos/upload ─────────────────────────────────────────────────
// Works for both authenticated owners and unauthenticated clients.
// - Authenticated: photoType defaults to "wip"; stored under job-photos/{userId}/
// - Unauthenticated: photoType is always "estimate"; stored under job-photos/client-uploads/
photoUploadRouter.post(
  "/api/photos/upload",
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "No file uploaded." });
        return;
      }

      const originalName = req.file.originalname || "photo";
      const ext = path.extname(originalName).toLowerCase() || ".jpg";
      const suffix = crypto.randomBytes(12).toString("hex");

      // Try to get user from session cookie (optional — clients won't have one)
      let userId: number | null = null;
      try {
        const { authenticateRequest } = await import("./auth");
        const user = await authenticateRequest(req);
        userId = user.id;
      } catch {
        // unauthenticated — client upload
      }

      const photoType = (req.body?.photoType as string) || (userId ? "wip" : "estimate");
      const folder = userId
        ? `job-photos/${userId}/${photoType}`
        : `job-photos/client-uploads/${photoType}`;

      const key = `${folder}/${suffix}${ext}`;
      const { url } = await storagePut(key, req.file.buffer, req.file.mimetype);

      res.json({
        success: true,
        photoKey: key,
        photoUrl: url,
        fileName: originalName,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
      });
    } catch (err: unknown) {
      const msg = safeErrorMessage(err, "Photo upload failed.");
      console.error("[PhotoUpload] POST:", err);
      res.status(500).json({ error: msg });
    }
  }
);
