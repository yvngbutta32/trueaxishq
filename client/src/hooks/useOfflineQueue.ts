import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  enqueueOperation,
  loadQueue,
  replayQueue,
  safeBrowserStorage,
  saveQueue,
  type QueuedOperation,
} from "@/lib/offlineQueue";

/**
 * Durable offline write queue for Field Mode. Mutations that can be safely
 * deferred (checklist toggles, client updates) are persisted locally when the
 * technician is offline and replayed in order when the connection returns.
 * Callers decide which operations are queueable; billing-sensitive writes like
 * timer start/stop stay online-only by design.
 */
export function useOfflineQueue(isOnline: boolean) {
  const utils = trpc.useUtils();
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const replayingRef = useRef(false);

  const persist = useCallback((queue: QueuedOperation[]) => {
    saveQueue(safeBrowserStorage(), queue);
    setPendingCount(queue.length);
  }, []);

  const queueOperation = useCallback((proc: string, payload: unknown) => {
    const storage = safeBrowserStorage();
    const next = enqueueOperation(loadQueue(storage), proc, payload);
    persist(next);
    toast.success("Saved offline. It will sync when your connection returns.");
  }, [persist]);

  const replay = useCallback(async () => {
    if (replayingRef.current || !navigator.onLine) return;
    const storage = safeBrowserStorage();
    const queue = loadQueue(storage);
    if (queue.length === 0) return;
    replayingRef.current = true;
    setSyncing(true);
    try {
      const { synced, dropped, remaining } = await replayQueue(queue, (proc, payload) =>
        utils.client.mutation(proc, payload as never));
      persist(remaining);
      if (synced > 0) {
        toast.success(`Synced ${synced} offline ${synced === 1 ? "change" : "changes"}.`);
        // Replays touch jobs and their updates — refresh everything Field Mode shows.
        await utils.jobs.list.invalidate();
        await utils.time.runningEntry.invalidate();
      }
      if (dropped > 0) {
        toast.error(`${dropped} queued ${dropped === 1 ? "change" : "changes"} could not be synced and was discarded.`);
      }
    } finally {
      replayingRef.current = false;
      setSyncing(false);
    }
  }, [persist, utils]);

  // Replay on mount when already online, and whenever the browser regains the connection.
  useEffect(() => {
    if (isOnline) void replay();
  }, [isOnline, replay]);

  useEffect(() => {
    const storage = safeBrowserStorage();
    setPendingCount(loadQueue(storage).length);
  }, []);

  return { queueOperation, pendingCount, syncing, replay };
}
