/**
 * Avatar Upload Route
 * POST /api/upload/avatar  — multipart/form-data, field "avatar" (image, max 5 MB)
 * DELETE /api/upload/avatar — removes avatar, sets avatarUrl to null
 */
import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import crypto from "crypto";
import { storagePut } from "./storage";
import { getDb } from "./db";
import { users } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { authenticateRequest } from "./auth";

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG, PNG, WebP, and GIF images are allowed."));
    }
  },
});

export const avatarUploadRouter = Router();

// ── POST /api/upload/avatar ─────────────────────────────────────────────────
avatarUploadRouter.post(
  "/api/upload/avatar",
  upload.single("avatar"),
  async (req: Request, res: Response) => {
    try {
      // Auth
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

      // Build a unique S3 key
      const ext = path.extname(req.file.originalname).toLowerCase() || ".jpg";
      const suffix = crypto.randomBytes(8).toString("hex");
      const key = `avatars/${user.id}-${suffix}${ext}`;

      // Upload to S3
      const { url } = await storagePut(key, req.file.buffer, req.file.mimetype);

      // Persist URL to DB
      const db = await getDb();
      if (!db) {
        res.status(503).json({ error: "Database unavailable." });
        return;
      }
      await db
        .update(users)
        .set({ avatarUrl: url, updatedAt: new Date() })
        .where(eq(users.id, user.id));

      res.json({ success: true, url });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload failed.";
      console.error("[AvatarUpload] POST:", msg);
      res.status(500).json({ error: msg });
    }
  }
);

// ── DELETE /api/upload/avatar ───────────────────────────────────────────────
avatarUploadRouter.delete(
  "/api/upload/avatar",
  async (req: Request, res: Response) => {
    try {
      let user: Awaited<ReturnType<typeof authenticateRequest>>;
      try {
        user = await authenticateRequest(req);
      } catch {
        res.status(401).json({ error: "Not authenticated." });
        return;
      }

      const db = await getDb();
      if (!db) {
        res.status(503).json({ error: "Database unavailable." });
        return;
      }
      await db
        .update(users)
        .set({ avatarUrl: null, updatedAt: new Date() })
        .where(eq(users.id, user.id));

      res.json({ success: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to remove avatar.";
      console.error("[AvatarUpload] DELETE:", msg);
      res.status(500).json({ error: msg });
    }
  }
);
