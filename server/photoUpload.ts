/**
 * Photo Upload Route
 * POST /api/photos/upload  — multipart/form-data, field "file" (image, max 16 MB)
 * Supports both authenticated owner uploads and unauthenticated client estimate uploads.
 * Returns { photoKey, photoUrl, fileName, mimeType, sizeBytes }
 */
import { Router, Request, Response } from "express";
import multer from "multer";
import crypto from "crypto";
import { and, eq, sql } from "drizzle-orm";
import { storagePut } from "./storage";
import { safeErrorMessage } from "./utils";
import { getDb } from "./db";
import { clientPortalTokens, publicPhotoUploadSessions, publicPhotoUploads, users } from "../drizzle/schema";
import { getClientIp } from "./security";
import { getPublicUploadKeyPrefix, hashPublicUploadToken, isPublicUploadKeyForSession } from "./photoUploadSecurity";

const MAX_SIZE_BYTES = 16 * 1024 * 1024; // 16 MB
const PUBLIC_UPLOAD_WINDOW_MS = 10 * 60_000;
const PUBLIC_UPLOAD_MAX_PER_WINDOW = 12;
const publicUploadWindows = new Map<string, { count: number; startedAt: number }>();

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

function detectedImageMime(buffer: Buffer): "image/jpeg" | "image/png" | "image/webp" | "image/gif" | "image/heic" | null {
  if (buffer.length < 12) return null;
  if (buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return "image/jpeg";
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  if (["GIF87a", "GIF89a"].includes(buffer.subarray(0, 6).toString("ascii"))) return "image/gif";
  if (buffer.subarray(4, 8).toString("ascii") === "ftyp" && ["heic", "heix", "hevc", "hevx", "mif1", "msf1"].includes(buffer.subarray(8, 12).toString("ascii"))) return "image/heic";
  return null;
}

function allowPublicUpload(ip: string, ownerId: number): boolean {
  const now = Date.now();
  const key = `${ip}:${ownerId}`;
  const existing = publicUploadWindows.get(key);
  if (!existing || now - existing.startedAt >= PUBLIC_UPLOAD_WINDOW_MS) {
    publicUploadWindows.set(key, { count: 1, startedAt: now });
    return true;
  }
  if (existing.count >= PUBLIC_UPLOAD_MAX_PER_WINDOW) return false;
  existing.count++;
  return true;
}

// ── POST /api/photos/upload ─────────────────────────────────────────────────
// Works for authenticated owners and verified client contexts.
// - Authenticated owners can upload estimate, WIP, finished, and receipt photos.
// - Unauthenticated portal clients must supply a valid portal token. Booking and
//   intake clients must supply a short-lived upload-session token. Their uploads
//   are always estimates and cannot be associated outside that verified context.
photoUploadRouter.post(
  "/api/photos/upload",
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "No file uploaded." });
        return;
      }

      const verifiedMime = detectedImageMime(req.file.buffer);
      if (!verifiedMime) {
        res.status(400).json({ error: "The uploaded file is not a supported image." });
        return;
      }
      const originalName = req.file.originalname || "photo";
      const ext = ({ "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif", "image/heic": ".heic" } as const)[verifiedMime];
      const suffix = crypto.randomBytes(12).toString("hex");

      // Try to get an authenticated owner from the session cookie.
      let userId: number | null = null;
      try {
        const { authenticateRequest } = await import("./auth");
        const user = await authenticateRequest(req);
        userId = user.id;
      } catch {
        // A client upload is verified below through its portal or booking context.
      }

      const requestedType = typeof req.body?.photoType === "string" ? req.body.photoType : "";
      const allowedOwnerTypes = new Set(["estimate", "wip", "finished", "receipt"]);
      let photoType = userId ? (allowedOwnerTypes.has(requestedType) ? requestedType : "wip") : "estimate";
      let folderSuffix = userId ? "owner" : "client";
      let publicSession: { id: number; userId: number } | null = null;

      if (!userId) {
        const db = await getDb();
        if (!db) {
          res.status(503).json({ error: "Photo upload is temporarily unavailable. Please try again." });
          return;
        }

        const portalToken = typeof req.body?.portalToken === "string" ? req.body.portalToken.trim() : "";
        const uploadToken = typeof req.body?.uploadToken === "string" ? req.body.uploadToken.trim() : "";

        if (portalToken) {
          const [portal] = await db.select({ userId: clientPortalTokens.userId, expiresAt: clientPortalTokens.expiresAt })
            .from(clientPortalTokens)
            .where(and(eq(clientPortalTokens.token, portalToken), eq(clientPortalTokens.revoked, false)))
            .limit(1);
          if (!portal || (portal.expiresAt && portal.expiresAt < new Date())) {
            res.status(403).json({ error: "Your portal session is invalid or has expired." });
            return;
          }
          userId = portal.userId;
          folderSuffix = "portal-client";
        } else if (/^[a-f0-9]{64}$/.test(uploadToken)) {
          const [session] = await db.select().from(publicPhotoUploadSessions)
            .where(eq(publicPhotoUploadSessions.tokenHash, hashPublicUploadToken(uploadToken))).limit(1);
          if (!session || session.consumedAt || new Date() > session.expiresAt || session.uploadCount >= session.maxUploads) {
            res.status(403).json({ error: "This photo-upload session has expired or reached its limit." });
            return;
          }
          userId = session.userId;
          publicSession = { id: session.id, userId: session.userId };
          folderSuffix = "session-client";
        } else {
          res.status(401).json({ error: "A valid portal or photo-upload session is required to upload a photo." });
          return;
        }

        if (!allowPublicUpload(getClientIp(req), userId)) {
          res.status(429).json({ error: "Too many photo uploads. Please wait and try again." });
          return;
        }

        if (publicSession) {
          // Reserve the file slot before storage so parallel requests cannot
          // exceed maxUploads after each observes the same stale count.
          const reservation = await db.update(publicPhotoUploadSessions)
            .set({ uploadCount: sql`${publicPhotoUploadSessions.uploadCount} + 1` })
            .where(and(
              eq(publicPhotoUploadSessions.id, publicSession.id),
              sql`${publicPhotoUploadSessions.consumedAt} IS NULL`,
              sql`${publicPhotoUploadSessions.expiresAt} > NOW()`,
              sql`${publicPhotoUploadSessions.uploadCount} < ${publicPhotoUploadSessions.maxUploads}`,
            ));
          if (!reservation[0].affectedRows) {
            res.status(403).json({ error: "This photo-upload session has expired or reached its limit." });
            return;
          }
        }

        // Never permit public visitors to select an internal photo category.
        photoType = "estimate";
      }

      const folder = publicSession
        ? getPublicUploadKeyPrefix(publicSession.userId, publicSession.id).replace(/\/$/, "")
        : `job-photos/${userId}/${photoType}/${folderSuffix}`;

      const key = `${folder}/${suffix}${ext}`;
      const { url } = await storagePut(key, req.file.buffer, verifiedMime);

      if (publicSession) {
        if (!isPublicUploadKeyForSession(key, publicSession.userId, publicSession.id)) {
          throw new Error("Invalid public upload key.");
        }
        const db = await getDb();
        if (!db) throw new Error("Upload metadata service unavailable.");
        await db.insert(publicPhotoUploads).values({ sessionId: publicSession.id, photoKey: key, photoUrl: url });
      }

      res.json({
        success: true,
        photoKey: key,
        photoUrl: url,
        fileName: originalName,
        mimeType: verifiedMime,
        sizeBytes: req.file.size,
      });
    } catch (err: unknown) {
      const msg = safeErrorMessage(err, "Photo upload failed.");
      console.error("[PhotoUpload] POST:", err);
      res.status(500).json({ error: msg });
    }
  }
);

photoUploadRouter.use((error: unknown, _req: Request, res: Response, next: (error?: unknown) => void) => {
  if (error instanceof multer.MulterError) {
    res.status(400).json({ error: error.code === "LIMIT_FILE_SIZE" ? "Photo must be 16 MB or smaller." : "Invalid photo upload." });
    return;
  }
  if (error instanceof Error && error.message.includes("Only image files")) {
    res.status(400).json({ error: error.message });
    return;
  }
  next(error);
});
