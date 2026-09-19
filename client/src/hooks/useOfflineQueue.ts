import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  countByKind,
  enqueueOperation,
  loadQueue,
  replayQueue,
  safeBrowserStorage,
  saveQueue,
  type QueuedOperation,
  type QueuedOperationKind,
} from "@/lib/offlineQueue";

/** Payload for a photo captured offline; the image blob lives in the
 * photoStore under `blobKey` and is uploaded during replay. */
export type PendingPhotoPayload = {
  jobId: number;
  clientId: number;
  bookingId?: number;
  caption: string;
  blobKey: string;
};

export type OfflineQueueHandle = {
  /** Trpc procedure, e.g. "jobs.addUpdate", or "photos.captureProof" with a PendingPhotoPayload. */
  queueOperation: (proc: string, payload: unknown, kind?: QueuedOperationKind) => void;
  pendingCount: number;
  pendingByKind: { updates: number; photos: number };
  syncing: boolean;
  replay: () => void;
};

/**
 * Durable offline write queue for Field Mode. Mutations that can be safely
 * deferred (checklist toggles, client updates, photo captures) are persisted
 * locally when the technician is offline and replayed in order when the
 * connection returns. Photos are executed through `replayPhoto` (upload →
 * confirm → attach → blob cleanup) instead of a trpc call; callers decide
 * which operations are queueable — billing-sensitive writes like timer
 * start/stop stay online-only by design.
 */
export function useOfflineQueue(
  isOnline: boolean,
  /** Memoized photo replay (upload → confirm → attach → cleanup). Called only
   * during queue replay, never inline — pass a useCallback/undefined. */
  replayPhoto?: (payload: PendingPhotoPayload) => Promise<void>,
): OfflineQueueHandle {
  const utils = trpc.useUtils();
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingByKind, setPendingByKind] = useState({ updates: 0, photos: 0 });
  const [syncing, setSyncing] = useState(false);
  const replayingRef = useRef(false);

  const persist = useCallback((queue: QueuedOperation[]) => {
    saveQueue(safeBrowserStorage(), queue);
    setPendingCount(queue.length);
    setPendingByKind(countByKind(queue));
  }, []);

  const queueOperation = useCallback((proc: string, payload: unknown, kind: QueuedOperationKind = "update") => {
    const storage = safeBrowserStorage();
    const next = enqueueOperation(loadQueue(storage), proc, payload, Date.now(), kind);
    persist(next);
    toast.success(kind === "photo" ? "Photo saved offline. It will upload when your connection returns." : "Saved offline. It will sync when your connection returns.");
  }, [persist]);

  const replay = useCallback(async () => {
    if (replayingRef.current || !navigator.onLine) return;
    const storage = safeBrowserStorage();
    const queue = loadQueue(storage);
    if (queue.length === 0) return;
    replayingRef.current = true;
    setSyncing(true);
    try {
      const { synced, dropped, remaining } = await replayQueue(queue, async (proc, payload) => {
        if (proc === "photos.captureProof") {
          if (!replayPhoto) throw new Error("Photo replay is unavailable.");
          await replayPhoto(payload as PendingPhotoPayload);
          return;
        }
        await utils.client.mutation(proc, payload as never);
      });
      persist(remaining);
      if (synced > 0) {
        toast.success(`Synced ${synced} offline ${synced === 1 ? "change" : "changes"}.`);
        // Replays touch jobs, their updates, and attached photos — refresh everything Field Mode shows.
        await utils.jobs.list.invalidate();
        await utils.time.runningEntry.invalidate();
        await utils.jobs.get.invalidate();
      }
      if (dropped > 0) {
        toast.error(`${dropped} queued ${dropped === 1 ? "change" : "changes"} could not be synced and was discarded.`);
      }
    } finally {
      replayingRef.current = false;
      setSyncing(false);
    }
  }, [replayPhoto, persist, utils]);

  // Replay on mount when already online, and whenever the browser regains the connection.
  useEffect(() => {
    if (isOnline) void replay();
  }, [isOnline, replay]);

  useEffect(() => {
    const storage = safeBrowserStorage();
    const queue = loadQueue(storage);
    setPendingCount(queue.length);
    setPendingByKind(countByKind(queue));
  }, []);

  return { queueOperation, pendingCount, pendingByKind, syncing, replay };
}
