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
import { eq } from "drizzle-orm";
import { storagePut } from "./storage";
import { safeErrorMessage } from "./utils";
import { getDb } from "./db";
import { clientPortalTokens, users } from "../drizzle/schema";

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
// Works for authenticated owners and verified client contexts.
// - Authenticated owners can upload estimate, WIP, finished, and receipt photos.
// - Unauthenticated clients must supply either a valid portalToken or a valid
//   public booking hostUsername. Their uploads are always estimate photos and
//   are stored under that verified owner's namespace.
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

      if (!userId) {
        const db = await getDb();
        if (!db) {
          res.status(503).json({ error: "Photo upload is temporarily unavailable. Please try again." });
          return;
        }

        const portalToken = typeof req.body?.portalToken === "string" ? req.body.portalToken.trim() : "";
        const hostUsername = typeof req.body?.hostUsername === "string" ? req.body.hostUsername.trim() : "";

        if (portalToken) {
          const [portal] = await db.select({ userId: clientPortalTokens.userId, expiresAt: clientPortalTokens.expiresAt })
            .from(clientPortalTokens)
            .where(eq(clientPortalTokens.token, portalToken))
            .limit(1);
          if (!portal || (portal.expiresAt && portal.expiresAt < new Date())) {
            res.status(403).json({ error: "Your portal session is invalid or has expired." });
            return;
          }
          userId = portal.userId;
          folderSuffix = "portal-client";
        } else if (hostUsername) {
          const [host] = await db.select({ id: users.id })
            .from(users)
            .where(eq(users.bookingUsername, hostUsername))
            .limit(1);
          if (!host) {
            res.status(404).json({ error: "Booking page not found." });
            return;
          }
          userId = host.id;
          folderSuffix = "public-client";
        } else {
          res.status(401).json({ error: "A valid booking or portal session is required to upload a photo." });
          return;
        }

        // Never permit public visitors to select an internal photo category.
        photoType = "estimate";
      }

      const folder = `job-photos/${userId}/${photoType}/${folderSuffix}`;

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
